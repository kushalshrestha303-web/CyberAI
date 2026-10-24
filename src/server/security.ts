import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, type User } from './db';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const sessionName = () =>
  process.env.NODE_ENV === 'production' ? '__Host-cyber_session' : 'cyber_session';
export function originCheck(request: Request) {
  const expected = process.env.APP_ORIGIN,
    origin = request.headers.get('origin');
  if (expected && origin === new URL(expected).origin) return;
  if (!expected && process.env.NODE_ENV !== 'production') {
    const incoming = new URL(request.url),
      allowed = [
        incoming.origin,
        `http://127.0.0.1:${incoming.port || '3100'}`,
        `http://localhost:${incoming.port || '3100'}`,
      ];
    if (origin && allowed.includes(origin)) return;
  }
  throw new HttpError(403, 'Request origin is not allowed. Configure APP_ORIGIN.');
}
const buckets = new Map<string, { count: number; expires: number }>();
export async function quota(
  key: string,
  limit: number,
  windowSeconds: number,
  requireDurable = false,
) {
  const pool = db(),
    now = Date.now();
  if (pool) {
    const r = await pool.query(
      "INSERT INTO rate_buckets(key,count,expires_at) VALUES($1,1,now()+($2::integer * interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_buckets.expires_at<=now() THEN 1 ELSE rate_buckets.count+1 END,expires_at=CASE WHEN rate_buckets.expires_at<=now() THEN EXCLUDED.expires_at ELSE rate_buckets.expires_at END RETURNING count",
      [key, windowSeconds],
    );
    if (Number(r.rows[0].count) > limit)
      throw new HttpError(429, 'Request limit reached. Please try again later.');
    return;
  }
  if (requireDurable)
    throw new HttpError(503, 'Configure PostgreSQL to enable shared quotas for this capability.');
  if (buckets.size > 2000) for (const [k, v] of buckets) if (v.expires < now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.expires <= now) {
    b = { count: 0, expires: now + windowSeconds * 1000 };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > limit) throw new HttpError(429, 'Request limit reached. Please try again later.');
}
export async function currentUser(): Promise<User | null> {
  const pool = db();
  if (!pool) return null;
  const token = (await cookies()).get(sessionName())?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await pool.query(
    'SELECT u.id,u.tenant_id,u.email,u.role,u.plan FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [digest(token)],
  );
  return r.rows[0] ?? null;
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Sign in to a configured workspace to use this capability.');
  if (admin && user.role !== 'admin') throw new HttpError(403, 'Administrator role required.');
  return user;
}
export async function login(email: string, password: string) {
  const pool = db();
  if (!pool) throw new HttpError(503, 'Accounts require PostgreSQL. Guest learning is available.');
  await quota(`login:${digest(email)}`, 8, 900, true);
  await quota('login:global', 100, 60, true);
  const r = await pool.query('SELECT id,password_hash FROM users WHERE email=$1', [email]);
  const [salt, stored] = (r.rows[0]?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(
    ':',
  );
  const calculated = scryptSync(password, salt, 64),
    expected = Buffer.from(stored, 'hex');
  if (expected.length !== calculated.length || !timingSafeEqual(calculated, expected) || !r.rows[0])
    throw new HttpError(401, 'Email or password is incorrect.');
  const token = randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [digest(token), r.rows[0].id],
  );
  (await cookies()).set(sessionName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 43200,
  });
}
export function publicIPv4(value: string) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  const a = value.split('.').map(Number);
  if (a.some((v, i) => v > 255 || String(v) !== value.split('.')[i])) return false;
  const [x, y, z] = a;
  return !(
    x === 0 ||
    x === 10 ||
    x === 127 ||
    x >= 224 ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && (y === 168 || y === 0 || (y === 88 && z === 99))) ||
    (x === 198 && (y === 18 || y === 19 || (y === 51 && z === 100))) ||
    (x === 203 && y === 0 && z === 113)
  );
}
export function validateIndicator(type: string, value: string) {
  if (type === 'IP') return publicIPv4(value);
  if (type === 'hash') return /^[a-fA-F0-9]{64}$/.test(value);
  if (type === 'CVE') return /^CVE-\d{4}-\d{4,10}$/.test(value);
  if (type === 'domain')
    return (
      value.length <= 253 &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value) &&
      !/(?:^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(value)
    );
  return false;
}
export const entitlements = {
  free: { ai: 10, lookups: 10 },
  student: { ai: 50, lookups: 30 },
  professional: { ai: 150, lookups: 100 },
  team: { ai: 300, lookups: 200 },
};
