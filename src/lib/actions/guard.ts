import { getCurrentSession, type UserSession } from '@/lib/auth/session';
import { hasPermission, ROLE_PERMISSIONS } from '@/lib/permissions/roles';
import { StoreError } from '@/lib/store/errors';
import type { Actor } from '@/lib/store/insuranceStore';
import type { ActionResult } from './result';

export type Permission = keyof (typeof ROLE_PERMISSIONS)['admin'];

export const actorOf = (session: UserSession): Actor => ({ id: session.user.id, name: session.user.name });

/**
 * Wraps every Server Action: these are reachable by direct POST, so each one must check the
 * session and permission here on the server. This replaces the old Postgres RLS policies.
 * Passing several permissions means any one of them is enough.
 */
export async function guarded<T>(
  permissions: Permission | Permission[],
  work: (session: UserSession) => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const session = await getCurrentSession();
    if (!session) return { ok: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };

    const required = Array.isArray(permissions) ? permissions : [permissions];
    if (!required.some((p) => hasPermission(session.roles, p))) {
      return { ok: false, error: 'คุณไม่มีสิทธิ์ดำเนินการนี้' };
    }
    return { ok: true, data: await work(session) };
  } catch (err) {
    if (err instanceof StoreError) return { ok: false, error: err.message };
    console.error('Server action failed:', err);
    return { ok: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง' };
  }
}
