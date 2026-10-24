import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { type Pool } from 'pg';
import { quota } from '../src/server/security';
import { readUserState, writeUserState } from '../src/server/state';
import { audit, cacheRead, cacheWrite, health, type User } from '../src/server/db';
test('PostgreSQL schema, tenant isolation, atomic quotas, cache and audit work against PGlite', async () => {
  const pg = new PGlite();
  await pg.exec(
    await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'),
  );
  const globalDb = globalThis as unknown as { cyberPool?: Pool };
  globalDb.cyberPool = {
    query: (sql: string, values?: unknown[]) => pg.query(sql, values),
  } as unknown as Pool;
  process.env.DATABASE_URL = 'postgresql://test-only';
  const a: User = {
    id: '00000000-0000-4000-8000-000000000001',
    tenant_id: '10000000-0000-4000-8000-000000000001',
    email: 'a@example.test',
    role: 'learner',
    plan: 'free',
  };
  const b: User = {
    ...a,
    id: '00000000-0000-4000-8000-000000000002',
    tenant_id: '10000000-0000-4000-8000-000000000002',
    email: 'b@example.test',
  };
  try {
    for (const u of [a, b]) {
      await pg.query('INSERT INTO tenants(id,name) VALUES($1,$2)', [u.tenant_id, 'Test tenant']);
      await pg.query(
        'INSERT INTO users(id,tenant_id,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',
        [u.id, u.tenant_id, u.email, 'test-only-hash', u.role],
      );
    }
    await writeUserState(a, { completed: ['tcp'] });
    assert.deepEqual((await readUserState(a)).data, { completed: ['tcp'] });
    assert.equal((await readUserState(b)).data, null);
    assert.equal((await readUserState({ ...a, tenant_id: b.tenant_id })).data, null);
    await writeUserState({ ...a, tenant_id: b.tenant_id }, { completed: ['stolen'] });
    assert.deepEqual((await readUserState(a)).data, { completed: ['tcp'] });
    await Promise.all([quota('test', 2, 60, true), quota('test', 2, 60, true)]);
    await assert.rejects(() => quota('test', 2, 60, true), /limit reached/);
    await pg.query("UPDATE rate_buckets SET expires_at=now()-interval '1 minute' WHERE key='test'");
    await quota('test', 2, 60, true);
    await cacheWrite('test-cache', { source: 'fixture' });
    assert.deepEqual((await cacheRead('test-cache'))?.data, { source: 'fixture' });
    await health('test-provider', 'connected', 'Valid fixture');
    await health('test-provider', 'error', 'Test outage');
    const h = await pg.query<{ status: string; last_success: unknown }>(
      'SELECT status,last_success FROM provider_health WHERE provider=$1',
      ['test-provider'],
    );
    assert.equal(h.rows[0].status, 'error');
    assert.ok(h.rows[0].last_success);
    await audit(a, 'test-action', { dryRun: true });
    const logs = await pg.query('SELECT action FROM audit_log WHERE tenant_id=$1', [b.tenant_id]);
    assert.equal(logs.rows.length, 0);
  } finally {
    delete process.env.DATABASE_URL;
    delete globalDb.cyberPool;
    await pg.close();
  }
});
