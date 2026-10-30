import { MOCK_INSURERS, MOCK_VEHICLE_MODELS, MOCK_COVERAGE_TYPES } from './mockData';
import { Insurer } from '@/types/database';

export async function getInsurers(): Promise<Insurer[]> {
  return MOCK_INSURERS;
}

export async function getVehicleModels() {
  return MOCK_VEHICLE_MODELS;
}

export async function getCoverageTypes() {
  return MOCK_COVERAGE_TYPES;
}

export async function createInsurer(data: { name: string; contact_channels?: string; website?: string }) {
  const newInsurer: Insurer = {
    id: `insurer-${Date.now()}`,
    name: data.name,
    contact_channels: data.contact_channels || null,
    website: data.website || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_INSURERS.push(newInsurer);
  return newInsurer;
}
