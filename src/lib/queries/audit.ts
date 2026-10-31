import { InsuranceStore } from '@/lib/store/insuranceStore';
import { AuditLog } from '@/types/database';

export async function getAuditLogs(): Promise<AuditLog[]> {
  return [...InsuranceStore.getAuditLogs()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
