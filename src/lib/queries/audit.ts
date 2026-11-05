import { InsuranceStore } from '@/lib/store/insuranceStore';
import { AuditLog } from '@/types/database';

export async function getAuditLogs(): Promise<AuditLog[]> {
  return InsuranceStore.getAuditLogs();
}
