import { AppRole } from '@/types/database';

/** Seeded by db/seed.sql. They have no password and only work while demo auth is on. */
export const DEMO_USER_IDS: Record<AppRole, string> = {
  admin: '00000000-0000-0000-0000-000000000001',
  reviewer: '00000000-0000-0000-0000-000000000004',
  editor: '00000000-0000-0000-0000-000000000002',
  viewer: '00000000-0000-0000-0000-000000000003',
};

export function isDemoUserId(userId: string): boolean {
  return Object.values(DEMO_USER_IDS).includes(userId);
}
