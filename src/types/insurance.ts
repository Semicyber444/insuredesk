import {
  CoverageStatus,
  CoverageType,
  CompulsoryInclusion,
  InsuranceType,
  PriceType,
  RepairType,
  ScopeType,
  SourceDocument,
  WorkflowStatus
} from './database';

export interface CoverageResolvedItem {
  coverageTypeId: string;
  code: string;
  name: string;
  category: string;
  status: CoverageStatus;
  limitAmount?: number | null;
  limitBasis?: string | null;
  deductibleAmount?: number | null;
  terms?: string | null;
  exclusions?: string | null;
  isOverridden: boolean;
}

export interface InsuranceSearchResultItem {
  id: string; // price_option_id
  priceOptionLabel: string;
  repairType: RepairType;
  priceType: PriceType;
  premiumTotal?: number | null;
  netPremium?: number | null;
  taxStamp?: number | null;
  compulsoryIncluded: CompulsoryInclusion;
  sumInsuredMin?: number | null;
  sumInsuredMax?: number | null;
  deductibleAmount: number;
  deductibleTerms?: string | null;
  driverConditions?: string | null;
  priceValidFrom?: string | null;
  priceValidTo?: string | null;

  // Plan info
  planId: string;
  planName: string;
  insuranceType: InsuranceType;

  // Insurer info
  insurerId: string;
  insurerName: string;
  insurerWebsite?: string | null;

  // Version info
  planVersionId: string;
  versionNo: number;
  workflowStatus: WorkflowStatus;
  verifiedAt?: string | null;
  reviewDueAt?: string | null;

  // Eligibility
  eligibilityRuleId: string;
  scopeType: ScopeType;
  vehicleModelId?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleVariant?: string | null;
  minCarAge?: number | null;
  maxCarAge?: number | null;
  usageType?: string | null;
  inspectionRequired?: boolean | null;

  // Resolved coverages for this price option
  coverages: CoverageResolvedItem[];

  // Documents
  documents: SourceDocument[];
}

export interface SearchFilters {
  query?: string;
  insurerIds?: string[];
  insuranceTypes?: InsuranceType[];
  repairTypes?: RepairType[];
  vehicleBrand?: string;
  vehicleModelId?: string;
  carAge?: number;
  usageType?: string;
  minPremium?: number;
  maxPremium?: number;
  minSumInsured?: number;
  maxSumInsured?: number;
  includeUnknownPrice?: boolean;
  requiredCoverageCodes?: string[];
  sortBy?: 'premium_asc' | 'premium_desc' | 'sum_insured_desc' | 'name_asc';
  page?: number;
  pageSize?: number;
}

export interface ComparisonWarning {
  type: 'sum_insured_diff' | 'repair_type_diff' | 'deductible_diff' | 'driver_diff' | 'price_type_diff' | 'unknown_data' | 'expired_price';
  title: string;
  message: string;
  severity: 'warning' | 'info' | 'caution';
}

export interface FormattedCurrencyOptions {
  emptyText?: string;
  showCurrency?: boolean;
}
