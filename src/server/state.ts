import { db, type User } from './db';
export async function readUserState(user: User) {
  const r = await db()!.query(
    'SELECT data,updated_at FROM user_state WHERE user_id=$1 AND tenant_id=$2',
    [user.id, user.tenant_id],
  );
  return r.rows[0] ?? { data: null };
}
export async function writeUserState(user: User, data: unknown) {
  return db()!.query(
    'INSERT INTO user_state(user_id,tenant_id,data) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET data=$3,updated_at=now() WHERE user_state.tenant_id=$2',
    [user.id, user.tenant_id, JSON.stringify(data)],
  );
}
