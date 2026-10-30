import { InsuranceStore } from '@/lib/store/insuranceStore';
import { Insurer } from '@/types/database';

export async function getInsurers(): Promise<Insurer[]> {
  return InsuranceStore.getInsurers();
}

export async function getVehicleModels() {
  return InsuranceStore.getVehicleModels();
}

export async function getCoverageTypes() {
  return InsuranceStore.getCoverageTypes();
}

export async function createInsurer(data: { name: string; contact_channels?: string; website?: string; id?: string }) {
  return InsuranceStore.saveInsurer(data);
}
