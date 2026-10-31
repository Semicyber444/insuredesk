import { InsuranceStore } from '@/lib/store/insuranceStore';
import { Insurer } from '@/types/database';

export async function getInsurers(activeOnly = false): Promise<Insurer[]> {
  const list = InsuranceStore.getInsurers();
  return activeOnly ? list.filter((i) => i.is_active) : list;
}

export async function getVehicleModels() {
  return InsuranceStore.getVehicleModels();
}

export async function getCoverageTypes() {
  return InsuranceStore.getCoverageTypes();
}

export async function createInsurer(
  data: { name: string; contact_channels?: string; website?: string; id?: string; is_active?: boolean },
  actorName = 'ผู้ใช้งาน'
) {
  return InsuranceStore.saveInsurer(data, actorName);
}
