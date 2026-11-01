import {
  CoverageResolvedItem,
  InsuranceSearchResultItem,
  SearchFilters,
  formatRegistrationZoneLabel,
} from '@/types/insurance';
import { InsuranceStore, getBangkokDateString } from '@/lib/store/insuranceStore';

// Helper to resolve coverages for a given price_option and plan_version
export function resolveCoverages(
  planVersionId: string,
  priceOptionId: string
): CoverageResolvedItem[] {
  const versionCoverages = InsuranceStore.getVersionCoverages().filter(
    (vc) => vc.plan_version_id === planVersionId
  );
  const overrides = InsuranceStore.getOverrides().filter(
    (o) => o.price_option_id === priceOptionId
  );
  const coverageTypes = InsuranceStore.getCoverageTypes();

  return coverageTypes.map((type) => {
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
    const typeA = coverageTypes.find((t) => t.id === a.coverageTypeId)?.sort_order ?? 99;
    const typeB = coverageTypes.find((t) => t.id === b.coverageTypeId)?.sort_order ?? 99;
    return typeA - typeB;
  });
}

// Convert price options into full search result view
export function buildSearchResultItems(): InsuranceSearchResultItem[] {
  const results: InsuranceSearchResultItem[] = [];

  const priceOptions = InsuranceStore.getPriceOptions();
  const rules = InsuranceStore.getEligibilityRules();
  const versions = InsuranceStore.getVersions();
  const plans = InsuranceStore.getPlans();
  const insurers = InsuranceStore.getInsurers();
  const vehicleModels = InsuranceStore.getVehicleModels();
  const allDocuments = InsuranceStore.getDocuments();

  // Find the latest active published version for each plan (Section 12.3)
  const latestPublishedVersionByPlan = new Map<string, string>();
  for (const plan of plans) {
    if (plan.is_archived) continue;
    const planPublishedVersions = versions
      .filter((v) => v.plan_id === plan.id && v.workflow_status === 'published')
      .sort((a, b) => b.version_no - a.version_no);
    if (planPublishedVersions.length > 0) {
      latestPublishedVersionByPlan.set(plan.id, planPublishedVersions[0].id);
    }
  }

  for (const option of priceOptions) {
    const rule = rules.find((r) => r.id === option.eligibility_rule_id);
    if (!rule) continue;

    const version = versions.find((v) => v.id === rule.plan_version_id);
    if (!version || version.workflow_status !== 'published') continue;

    const plan = plans.find((p) => p.id === version.plan_id);
    if (!plan || plan.is_archived) continue;

    // Strict versioning rule: Only show price options belonging to the latest published version of this plan
    const activeVersionId = latestPublishedVersionByPlan.get(plan.id);
    if (!activeVersionId || version.id !== activeVersionId) continue;

    const insurer = insurers.find((i) => i.id === plan.insurer_id);
    if (!insurer || !insurer.is_active) continue;

    const vehicle = rule.vehicle_model_id
      ? vehicleModels.find((v) => v.id === rule.vehicle_model_id)
      : null;

    const coverages = resolveCoverages(version.id, option.id);
    const documents = allDocuments.filter((d) => d.plan_version_id === version.id);

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
      versionEffectiveFrom: version.effective_from,
      versionEffectiveTo: version.effective_to,
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
      ageBasis: rule.age_basis,
      usageType: rule.usage_type,
      registrationZone: rule.registration_zone ?? 'all',
      inspectionRequired: rule.inspection_required,

      coverages,
      documents,
    });
  }

  return results;
}

export async function searchInsuranceOptions(filters: SearchFilters = {}) {
  const allItems = buildSearchResultItems();
  const today = getBangkokDateString(0);

  const filtered = allItems.filter((item) => {
    // 1. Text Search (Insurer name, Plan name, Option label, Vehicle)
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase().trim();
      const matchInsurer = item.insurerName.toLowerCase().includes(q);
      const matchPlan = item.planName.toLowerCase().includes(q);
      const matchLabel = item.priceOptionLabel.toLowerCase().includes(q);
      const vehicleText = [
        item.vehicleBrand,
        item.vehicleModel,
        item.vehicleVariant,
        formatRegistrationZoneLabel(item.registrationZone),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchVehicle = vehicleText.includes(q);
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

    // 5. Vehicle Scope & Car Age (Section 10.2: scope_type = 'unknown' must NOT match as all_models)
    if (filters.vehicleBrand) {
      if (item.scopeType === 'unknown') {
        return false;
      }
      if (item.scopeType === 'specific_model' && item.vehicleBrand !== filters.vehicleBrand) {
        return false;
      }
    }

    if (filters.vehicleModelId) {
      if (item.scopeType === 'unknown') {
        return false;
      }
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

    // 6. Usage Type & Registration Plate Zone
    if (filters.usageType && filters.usageType !== 'all') {
      if (item.usageType && item.usageType !== 'all' && item.usageType !== filters.usageType) {
        return false;
      }
    }

    if (filters.registrationPlate) {
      const zone = item.registrationZone ?? 'all';
      if (filters.registrationPlate === 'bangkok_only_strict') {
        if (zone !== 'bangkok_only') return false;
      } else if (filters.registrationPlate === 'bangkok') {
        if (zone === 'upcountry_only') return false;
      } else if (filters.registrationPlate === 'metro') {
        if (zone === 'bangkok_only' || zone === 'upcountry_only') return false;
      } else if (filters.registrationPlate === 'upcountry') {
        if (zone === 'bangkok_only' || zone === 'bangkok_metro') return false;
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

    // 8. Sum Insured Range (Never treat null/unknown sum insured as 0)
    if (filters.minSumInsured !== undefined || filters.maxSumInsured !== undefined) {
      const hasKnownSum = item.sumInsuredMax != null || item.sumInsuredMin != null;
      if (!hasKnownSum) {
        return false;
      }
      const sumMax = item.sumInsuredMax ?? item.sumInsuredMin!;
      const sumMin = item.sumInsuredMin ?? item.sumInsuredMax!;
      if (filters.minSumInsured !== undefined && sumMax < filters.minSumInsured) return false;
      if (filters.maxSumInsured !== undefined && sumMin > filters.maxSumInsured) return false;
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

    // 10. Active date window check (Asia/Bangkok YYYY-MM-DD, Section 8.1 & 10.2)
    if (item.priceValidTo && item.priceValidTo < today) return false;
    if (item.versionEffectiveTo && item.versionEffectiveTo < today) return false;
    if (item.priceValidFrom && item.priceValidFrom > today) return false;
    if (item.versionEffectiveFrom && item.versionEffectiveFrom > today) return false;

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

export async function getPriceOptionById(priceOptionId: string): Promise<InsuranceSearchResultItem | null> {
  const all = buildSearchResultItems();
  return all.find((item) => item.id === priceOptionId) ?? null;
}
