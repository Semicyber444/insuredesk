import { createHash } from 'node:crypto';
import { execute, getPool, selectRows } from '@/lib/db/mysql';

const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

export const LOGIN_LOCKED_MESSAGE = `พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ ${WINDOW_MINUTES} นาทีแล้วลองใหม่`;

// Keyed by email rather than IP: X-Forwarded-For can be spoofed unless a trusted proxy sets it.
const keyFor = (email: string) => createHash('sha256').update(email).digest('hex');

export async function isLoginLocked(email: string): Promise<boolean> {
  const [{ failures }] = await selectRows<{ failures: number }>(
    getPool(),
    `SELECT COUNT(*) AS failures FROM login_attempts
     WHERE email_hash = ? AND attempted_at > UTC_TIMESTAMP(3) - INTERVAL ${WINDOW_MINUTES} MINUTE`,
    [keyFor(email)]
  );
  return failures >= MAX_FAILED_ATTEMPTS;
}

export async function recordFailedLogin(email: string): Promise<void> {
  const db = getPool();
  await execute(db, `DELETE FROM login_attempts WHERE attempted_at <= UTC_TIMESTAMP(3) - INTERVAL ${WINDOW_MINUTES} MINUTE`);
  await execute(db, 'INSERT INTO login_attempts (email_hash, attempted_at) VALUES (?, ?)', [keyFor(email), new Date()]);
}

export async function clearFailedLogins(email: string): Promise<void> {
  await execute(getPool(), 'DELETE FROM login_attempts WHERE email_hash = ?', [keyFor(email)]);
}
