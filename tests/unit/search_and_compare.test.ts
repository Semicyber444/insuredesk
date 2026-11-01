import { describe, it, expect, beforeEach } from 'vitest';
import { searchInsuranceOptions, resolveCoverages } from '@/lib/queries/search';
import { generateComparisonWarnings, getComparisonData } from '@/lib/queries/compare';
import {
  submitForReview,
  publishPlanVersion,
  rejectPlanVersion,
  getPlanById,
} from '@/lib/queries/plans';
import { getAuditLogs } from '@/lib/queries/audit';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { PlanVersionSchema, PriceOptionSchema, EligibilityRuleSchema } from '@/lib/validation/schemas';
import { InsuranceSearchResultItem } from '@/types/insurance';

beforeEach(() => {
  InsuranceStore.resetMemoryStore();
});

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
    const resWithFlood = await searchInsuranceOptions({ requiredCoverageCodes: ['flood'] });
    expect(resWithFlood.items.length).toBeGreaterThan(0);
    for (const item of resWithFlood.items) {
      const cov = item.coverages.find((c) => c.code === 'flood');
      expect(cov?.status).toBe('covered');
    }
  });

  it('should filter by car age and vehicle eligibility rules', async () => {
    const resOldCar = await searchInsuranceOptions({ carAge: 12 });
    for (const item of resOldCar.items) {
      expect(item.minCarAge ?? 0).toBeLessThanOrEqual(12);
      expect(item.maxCarAge ?? 99).toBeGreaterThanOrEqual(12);
    }
  });

  it('should exclude scope_type = unknown when filtering by vehicleBrand or vehicleModelId (Section 10.2)', async () => {
    InsuranceStore.createOrUpdatePlan({
      insurerId: '20000000-0000-0000-0000-000000000001',
      name: 'แผนทดสอบไม่ระบุขอบเขตรถ',
      insuranceType: 'ชั้น 1',
      workflowStatus: 'published',
      scopeType: 'unknown',
      documentTitle: 'เอกสารทดสอบ Unknown Scope',
      priceOptions: [
        {
          label: 'ซ่อมอู่ - ยังไม่ระบุรุ่น',
          repairType: 'garage',
          premiumTotal: 9900,
          sumInsuredMax: 300000,
        },
      ],
    });

    const unfiltered = await searchInsuranceOptions({ query: 'แผนทดสอบไม่ระบุขอบเขตรถ' });
    expect(unfiltered.items.length).toBe(1);

    const byBrand = await searchInsuranceOptions({
      query: 'แผนทดสอบไม่ระบุขอบเขตรถ',
      vehicleBrand: 'Toyota',
    });
    expect(byBrand.items.length).toBe(0);

    const byModel = await searchInsuranceOptions({
      query: 'แผนทดสอบไม่ระบุขอบเขตรถ',
      vehicleModelId: '30000000-0000-0000-0000-000000000001',
    });
    expect(byModel.items.length).toBe(0);
  });

  it('should apply option_coverage_overrides accurately in resolveCoverages (Section 8.3)', () => {
    const coverages = resolveCoverages(
      '50000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000003'
    );
    const ownDamage = coverages.find((c) => c.code === 'own_damage');
    expect(ownDamage?.isOverridden).toBe(true);
    expect(ownDamage?.deductibleAmount).toBe(3000);
    expect(coverages.length).toBe(16);

    const rollover = coverages.find((c) => c.code === 'rollover_offroad');
    expect(rollover?.name).toBe('รถพลิกคว่ำหรือตกทาง');
    expect(rollover?.category).toBe('ตัวรถยนต์');
    expect(rollover?.status).toBe('covered');
  });

  it('should filter plans by rollover_offroad required coverage', async () => {
    const resRollover = await searchInsuranceOptions({
      requiredCoverageCodes: ['rollover_offroad'],
    });
    expect(resRollover.items.length).toBeGreaterThan(0);
    expect(
      resRollover.items.every(
        (item) => item.coverages.find((c) => c.code === 'rollover_offroad')?.status === 'covered'
      )
    ).toBe(true);
  });
});

describe('2. Comparison Warnings & Formatting Logic (Section 9 & 11)', () => {
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
    repairType: 'garage',
    sumInsuredMin: 400000,
    sumInsuredMax: 400000,
    deductibleAmount: 3000,
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

  it('should never convert null sum insured to ฿0 in sum_insured_diff warning and should flag expired_price', () => {
    const expiredNullSumItem: InsuranceSearchResultItem = {
      ...dummyItem1,
      id: 'opt-4',
      sumInsuredMin: null,
      sumInsuredMax: null,
      priceValidTo: '2020-01-01',
    };

    const warnings = generateComparisonWarnings([dummyItem1, expiredNullSumItem]);
    const sumWarn = warnings.find((w) => w.type === 'sum_insured_diff');
    expect(sumWarn).toBeDefined();
    expect(sumWarn?.message.includes('฿0')).toBe(false);

    const expiredWarn = warnings.find((w) => w.type === 'expired_price');
    expect(expiredWarn).toBeDefined();
  });

  it('should format covered items with null limits as คุ้มครอง (ยังไม่ระบุวงเงิน) (Section 9.4)', async () => {
    const { plan } = InsuranceStore.createOrUpdatePlan({
      insurerId: '20000000-0000-0000-0000-000000000001',
      name: 'แผนทดสอบไม่ระบุวงเงิน',
      insuranceType: 'ชั้น 1',
      workflowStatus: 'published',
      documentTitle: 'เอกสารอ้างอิง',
      priceOptions: [
        { label: 'Tier A', repairType: 'garage', premiumTotal: 8000, sumInsuredMax: 200000 },
        { label: 'Tier B', repairType: 'dealer', premiumTotal: 11000, sumInsuredMax: 200000 },
      ],
      coverages: [
        { code: 'own_damage', status: 'covered', limitAmount: null, limitBasis: '' },
      ],
    });

    const searchRes = await searchInsuranceOptions({ query: plan.name });
    expect(searchRes.items.length).toBe(2);

    const comp = await getComparisonData(searchRes.items.map((i) => i.id));
    const vehicleCat = comp.categories.find((c) => c.name === 'ตัวรถยนต์');
    const ownDamageRow = vehicleCat?.items.find((i) => i.code === 'own_damage');
    const firstOptionVal = ownDamageRow?.values[searchRes.items[0].id];
    expect(firstOptionVal?.text).toBe('คุ้มครอง (ยังไม่ระบุวงเงิน)');
  });
});

describe('3. Zod Schemas & Data Constraints Validation (Section 8.4)', () => {
  it('should reject invalid dates where effective_to is before effective_from', () => {
    const result = PlanVersionSchema.safeParse({
      plan_id: '11111111-1111-1111-1111-111111111111',
      version_no: 1,
      effective_from: '2026-12-31',
      effective_to: '2026-01-01',
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
      sum_insured_max: 300000,
    });
    expect(result.success).toBe(false);
  });

  it('should require vehicle_model_id when scope_type is specific_model', () => {
    const result = EligibilityRuleSchema.safeParse({
      plan_version_id: '11111111-1111-1111-1111-111111111111',
      scope_type: 'specific_model',
      vehicle_model_id: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('4. Versioning, Workflow Persistence & Archive Rules (Section 8.1 & 12)', () => {
  it('should only show options from the latest published version of any plan in search results', async () => {
    const res = await searchInsuranceOptions();
    const planVersionMap = new Map<string, Set<number>>();
    for (const item of res.items) {
      if (!planVersionMap.has(item.planId)) {
        planVersionMap.set(item.planId, new Set());
      }
      planVersionMap.get(item.planId)!.add(item.versionNo);
    }

    for (const [planId, versionNos] of planVersionMap.entries()) {
      expect(
        versionNos.size,
        `Plan ${planId} has options from multiple version numbers: ${Array.from(versionNos).join(', ')}`
      ).toBe(1);
    }
  });

  it('should persist submitForReview, rejectPlanVersion, and publishPlanVersion with audit logs and archive old versions', async () => {
    const { plan, version: v1 } = InsuranceStore.createOrUpdatePlan({
      insurerId: '20000000-0000-0000-0000-000000000001',
      name: 'แผนทดสอบ Workflow รุ่น 1',
      insuranceType: 'ชั้น 2+',
      workflowStatus: 'published',
      documentTitle: 'ตารางเบี้ยรุ่น 1',
    });

    // Create draft v2 on the same plan
    const { version: v2 } = InsuranceStore.createOrUpdatePlan({
      planId: plan.id,
      insurerId: '20000000-0000-0000-0000-000000000001',
      name: 'แผนทดสอบ Workflow รุ่น 2',
      insuranceType: 'ชั้น 2+',
      workflowStatus: 'draft',
      documentTitle: 'ตารางเบี้ยรุ่น 2',
    });

    await submitForReview(v2.id, 'ส่งตรวจรุ่น 2', 'กัญญา Editor');
    let fetched = await getPlanById(plan.id);
    expect(fetched?.versions.find((v) => v.id === v2.id)?.workflow_status).toBe('in_review');

    await rejectPlanVersion(v2.id, 'ขอแก้หมายเหตุ', 'ปวีณา Reviewer');
    fetched = await getPlanById(plan.id);
    expect(fetched?.versions.find((v) => v.id === v2.id)?.workflow_status).toBe('draft');

    await submitForReview(v2.id, 'ส่งตรวจรอบสอง', 'กัญญา Editor');
    await publishPlanVersion(v2.id, 'อนุมัติรุ่น 2', 'ปวีณา Reviewer');

    fetched = await getPlanById(plan.id);
    expect(fetched?.versions.find((v) => v.id === v2.id)?.workflow_status).toBe('published');
    // v1 must now be archived automatically!
    expect(fetched?.versions.find((v) => v.id === v1.id)?.workflow_status).toBe('archived');

    // Deleting a published plan must archive rather than hard-delete
    const delRes = InsuranceStore.deletePlan(plan.id, 'สมชาย Admin');
    expect(delRes.mode).toBe('archived');
    const archivedPlan = await getPlanById(plan.id);
    expect(archivedPlan?.is_archived).toBe(true);

    // Audit logs must include publish and archive actions
    const logs = await getAuditLogs();
    expect(logs.some((l) => l.entity_id === v2.id && l.action === 'publish')).toBe(true);
    expect(logs.some((l) => l.entity_id === plan.id && l.action === 'archive')).toBe(true);
  });

  it('should persist uploaded source document metadata (storage_path, source_url, file_size, mime_type)', async () => {
    const { plan, version } = InsuranceStore.createOrUpdatePlan({
      insurerId: '20000000-0000-0000-0000-000000000001',
      name: 'Chubb 2+ Country Road',
      insuranceType: 'ชั้น 2+',
      workflowStatus: 'published',
      sourceType: 'rate_sheet',
      documentTitle: 'Chubb 2+ Country Road Rate Sheet',
      documentRef: 'หน้า 1 ตารางอัตราเบี้ย',
      documentStoragePath: 'storage/documents/1793498200-a1b2c3d4.pdf',
      documentSourceUrl: '/api/documents/1793498200-a1b2c3d4.pdf',
      documentFileSize: 512000,
      documentMimeType: 'application/pdf',
    });

    const detail = await getPlanById(plan.id);
    expect(detail?.versions.some((v) => v.id === version.id)).toBe(true);
    const docs = InsuranceStore.getDocuments().filter((d) => d.plan_version_id === version.id);
    expect(docs.length).toBe(1);
    expect(docs[0].source_url).toBe('/api/documents/1793498200-a1b2c3d4.pdf');
    expect(docs[0].storage_path).toBe('storage/documents/1793498200-a1b2c3d4.pdf');
    expect(docs[0].file_size).toBe(512000);
    expect(docs[0].mime_type).toBe('application/pdf');
  });
});
