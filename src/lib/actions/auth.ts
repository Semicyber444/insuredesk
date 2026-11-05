'use server';

import { verifyPassword } from '@/lib/auth/password.mjs';
import { DEMO_USER_IDS, isDemoUserId } from '@/lib/auth/demoUsers';
import { endSession, getCurrentSession, isDemoAuthEnabled, startSession } from '@/lib/auth/session';
import { getPool, selectRows } from '@/lib/db/mysql';
import type { AppRole } from '@/types/database';
import type { ActionResult } from './result';

const CONNECTION_ERROR = 'ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง';
const INVALID_LOGIN = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับเชิญเข้าสู่ระบบ';
// Verified when the email is unknown, so response time doesn't reveal which accounts exist.
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export async function loginAction(email: string, password: string): Promise<ActionResult<null>> {
  try {
    const [user] = await selectRows<{ id: string; password_hash: string | null; is_active: boolean }>(
      getPool(),
      'SELECT id, password_hash, is_active FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    // Demo accounts sign in with any password while demo auth is on.
    if (user && isDemoUserId(user.id) && isDemoAuthEnabled()) {
      await startSession(user.id);
      return { ok: true, data: null };
    }

    const matches = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !user.is_active || !user.password_hash || !matches) {
      return { ok: false, error: INVALID_LOGIN };
    }
    await startSession(user.id);
    return { ok: true, data: null };
  } catch (err) {
    console.error('Login failed:', err);
    return { ok: false, error: CONNECTION_ERROR };
  }
}

export async function demoLoginAction(role: AppRole): Promise<ActionResult<null>> {
  if (!isDemoAuthEnabled() || !DEMO_USER_IDS[role]) {
    return { ok: false, error: 'ไม่ได้เปิดใช้งานบัญชีจำลอง' };
  }
  try {
    await startSession(DEMO_USER_IDS[role]);
    return { ok: true, data: null };
  } catch (err) {
    console.error('Demo login failed:', err);
    return { ok: false, error: CONNECTION_ERROR };
  }
}

/** The navbar's role switcher: only a signed-in demo user may hop between demo users. */
export async function switchDemoRoleAction(role: AppRole): Promise<ActionResult<null>> {
  const session = await getCurrentSession();
  if (!session || !isDemoUserId(session.user.id)) {
    return { ok: false, error: 'สลับบทบาทได้เฉพาะบัญชีจำลอง' };
  }
  await endSession();
  return demoLoginAction(role);
}

export async function logoutAction(): Promise<void> {
  await endSession();
}
