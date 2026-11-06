import { createHash } from 'node:crypto';
import { execute, getPool, selectRows } from '@/lib/db/mysql';

const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

export const LOGIN_LOCKED_MESSAGE = `พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ ${WINDOW_MINUTES} นาทีแล้วลองใหม่`;

// Keyed by email rather than IP: X-Forwarded-For can be spoofed unless a trusted proxy sets it.
const keyFor = (email: string) => createHash('sha256').update(email).digest('hex');

/**
 * Records this attempt, then counts it with the others, and returns true when the email is locked.
 * Storing before counting means parallel requests each see the ones before them; a count taken
 * first would let a burst of simultaneous guesses all pass while the count is still zero.
 * A successful login clears the record with `clearFailedLogins`.
 */
export async function registerLoginAttempt(email: string): Promise<boolean> {
  const db = getPool();
  const key = keyFor(email);
  await execute(db, `DELETE FROM login_attempts WHERE attempted_at <= UTC_TIMESTAMP(3) - INTERVAL ${WINDOW_MINUTES} MINUTE`);
  await execute(db, 'INSERT INTO login_attempts (email_hash, attempted_at) VALUES (?, ?)', [key, new Date()]);
  const [{ attempts }] = await selectRows<{ attempts: number }>(
    db,
    `SELECT COUNT(*) AS attempts FROM login_attempts
     WHERE email_hash = ? AND attempted_at > UTC_TIMESTAMP(3) - INTERVAL ${WINDOW_MINUTES} MINUTE`,
    [key]
  );
  return attempts > MAX_FAILED_ATTEMPTS;
}

export async function clearFailedLogins(email: string): Promise<void> {
  await execute(getPool(), 'DELETE FROM login_attempts WHERE email_hash = ?', [keyFor(email)]);
}
