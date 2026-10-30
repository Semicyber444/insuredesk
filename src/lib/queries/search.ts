import {
  CoverageResolvedItem,
  InsuranceSearchResultItem,
  SearchFilters
} from '@/types/insurance';
import {
  MOCK_COVERAGE_TYPES,
  MOCK_ELIGIBILITY_RULES,
  MOCK_INSURERS,
  MOCK_OPTION_COVERAGE_OVERRIDES,
  MOCK_PLANS,
  MOCK_PLAN_VERSIONS,
  MOCK_PRICE_OPTIONS,
  MOCK_SOURCE_DOCUMENTS,
  MOCK_VEHICLE_MODELS,
  MOCK_VERSION_COVERAGES
} from './mockData';

// Helper to resolve coverages for a given price_option and plan_version
export function resolveCoverages(
  planVersionId: string,
  priceOptionId: string
): CoverageResolvedItem[] {
  const versionCoverages = MOCK_VERSION_COVERAGES.filter(
    (vc) => vc.plan_version_id === planVersionId
  );
  const overrides = MOCK_OPTION_COVERAGE_OVERRIDES.filter(
    (o) => o.price_option_id === priceOptionId
  );

  return MOCK_COVERAGE_TYPES.map((type) => {
    const override = overrides.find((o) => o.coverage_type_id === type.id);
    if (override) {
      return {
        coverageTypeId: type.id,
        code: type.code,
        name: type.name,
        category: type.category,
        status: override.status,
        limitAmount: override.limit_amount,
        limitBasis: override.limit_basis,
        deductibleAmount: override.deductible_amount,
        terms: override.terms,
        exclusions: override.exclusions,
        isOverridden: true,
      };
    }

    const base = versionCoverages.find((vc) => vc.coverage_type_id === type.id);
    return {
      coverageTypeId: type.id,
      code: type.code,
      name: type.name,
      category: type.category,
      status: base?.status ?? 'unknown',
      limitAmount: base?.limit_amount,
      limitBasis: base?.limit_basis,
      deductibleAmount: base?.deductible_amount,
      terms: base?.terms,
      exclusions: base?.exclusions,
      isOverridden: false,
    };
  }).sort((a, b) => {
    const typeA = MOCK_COVERAGE_TYPES.find((t) => t.id === a.coverageTypeId)?.sort_order ?? 99;
    const typeB = MOCK_COVERAGE_TYPES.find((t) => t.id === b.coverageTypeId)?.sort_order ?? 99;
    return typeA - typeB;
  });
}

// Convert price options into full search result view
export function buildSearchResultItems(): InsuranceSearchResultItem[] {
  const results: InsuranceSearchResultItem[] = [];

  for (const option of MOCK_PRICE_OPTIONS) {
    const rule = MOCK_ELIGIBILITY_RULES.find((r) => r.id === option.eligibility_rule_id);
    if (!rule) continue;

    const version = MOCK_PLAN_VERSIONS.find((v) => v.id === rule.plan_version_id);
    if (!version || version.workflow_status !== 'published') continue;

    const plan = MOCK_PLANS.find((p) => p.id === version.plan_id);
    if (!plan || plan.is_archived) continue;

    const insurer = MOCK_INSURERS.find((i) => i.id === plan.insurer_id);
    if (!insurer || !insurer.is_active) continue;

    const vehicle = rule.vehicle_model_id
      ? MOCK_VEHICLE_MODELS.find((v) => v.id === rule.vehicle_model_id)
      : null;

    const coverages = resolveCoverages(version.id, option.id);
    const documents = MOCK_SOURCE_DOCUMENTS.filter((d) => d.plan_version_id === version.id);

    results.push({
      id: option.id,
      priceOptionLabel: option.label,
      repairType: option.repair_type,
      priceType: option.price_type,
      premiumTotal: option.premium_total,
      netPremium: option.net_premium,
      taxStamp: option.tax_stamp,
      compulsoryIncluded: option.compulsory_included,
      sumInsuredMin: option.sum_insured_min,
      sumInsuredMax: option.sum_insured_max,
      deductibleAmount: option.deductible_amount,
      deductibleTerms: option.deductible_terms,
      driverConditions: option.driver_conditions,
      priceValidFrom: option.valid_from,
      priceValidTo: option.valid_to,

      planId: plan.id,
      planName: plan.name,
      insuranceType: plan.insurance_type,

      insurerId: insurer.id,
      insurerName: insurer.name,
      insurerWebsite: insurer.website,

      planVersionId: version.id,
      versionNo: version.version_no,
      workflowStatus: version.workflow_status,
      verifiedAt: version.verified_at,
      reviewDueAt: version.review_due_at,

      eligibilityRuleId: rule.id,
      scopeType: rule.scope_type,
      vehicleModelId: rule.vehicle_model_id,
      vehicleBrand: vehicle?.brand,
      vehicleModel: vehicle?.model,
      vehicleVariant: vehicle?.variant,
      minCarAge: rule.min_age,
      maxCarAge: rule.max_age,
      usageType: rule.usage_type,
      inspectionRequired: rule.inspection_required,

      coverages,
      documents,
    });
  }

  return results;
}

export async function searchInsuranceOptions(filters: SearchFilters = {}) {
  const allItems = buildSearchResultItems();

  const filtered = allItems.filter((item) => {
    // 1. Text Search (Insurer name, Plan name, Option label)
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase().trim();
      const matchInsurer = item.insurerName.toLowerCase().includes(q);
      const matchPlan = item.planName.toLowerCase().includes(q);
      const matchLabel = item.priceOptionLabel.toLowerCase().includes(q);
      const matchVehicle = (item.vehicleBrand + ' ' + item.vehicleModel).toLowerCase().includes(q);
      if (!matchInsurer && !matchPlan && !matchLabel && !matchVehicle) {
        return false;
      }
    }

    // 2. Insurer Filter (Multi-select OR)
    if (filters.insurerIds && filters.insurerIds.length > 0) {
      if (!filters.insurerIds.includes(item.insurerId)) {
        return false;
      }
    }

    // 3. Insurance Types (Multi-select OR)
    if (filters.insuranceTypes && filters.insuranceTypes.length > 0) {
      if (!filters.insuranceTypes.includes(item.insuranceType)) {
        return false;
      }
    }

    // 4. Repair Types (Dealer / Garage)
    if (filters.repairTypes && filters.repairTypes.length > 0) {
      if (!filters.repairTypes.includes(item.repairType)) {
        return false;
      }
    }

    // 5. Vehicle Scope & Car Age
    if (filters.vehicleModelId) {
      if (item.scopeType === 'specific_model' && item.vehicleModelId !== filters.vehicleModelId) {
        return false;
      }
    }

    if (filters.carAge !== undefined && filters.carAge !== null) {
      const minAge = item.minCarAge ?? 0;
      const maxAge = item.maxCarAge ?? 999;
      if (filters.carAge < minAge || filters.carAge > maxAge) {
        return false;
      }
    }

    // 6. Usage Type
    if (filters.usageType && filters.usageType !== 'all') {
      if (item.usageType && item.usageType !== 'all' && item.usageType !== filters.usageType) {
        return false;
      }
    }

    // 7. Premium Range (Section 10.2: Unknown price excluded unless requested)
    if (item.premiumTotal === null || item.premiumTotal === undefined) {
      if (!filters.includeUnknownPrice) {
        if (filters.minPremium !== undefined || filters.maxPremium !== undefined) {
          return false;
        }
      }
    } else {
      if (filters.minPremium !== undefined && item.premiumTotal < filters.minPremium) {
        return false;
      }
      if (filters.maxPremium !== undefined && item.premiumTotal > filters.maxPremium) {
        return false;
      }
    }

    // 8. Sum Insured Range
    if (filters.minSumInsured !== undefined) {
      const sumMax = item.sumInsuredMax ?? item.sumInsuredMin ?? 0;
      if (sumMax < filters.minSumInsured) return false;
    }
    if (filters.maxSumInsured !== undefined) {
      const sumMin = item.sumInsuredMin ?? 0;
      if (sumMin > filters.maxSumInsured) return false;
    }

    // 9. Required Coverages (Section 10.2: ALL must be 'covered', NOT optional)
    if (filters.requiredCoverageCodes && filters.requiredCoverageCodes.length > 0) {
      for (const reqCode of filters.requiredCoverageCodes) {
        const cov = item.coverages.find((c) => c.code === reqCode);
        if (!cov || cov.status !== 'covered') {
          return false;
        }
      }
    }

    // 10. Check if expired
    if (item.priceValidTo) {
      const today = new Date().toISOString().slice(0, 10);
      if (item.priceValidTo < today) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'premium_asc':
        return (a.premiumTotal ?? 999999999) - (b.premiumTotal ?? 999999999);
      case 'premium_desc':
        return (b.premiumTotal ?? 0) - (a.premiumTotal ?? 0);
      case 'sum_insured_desc':
        return (b.sumInsuredMax ?? 0) - (a.sumInsuredMax ?? 0);
      case 'name_asc':
      default:
        return a.insurerName.localeCompare(b.insurerName, 'th');
    }
  });

  // Pagination
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    items: paginatedItems,
    totalCount,
    page,
    totalPages,
    pageSize,
  };
}

// Single option lookup
export async function getPriceOptionById(priceOptionId: string): Promise<InsuranceSearchResultItem | null> {
  const all = buildSearchResultItems();
  return all.find((item) => item.id === priceOptionId) ?? null;
}
