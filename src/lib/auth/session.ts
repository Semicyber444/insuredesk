import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { execute, getPool, selectRows } from '@/lib/db/mysql';
import { AppRole, Profile } from '@/types/database';
import { isDemoUserId } from './demoUsers';

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  profile: Profile;
  roles: AppRole[];
}

const SESSION_COOKIE = 'insuredesk_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLE_PRIORITY: AppRole[] = ['admin', 'reviewer', 'editor', 'viewer'];

export function isDemoAuthEnabled(): boolean {
  return process.env.ENABLE_DEMO_AUTH === 'true';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function getCurrentSession(): Promise<UserSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const db = getPool();
    // Section 14: deactivated accounts are denied even with a valid session
    const [user] = await selectRows<{
      id: string;
      email: string;
      display_name: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      db,
      `SELECT u.id, u.email, u.display_name, u.is_active, u.created_at, u.updated_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.is_active = TRUE`,
      [hashToken(token)]
    );
    if (!user) return null;
    if (isDemoUserId(user.id) && !isDemoAuthEnabled()) return null;

    const roleRows = await selectRows<{ role: AppRole }>(db, 'SELECT role FROM user_roles WHERE user_id = ?', [user.id]);
    const held = new Set(roleRows.map((r) => r.role));
    const roles = ROLE_PRIORITY.filter((role) => held.has(role));

    return {
      user: { id: user.id, email: user.email, name: user.display_name },
      profile: {
        user_id: user.id,
        display_name: user.display_name,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      roles: roles.length > 0 ? roles : ['viewer'],
    };
  } catch (err) {
    console.error('Error reading session:', err);
    return null;
  }
}

export async function startSession(userId: string): Promise<void> {
  const db = getPool();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await execute(db, 'DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(3)');
  await execute(db, 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token),
    userId,
    expiresAt,
  ]);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Set SESSION_COOKIE_INSECURE=true only when production is served over plain HTTP.
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_INSECURE !== 'true',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await execute(getPool(), 'DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}
