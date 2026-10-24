import pg from 'pg';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.SEED_ADMIN_PASSWORD;
if (!process.env.DATABASE_URL || !email || !password || password.length < 14)
  throw new Error(
    'Set DATABASE_URL, SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 14 characters.',
  );
const salt = randomBytes(16).toString('hex'),
  hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  await c.query('BEGIN');
  const existing = await c.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rowCount)
    throw new Error('Account already exists; refusing to overwrite credentials.');
  const tenant = randomUUID();
  await c.query('INSERT INTO tenants(id,name) VALUES($1,$2)', [
    tenant,
    process.env.SEED_TENANT_NAME || 'Cyber AI Workspace',
  ]);
  await c.query(
    'INSERT INTO users(id,tenant_id,email,password_hash,role,plan) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), tenant, email, hash, 'admin', 'team'],
  );
  await c.query('COMMIT');
  console.log('Admin account created. Remove seed credentials from the environment.');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
  await pool.end();
}
