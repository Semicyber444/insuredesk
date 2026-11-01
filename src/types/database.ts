export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'viewer' | 'editor' | 'reviewer' | 'admin';
export type WorkflowStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type InsuranceType = 'ชั้น 1' | 'ชั้น 2+' | 'ชั้น 3+' | 'ชั้น 2' | 'ชั้น 3';
export type RepairType = 'dealer' | 'garage';
export type PriceType = 'starting' | 'indicative' | 'fixed_for_conditions' | 'unknown';
export type CoverageStatus = 'covered' | 'not_covered' | 'optional' | 'unknown';
export type ScopeType = 'specific_model' | 'all_models' | 'unknown';
export type RegistrationZone = 'all' | 'bangkok_only' | 'bangkok_metro' | 'upcountry_only';
export type CompulsoryInclusion = 'included' | 'excluded' | 'unspecified';
export type SourceType =
  | 'policy_schedule'
  | 'rate_sheet'
  | 'brochure'
  | 'endorsement'
  | 'manual_note'
  | 'other';

export interface Profile {
  user_id: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Insurer {
  id: string;
  name: string;
  contact_channels?: string | null;
  website?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface VehicleModel {
  id: string;
  brand: string;
  model: string;
  variant?: string | null;
  powertrain?: 'ICE' | 'HEV' | 'PHEV' | 'BEV' | 'other' | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  insurer_id: string;
  name: string;
  insurance_type: InsuranceType;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PlanVersion {
  id: string;
  plan_id: string;
  version_no: number;
  workflow_status: WorkflowStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  review_due_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface EligibilityRule {
  id: string;
  plan_version_id: string;
  scope_type: ScopeType;
  vehicle_model_id?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  age_basis?: 'registration_year' | 'manufacture_year' | null;
  usage_type?: 'private' | 'commercial' | 'all' | null;
  registration_zone?: RegistrationZone | null;
  inspection_required?: boolean | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PriceOption {
  id: string;
  eligibility_rule_id: string;
  label: string;
  repair_type: RepairType;
  price_type: PriceType;
  net_premium?: number | null;
  tax_stamp?: number | null;
  premium_total?: number | null;
  compulsory_included: CompulsoryInclusion;
  sum_insured_min?: number | null;
  sum_insured_max?: number | null;
  deductible_amount: number;
  deductible_terms?: string | null;
  driver_conditions?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CoverageType {
  id: string;
  code: string;
  name: string;
  category: string;
  sort_order: number;
}

export interface VersionCoverage {
  id: string;
  plan_version_id: string;
  coverage_type_id: string;
  status: CoverageStatus;
  limit_amount?: number | null;
  limit_basis?: string | null;
  deductible_amount?: number | null;
  terms?: string | null;
  exclusions?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptionCoverageOverride {
  id: string;
  price_option_id: string;
  coverage_type_id: string;
  status: CoverageStatus;
  limit_amount?: number | null;
  limit_basis?: string | null;
  deductible_amount?: number | null;
  terms?: string | null;
  exclusions?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceDocument {
  id: string;
  plan_version_id: string;
  source_type: SourceType;
  storage_path: string;
  source_url?: string | null;
  title: string;
  file_size?: number | null;
  mime_type?: string | null;
  page_reference?: string | null;
  received_at?: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data?: Json | null;
  after_data?: Json | null;
  reason?: string | null;
  created_at: string;
}
