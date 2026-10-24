import { Pool } from 'pg';
const globalDb = globalThis as unknown as { cyberPool?: Pool };
const localHealth = new Map<
  string,
  {
    provider: string;
    status: string;
    last_success: string | null;
    last_attempt: string;
    message: string;
  }
>();
export function db() {
  if (!process.env.DATABASE_URL) return null;
  globalDb.cyberPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  return globalDb.cyberPool;
}
export async function cacheRead<T>(key: string): Promise<{ data: T; updatedAt: string } | null> {
  const pool = db();
  if (!pool) return null;
  const r = await pool.query('SELECT data,updated_at FROM provider_cache WHERE key=$1', [key]);
  return r.rows[0]
    ? { data: r.rows[0].data as T, updatedAt: new Date(r.rows[0].updated_at).toISOString() }
    : null;
}
export async function cacheWrite(key: string, data: unknown) {
  const pool = db();
  if (pool)
    await pool.query(
      'INSERT INTO provider_cache(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',
      [key, JSON.stringify(data)],
    );
}
export async function health(provider: string, status: string, message: string) {
  const now = new Date().toISOString();
  localHealth.set(provider, {
    provider,
    status,
    last_success: status === 'connected' ? now : (localHealth.get(provider)?.last_success ?? null),
    last_attempt: now,
    message,
  });
  const pool = db();
  if (pool)
    await pool.query(
      "INSERT INTO provider_health(provider,status,last_success,message) VALUES($1,$2,CASE WHEN $2='connected' THEN now() ELSE NULL END,$3) ON CONFLICT(provider) DO UPDATE SET status=$2,last_attempt=now(),last_success=CASE WHEN $2='connected' THEN now() ELSE provider_health.last_success END,message=$3",
      [provider, status, message],
    );
}
export async function healthRows() {
  const pool = db();
  return pool
    ? (
        await pool.query(
          'SELECT provider,status,last_success,last_attempt,message FROM provider_health',
        )
      ).rows
    : [...localHealth.values()];
}
export type User = {
  id: string;
  tenant_id: string;
  email: string;
  role: 'admin' | 'analyst' | 'learner';
  plan: 'free' | 'student' | 'professional' | 'team';
};
export async function audit(user: User, action: string, metadata: Record<string, unknown>) {
  await db()!.query(
    'INSERT INTO audit_log(tenant_id,user_id,action,metadata) VALUES($1,$2,$3,$4)',
    [user.tenant_id, user.id, action, JSON.stringify(metadata)],
  );
}
