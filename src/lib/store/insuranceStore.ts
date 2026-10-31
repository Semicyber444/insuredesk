import {
  Insurer,
  Plan,
  PlanVersion,
  EligibilityRule,
  PriceOption,
  VersionCoverage,
  OptionCoverageOverride,
  SourceDocument,
  AuditLog,
  VehicleModel,
  CoverageType
} from '@/types/database';
import {
  MOCK_INSURERS,
  MOCK_PLANS,
  MOCK_PLAN_VERSIONS,
  MOCK_ELIGIBILITY_RULES,
  MOCK_PRICE_OPTIONS,
  MOCK_VERSION_COVERAGES,
  MOCK_OPTION_COVERAGE_OVERRIDES,
  MOCK_SOURCE_DOCUMENTS,
  MOCK_AUDIT_LOGS,
  MOCK_VEHICLE_MODELS,
  MOCK_COVERAGE_TYPES
} from '@/lib/queries/mockData';

const STORAGE_KEYS = {
  INSURERS: 'insuredesk_insurers_v1',
  PLANS: 'insuredesk_plans_v1',
  VERSIONS: 'insuredesk_versions_v1',
  RULES: 'insuredesk_rules_v1',
  OPTIONS: 'insuredesk_options_v1',
  COVERAGES: 'insuredesk_coverages_v1',
  OVERRIDES: 'insuredesk_overrides_v1',
  DOCUMENTS: 'insuredesk_documents_v1',
  AUDIT: 'insuredesk_audit_v1',
  VEHICLES: 'insuredesk_vehicles_v1',
};

// Helper to load or initialize from localStorage
function loadFromStorage<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') return defaultData;
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(item);
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return defaultData;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

export class InsuranceStore {
  // 1. Insurers
  static getInsurers(): Insurer[] {
    return loadFromStorage(STORAGE_KEYS.INSURERS, MOCK_INSURERS);
  }

  static saveInsurer(data: Partial<Insurer> & { name: string }): Insurer {
    const insurers = this.getInsurers();
    if (data.id) {
      // Edit existing
      const index = insurers.findIndex((i) => i.id === data.id);
      if (index !== -1) {
        insurers[index] = {
          ...insurers[index],
          ...data,
          updated_at: new Date().toISOString(),
        } as Insurer;
        saveToStorage(STORAGE_KEYS.INSURERS, insurers);
        return insurers[index];
      }
    }

    // Create new
    const newInsurer: Insurer = {
      id: data.id || `ins-${Date.now()}`,
      name: data.name,
      contact_channels: data.contact_channels || null,
      website: data.website || null,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    insurers.unshift(newInsurer);
    saveToStorage(STORAGE_KEYS.INSURERS, insurers);
    return newInsurer;
  }

  static deleteInsurer(id: string): void {
    const insurers = this.getInsurers().filter((i) => i.id !== id);
    saveToStorage(STORAGE_KEYS.INSURERS, insurers);
  }

  // 2. Plans & Versions
  static getPlans(): Plan[] {
    return loadFromStorage(STORAGE_KEYS.PLANS, MOCK_PLANS);
  }

  static getVersions(): PlanVersion[] {
    const versions = loadFromStorage(STORAGE_KEYS.VERSIONS, MOCK_PLAN_VERSIONS);

    // Auto-heal / migration: Ensure each plan has at most ONE 'published' version
    // If a plan has multiple published versions, retain only the one with the highest version_no
    let modified = false;
    const planVersionsMap = new Map<string, PlanVersion[]>();
    for (const v of versions) {
      const list = planVersionsMap.get(v.plan_id) || [];
      list.push(v);
      planVersionsMap.set(v.plan_id, list);
    }

    for (const [, vList] of planVersionsMap.entries()) {
      const publishedList = vList.filter((v) => v.workflow_status === 'published');
      if (publishedList.length > 1) {
        // Sort descending by version_no
        publishedList.sort((a, b) => b.version_no - a.version_no);
        // publishedList[0] stays published; others become archived
        for (let i = 1; i < publishedList.length; i++) {
          publishedList[i].workflow_status = 'archived';
          publishedList[i].updated_at = new Date().toISOString();
          modified = true;
        }
      }
    }

    if (modified) {
      saveToStorage(STORAGE_KEYS.VERSIONS, versions);
    }

    return versions;
  }

  static getEligibilityRules(): EligibilityRule[] {
    return loadFromStorage(STORAGE_KEYS.RULES, MOCK_ELIGIBILITY_RULES);
  }

  static getPriceOptions(): PriceOption[] {
    return loadFromStorage(STORAGE_KEYS.OPTIONS, MOCK_PRICE_OPTIONS);
  }

  static getVersionCoverages(): VersionCoverage[] {
    const coverages = loadFromStorage(STORAGE_KEYS.COVERAGES, MOCK_VERSION_COVERAGES);
    const accType = MOCK_COVERAGE_TYPES.find((t) => t.code === 'accessories');

    if (accType) {
      let modified = false;
      const versions = this.getVersions();
      const plans = this.getPlans();

      for (const v of versions) {
        const hasAcc = coverages.some(
          (c) => c.plan_version_id === v.id && c.coverage_type_id === accType.id
        );
        if (!hasAcc) {
          const plan = plans.find((p) => p.id === v.plan_id);
          const isCovered = !plan || plan.insurance_type === 'ชั้น 1' || plan.insurance_type.includes('2+');
          coverages.push({
            id: `vc-${v.id}-accessories`,
            plan_version_id: v.id,
            coverage_type_id: accType.id,
            status: isCovered ? 'covered' : 'optional',
            limit_amount: 20000,
            limit_basis: 'ต่อครั้ง (ตามที่แจ้งไว้)',
            deductible_amount: 0,
            terms: 'คุ้มครองอุปกรณ์ตกแต่งตามที่แจ้งไว้ไม่เกิน 20,000 บาท',
            exclusions: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          modified = true;
        }
      }

      if (modified) {
        saveToStorage(STORAGE_KEYS.COVERAGES, coverages);
      }
    }

    return coverages;
  }

  static getOverrides(): OptionCoverageOverride[] {
    return loadFromStorage(STORAGE_KEYS.OVERRIDES, MOCK_OPTION_COVERAGE_OVERRIDES);
  }

  static getDocuments(): SourceDocument[] {
    return loadFromStorage(STORAGE_KEYS.DOCUMENTS, MOCK_SOURCE_DOCUMENTS);
  }

  static getAuditLogs(): AuditLog[] {
    return loadFromStorage(STORAGE_KEYS.AUDIT, MOCK_AUDIT_LOGS);
  }

  static getVehicleModels(): VehicleModel[] {
    return loadFromStorage(STORAGE_KEYS.VEHICLES, MOCK_VEHICLE_MODELS);
  }

  static getCoverageTypes(): CoverageType[] {
    return MOCK_COVERAGE_TYPES;
  }

  // Comprehensive Create or Edit Plan
  static createOrUpdatePlan(payload: {
    planId?: string;
    versionId?: string;
    insurerId: string;
    name: string;
    insuranceType: any;
    workflowStatus?: 'draft' | 'in_review' | 'published';
    notes?: string;
    // Eligibility
    scopeType?: 'all_models' | 'specific_model';
    vehicleModelId?: string | null;
    minCarAge?: number;
    maxCarAge?: number;
    usageType?: string;
    inspectionRequired?: boolean;
    // Price Options (supports multiple tiers for same plan)
    priceOptions?: {
      id?: string;
      label?: string;
      repairType: 'dealer' | 'garage';
      priceType?: 'fixed_for_conditions' | 'starting' | 'indicative' | 'unknown';
      premiumTotal?: number | null;
      sumInsuredMin?: number | null;
      sumInsuredMax?: number | null;
      deductibleAmount?: number;
      deductibleTerms?: string;
      driverConditions?: string;
      compulsoryIncluded?: 'included' | 'excluded' | 'unspecified';
    }[];
    priceOptionLabel?: string;
    repairType?: 'dealer' | 'garage';
    priceType?: 'fixed_for_conditions' | 'starting' | 'indicative' | 'unknown';
    premiumTotal?: number | null;
    sumInsuredMin?: number | null;
    sumInsuredMax?: number | null;
    deductibleAmount?: number;
    deductibleTerms?: string;
    driverConditions?: string;
    compulsoryIncluded?: 'included' | 'excluded' | 'unspecified';
    // Coverages
    coverages?: {
      code: string;
      status: 'covered' | 'not_covered' | 'optional' | 'unknown';
      limitAmount?: number | null;
      limitBasis?: string;
      terms?: string;
    }[];
    // Document
    documentTitle?: string;
    documentRef?: string;
  }): { plan: Plan; version: PlanVersion } {
    const plans = this.getPlans();
    const versions = this.getVersions();
    const rules = this.getEligibilityRules();
    const options = this.getPriceOptions();
    const coverages = this.getVersionCoverages();
    const docs = this.getDocuments();
    const auditLogs = this.getAuditLogs();

    const isEdit = !!payload.planId;
    const planId = payload.planId || `plan-${Date.now()}`;
    const versionId = payload.versionId || `ver-${Date.now()}`;
    const existingRule = rules.find((r) => r.plan_version_id === versionId);
    const ruleId = existingRule ? existingRule.id : `rule-${Date.now()}`;
    const optionId = `opt-${Date.now()}`;

    // 1. Update or Create Plan
    let plan: Plan;
    if (isEdit) {
      const pIdx = plans.findIndex((p) => p.id === planId);
      if (pIdx !== -1) {
        plans[pIdx] = {
          ...plans[pIdx],
          insurer_id: payload.insurerId,
          name: payload.name,
          insurance_type: payload.insuranceType,
          updated_at: new Date().toISOString(),
        };
        plan = plans[pIdx];
      } else {
        plan = {
          id: planId,
          insurer_id: payload.insurerId,
          name: payload.name,
          insurance_type: payload.insuranceType,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        plans.unshift(plan);
      }
    } else {
      plan = {
        id: planId,
        insurer_id: payload.insurerId,
        name: payload.name,
        insurance_type: payload.insuranceType,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      plans.unshift(plan);
    }
    saveToStorage(STORAGE_KEYS.PLANS, plans);

    // 2. Update or Create Version
    let version: PlanVersion;
    const vIdx = versions.findIndex((v) => v.id === versionId);
    const targetStatus = payload.workflowStatus || 'published';

    if (vIdx !== -1) {
      versions[vIdx] = {
        ...versions[vIdx],
        workflow_status: targetStatus,
        notes: payload.notes || versions[vIdx].notes,
        updated_at: new Date().toISOString(),
      };
      version = versions[vIdx];
    } else {
      const existingPlanVersions = versions.filter((v) => v.plan_id === planId);
      const maxVerNo = existingPlanVersions.reduce((max, v) => Math.max(max, v.version_no), 0);
      version = {
        id: versionId,
        plan_id: planId,
        version_no: maxVerNo + 1,
        workflow_status: targetStatus,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        verified_at: targetStatus === 'published' ? new Date().toISOString() : null,
        review_due_at: '2026-12-31',
        notes: payload.notes || 'บันทึกข้อมูลแพ็กเกจใหม่',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      versions.unshift(version);
    }

    // Versioning rule: If this version is published, archive any other published versions of this plan
    if (targetStatus === 'published') {
      for (const v of versions) {
        if (v.plan_id === planId && v.id !== version.id && v.workflow_status === 'published') {
          v.workflow_status = 'archived';
          v.updated_at = new Date().toISOString();
        }
      }
    }

    saveToStorage(STORAGE_KEYS.VERSIONS, versions);

    // 3. Eligibility Rule
    // Remove existing rule for this version if editing
    const cleanRules = rules.filter((r) => r.plan_version_id !== versionId);
    const newRule: EligibilityRule = {
      id: ruleId,
      plan_version_id: versionId,
      scope_type: payload.scopeType || 'all_models',
      vehicle_model_id: payload.vehicleModelId || null,
      min_age: payload.minCarAge ?? 1,
      max_age: payload.maxCarAge ?? 10,
      age_basis: 'registration_year',
      usage_type: (payload.usageType as any) || 'private',
      inspection_required: payload.inspectionRequired ?? false,
      notes: payload.scopeType === 'specific_model' ? 'เงื่อนไขเฉพาะรุ่นรถที่ระบุ' : 'รถยนต์ทั่วไปตามเงื่อนไขอายุรถ',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    cleanRules.push(newRule);
    saveToStorage(STORAGE_KEYS.RULES, cleanRules);

    // 4. Price Options (supports multiple price options / tiers per package)
    let cleanOptions = options.filter((o) => o.eligibility_rule_id !== ruleId);
    if (payload.priceOptions && payload.priceOptions.length > 0) {
      for (let i = 0; i < payload.priceOptions.length; i++) {
        const po = payload.priceOptions[i];
        cleanOptions.push({
          id: po.id || `opt-${Date.now()}-${i}`,
          eligibility_rule_id: ruleId,
          label: po.label || `${po.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${(po.sumInsuredMax || 0).toLocaleString()} บาท`,
          repair_type: po.repairType,
          price_type: po.priceType || 'fixed_for_conditions',
          premium_total: po.premiumTotal ?? null,
          sum_insured_min: po.sumInsuredMin ?? po.sumInsuredMax ?? 500000,
          sum_insured_max: po.sumInsuredMax ?? 500000,
          deductible_amount: po.deductibleAmount ?? 0,
          deductible_terms: po.deductibleTerms || (po.deductibleAmount ? `มีค่าเสียหายส่วนแรก ฿${po.deductibleAmount} กรณีเป็นฝ่ายผิด` : null),
          driver_conditions: po.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่',
          compulsory_included: po.compulsoryIncluded || 'excluded',
          valid_from: '2026-01-01',
          valid_to: '2026-12-31',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      const newOption: PriceOption = {
        id: optionId,
        eligibility_rule_id: ruleId,
        label: payload.priceOptionLabel || `${payload.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${payload.sumInsuredMax?.toLocaleString() || 'ตามเงื่อนไข'}`,
        repair_type: payload.repairType || 'garage',
        price_type: payload.priceType || 'fixed_for_conditions',
        premium_total: payload.premiumTotal ?? null,
        sum_insured_min: payload.sumInsuredMin ?? payload.sumInsuredMax ?? 500000,
        sum_insured_max: payload.sumInsuredMax ?? 500000,
        deductible_amount: payload.deductibleAmount ?? 0,
        deductible_terms: payload.deductibleTerms || (payload.deductibleAmount ? `มีค่าเสียหายส่วนแรก ฿${payload.deductibleAmount} กรณีเป็นฝ่ายผิด` : null),
        driver_conditions: payload.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่',
        compulsory_included: payload.compulsoryIncluded || 'excluded',
        valid_from: '2026-01-01',
        valid_to: '2026-12-31',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      cleanOptions.unshift(newOption);
    }
    saveToStorage(STORAGE_KEYS.OPTIONS, cleanOptions);

    // 5. Version Coverages
    const cleanCoverages = coverages.filter((c) => c.plan_version_id !== versionId);
    if (payload.coverages && payload.coverages.length > 0) {
      for (const cov of payload.coverages) {
        const type = MOCK_COVERAGE_TYPES.find((t) => t.code === cov.code);
        if (type) {
          cleanCoverages.push({
            id: `vc-${Date.now()}-${type.code}`,
            plan_version_id: versionId,
            coverage_type_id: type.id,
            status: cov.status,
            limit_amount: cov.limitAmount ?? null,
            limit_basis: cov.limitBasis || (cov.limitAmount ? 'ต่อครั้ง' : 'ตามทุนประกัน'),
            deductible_amount: 0,
            terms: cov.terms || null,
            exclusions: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // Default standard coverages based on insurance type
      const isType1 = payload.insuranceType === 'ชั้น 1';
      for (const type of MOCK_COVERAGE_TYPES) {
        let status: 'covered' | 'not_covered' | 'optional' = 'covered';
        let limitAmount: number | null = null;
        let limitBasis = 'ตามทุนประกัน';

        if (type.code === 'flood' || type.code === 'theft_fire' || type.code === 'own_damage') {
          status = isType1 ? 'covered' : (payload.insuranceType.includes('2+') ? 'covered' : 'not_covered');
        } else if (type.code === 'tp_life_person') {
          limitAmount = 1000000;
          limitBasis = 'ต่อคน';
        } else if (type.code === 'tp_property') {
          limitAmount = 2500000;
          limitBasis = 'ต่อครั้ง';
        } else if (type.code === 'loss_of_use') {
          status = 'optional';
          limitBasis = 'ซื้อความคุ้มครองเสริม';
        } else if (type.code === 'accessories') {
          status = isType1 || payload.insuranceType.includes('2+') ? 'covered' : 'optional';
          limitAmount = 20000;
          limitBasis = 'ต่อครั้ง (ตามที่แจ้งไว้)';
        }

        cleanCoverages.push({
          id: `vc-${Date.now()}-${type.code}`,
          plan_version_id: versionId,
          coverage_type_id: type.id,
          status,
          limit_amount: limitAmount,
          limit_basis: limitBasis,
          deductible_amount: 0,
          terms: null,
          exclusions: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    saveToStorage(STORAGE_KEYS.COVERAGES, cleanCoverages);

    // 6. Source Document if provided
    if (payload.documentTitle) {
      docs.unshift({
        id: `doc-${Date.now()}`,
        plan_version_id: versionId,
        source_type: 'rate_sheet',
        storage_path: `documents/${planId}/spec_sheet.pdf`,
        source_url: null,
        title: payload.documentTitle,
        file_size: 1048576,
        mime_type: 'application/pdf',
        page_reference: payload.documentRef || 'หน้า 1 ตารางอัตราเบี้ย',
        received_at: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
        created_by: null,
      });
      saveToStorage(STORAGE_KEYS.DOCUMENTS, docs);
    }

    // 7. Audit Log
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: 'ผู้ใช้งาน',
      action: isEdit ? 'update' : 'create',
      entity_type: 'plan_version',
      entity_id: versionId,
      before_data: isEdit ? { action: 'edit' } : null,
      after_data: { plan_name: payload.name, status: payload.workflowStatus || 'published' },
      reason: isEdit ? 'แก้ไขข้อมูลแพ็กเกจและเงื่อนไข' : 'สร้างข้อมูลแพ็กเกจและเผยแพร่',
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);

    return { plan, version };
  }

  // Delete Plan
  static deletePlan(planId: string): void {
    const plans = this.getPlans().filter((p) => p.id !== planId);
    saveToStorage(STORAGE_KEYS.PLANS, plans);
  }
}
