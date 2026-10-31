import { describe, it, expect } from 'vitest';
import { searchInsuranceOptions, resolveCoverages } from '@/lib/queries/search';
import { generateComparisonWarnings } from '@/lib/queries/compare';
import { PlanVersionSchema, PriceOptionSchema, EligibilityRuleSchema } from '@/lib/validation/schemas';
import { InsuranceSearchResultItem } from '@/types/insurance';

describe('1. Search & Filtering Business Rules (Section 10)', () => {
  it('should search by Thai substring keyword for insurer and plan name', async () => {
    const resViriyah = await searchInsuranceOptions({ query: 'วิริยะ' });
    expect(resViriyah.items.length).toBeGreaterThan(0);
    expect(resViriyah.items.every((i) => i.insurerName.includes('วิริยะ'))).toBe(true);

    const resBKI = await searchInsuranceOptions({ query: 'กรุงเทพ' });
    expect(resBKI.items.length).toBeGreaterThan(0);
    expect(resBKI.items.every((i) => i.insurerName.includes('กรุงเทพ'))).toBe(true);
  });

  it('should filter strictly by insurance type (e.g. ชั้น 1 only)', async () => {
    const res = await searchInsuranceOptions({ insuranceTypes: ['ชั้น 1'] });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((i) => i.insuranceType === 'ชั้น 1')).toBe(true);
  });

  it('should filter by repair type (dealer/ห้าง vs garage/อู่)', async () => {
    const dealerRes = await searchInsuranceOptions({ repairTypes: ['dealer'] });
    expect(dealerRes.items.length).toBeGreaterThan(0);
    expect(dealerRes.items.every((i) => i.repairType === 'dealer')).toBe(true);

    const garageRes = await searchInsuranceOptions({ repairTypes: ['garage'] });
    expect(garageRes.items.length).toBeGreaterThan(0);
    expect(garageRes.items.every((i) => i.repairType === 'garage')).toBe(true);
  });

  it('should enforce required coverage filter: only plans with covered status pass (Section 10.2)', async () => {
    // Water flood (code: flood)
    const resWithFlood = await searchInsuranceOptions({ requiredCoverageCodes: ['flood'] });
    expect(resWithFlood.items.length).toBeGreaterThan(0);
    for (const item of resWithFlood.items) {
      const cov = item.coverages.find((c) => c.code === 'flood');
      expect(cov?.status).toBe('covered');
    }
  });

  it('should filter by car age and vehicle eligibility rules', async () => {
    // Vehicle older than 12 years should exclude plans with max_age < 12
    const resOldCar = await searchInsuranceOptions({ carAge: 12 });
    for (const item of resOldCar.items) {
      expect(item.minCarAge ?? 0).toBeLessThanOrEqual(12);
      expect(item.maxCarAge ?? 99).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('2. Comparison Warnings Logic (Section 11)', () => {
  const dummyItem1: InsuranceSearchResultItem = {
    id: 'opt-1',
    priceOptionLabel: 'Option 1',
    repairType: 'dealer',
    priceType: 'fixed_for_conditions',
    premiumTotal: 20000,
    compulsoryIncluded: 'excluded',
    sumInsuredMin: 500000,
    sumInsuredMax: 500000,
    deductibleAmount: 0,
    planId: 'plan-1',
    planName: 'Plan 1',
    insuranceType: 'ชั้น 1',
    insurerId: 'ins-1',
    insurerName: 'Insurer A',
    planVersionId: 'ver-1',
    versionNo: 1,
    workflowStatus: 'published',
    eligibilityRuleId: 'rule-1',
    scopeType: 'all_models',
    coverages: [],
    documents: [],
  };

  const dummyItem2: InsuranceSearchResultItem = {
    ...dummyItem1,
    id: 'opt-2',
    priceOptionLabel: 'Option 2',
    repairType: 'garage', // Different repair type!
    sumInsuredMin: 400000, // Different sum insured!
    sumInsuredMax: 400000,
    deductibleAmount: 3000, // Different deductible!
  };

  it('should generate warnings for differing sum insured, repair type, and deductible', () => {
    const warnings = generateComparisonWarnings([dummyItem1, dummyItem2]);
    const types = warnings.map((w) => w.type);

    expect(types).toContain('sum_insured_diff');
    expect(types).toContain('repair_type_diff');
    expect(types).toContain('deductible_diff');
  });

  it('should warn when any option has unknown/missing price (Section 9.3)', () => {
    const itemWithNullPrice: InsuranceSearchResultItem = {
      ...dummyItem1,
      id: 'opt-3',
      premiumTotal: null,
    };

    const warnings = generateComparisonWarnings([dummyItem1, itemWithNullPrice]);
    const types = warnings.map((w) => w.type);
    expect(types).toContain('unknown_data');
  });
});

describe('3. Zod Schemas & Data Constraints Validation (Section 8.4)', () => {
  it('should reject invalid dates where effective_to is before effective_from', () => {
    const result = PlanVersionSchema.safeParse({
      plan_id: '11111111-1111-1111-1111-111111111111',
      version_no: 1,
      effective_from: '2026-12-31',
      effective_to: '2026-01-01', // Invalid!
    });
    expect(result.success).toBe(false);
  });

  it('should reject sum_insured_max that is lower than sum_insured_min', () => {
    const result = PriceOptionSchema.safeParse({
      eligibility_rule_id: '11111111-1111-1111-1111-111111111111',
      label: 'Test Option',
      repair_type: 'garage',
      price_type: 'fixed_for_conditions',
      sum_insured_min: 500000,
      sum_insured_max: 300000, // Invalid!
    });
    expect(result.success).toBe(false);
  });

  it('should require vehicle_model_id when scope_type is specific_model', () => {
    const result = EligibilityRuleSchema.safeParse({
      plan_version_id: '11111111-1111-1111-1111-111111111111',
      scope_type: 'specific_model',
      vehicle_model_id: null, // Invalid for specific_model!
    });
    expect(result.success).toBe(false);
  });
});

describe('4. Versioning & Search Deduplication Rules (Section 12.3)', () => {
  it('should only show options from the latest published version of any plan in search results', async () => {
    const res = await searchInsuranceOptions();
    // Group all returned options by planId
    const planVersionMap = new Map<string, Set<number>>();
    for (const item of res.items) {
      if (!planVersionMap.has(item.planId)) {
        planVersionMap.set(item.planId, new Set());
      }
      planVersionMap.get(item.planId)!.add(item.versionNo);
    }

    // Every plan must have exactly 1 active versionNo appearing in search results
    for (const [planId, versionNos] of planVersionMap.entries()) {
      expect(
        versionNos.size,
        `Plan ${planId} has options from multiple version numbers: ${Array.from(versionNos).join(', ')}`
      ).toBe(1);
    }
  });
});
