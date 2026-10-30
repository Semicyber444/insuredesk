import { MOCK_AUDIT_LOGS } from './mockData';
import { AuditLog } from '@/types/database';

export async function getAuditLogs(): Promise<AuditLog[]> {
  return [...MOCK_AUDIT_LOGS].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
