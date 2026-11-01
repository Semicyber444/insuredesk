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
  CoverageType,
  InsuranceType,
  WorkflowStatus,
  ScopeType,
  RegistrationZone,
  RepairType,
  PriceType,
  CompulsoryInclusion,
  CoverageStatus,
  SourceType,
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
  MOCK_COVERAGE_TYPES,
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
  COMPARE_BASKET: 'insuredesk_compare_ids_v1',
};

/**
 * Returns YYYY-MM-DD formatted in Asia/Bangkok timezone (Section 8.1)
 */
export function getBangkokDateString(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);
}

// Helper to load or initialize from localStorage (falls back to in-memory store in Node/Vitest)
const memoryStore = new Map<string, string>();

function loadFromStorage<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') {
    const mem = memoryStore.get(key);
    if (!mem) {
      const serialized = JSON.stringify(defaultData);
      memoryStore.set(key, serialized);
      return JSON.parse(serialized) as T;
    }
    return JSON.parse(mem) as T;
  }
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      const serialized = JSON.stringify(defaultData);
      localStorage.setItem(key, serialized);
      return JSON.parse(serialized) as T;
    }
    return JSON.parse(item) as T;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return defaultData;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  const serialized = JSON.stringify(data);
  if (typeof window === 'undefined') {
    memoryStore.set(key, serialized);
    return;
  }
  try {
    localStorage.setItem(key, serialized);
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

export interface CreateOrUpdatePlanPayload {
  planId?: string;
  versionId?: string;
  insurerId: string;
  name: string;
  insuranceType: InsuranceType;
  workflowStatus?: WorkflowStatus;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reviewDueAt?: string | null;
  notes?: string;
  actorName?: string;
  // Eligibility
  scopeType?: ScopeType;
  vehicleModelId?: string | null;
  minCarAge?: number | null;
  maxCarAge?: number | null;
  ageBasis?: 'registration_year' | 'manufacture_year' | null;
  usageType?: 'private' | 'commercial' | 'all' | null;
  registrationZone?: RegistrationZone | null;
  inspectionRequired?: boolean;
  // Price Options (supports multiple tiers for same plan)
  priceOptions?: {
    id?: string;
    label?: string;
    repairType: RepairType;
    priceType?: PriceType;
    premiumTotal?: number | null;
    sumInsuredMin?: number | null;
    sumInsuredMax?: number | null;
    deductibleAmount?: number;
    deductibleTerms?: string;
    driverConditions?: string;
    compulsoryIncluded?: CompulsoryInclusion;
    validFrom?: string | null;
    validTo?: string | null;
  }[];
  priceOptionLabel?: string;
  repairType?: RepairType;
  priceType?: PriceType;
  premiumTotal?: number | null;
  sumInsuredMin?: number | null;
  sumInsuredMax?: number | null;
  deductibleAmount?: number;
  deductibleTerms?: string;
  driverConditions?: string;
  compulsoryIncluded?: CompulsoryInclusion;
  // Coverages
  coverages?: {
    code: string;
    status: CoverageStatus;
    limitAmount?: number | null;
    limitBasis?: string;
    terms?: string;
    exclusions?: string;
  }[];
  // Document
  sourceType?: SourceType;
  documentTitle?: string;
  documentRef?: string;
  documentStoragePath?: string | null;
  documentSourceUrl?: string | null;
  documentFileSize?: number | null;
  documentMimeType?: string | null;
}

export class InsuranceStore {
  // Reset helper for unit tests
  static resetMemoryStore(): void {
    memoryStore.clear();
  }

  // Shared Compare Basket (2-4 option IDs)
  static getCompareBasket(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.COMPARE_BASKET);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  static setCompareBasket(ids: string[]): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(STORAGE_KEYS.COMPARE_BASKET, JSON.stringify(ids.slice(0, 4)));
    } catch {
      // Ignore storage errors
    }
  }

  // 1. Insurers
  static getInsurers(): Insurer[] {
    return loadFromStorage(STORAGE_KEYS.INSURERS, MOCK_INSURERS);
  }

  static saveInsurer(
    data: Partial<Insurer> & { name: string },
    actorName = 'ผู้ใช้งาน'
  ): Insurer {
    const insurers = this.getInsurers();
    const auditLogs = this.getAuditLogs();

    if (data.id) {
      const index = insurers.findIndex((i) => i.id === data.id);
      if (index !== -1) {
        const before = { ...insurers[index] };
        insurers[index] = {
          ...insurers[index],
          ...data,
          name: data.name.trim(),
          contact_channels: data.contact_channels?.trim() || null,
          website: data.website?.trim() || null,
          updated_at: new Date().toISOString(),
        };
        saveToStorage(STORAGE_KEYS.INSURERS, insurers);

        auditLogs.unshift({
          id: `audit-${Date.now()}`,
          actor_name: actorName,
          action: 'update',
          entity_type: 'insurer',
          entity_id: insurers[index].id,
          before_data: { name: before.name, is_active: before.is_active },
          after_data: { name: insurers[index].name, is_active: insurers[index].is_active },
          reason: `แก้ไขข้อมูลบริษัทประกันภัย "${insurers[index].name}"`,
          created_at: new Date().toISOString(),
        });
        saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
        return insurers[index];
      }
    }

    const newInsurer: Insurer = {
      id: data.id || `ins-${Date.now()}`,
      name: data.name.trim(),
      contact_channels: data.contact_channels?.trim() || null,
      website: data.website?.trim() || null,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    insurers.unshift(newInsurer);
    saveToStorage(STORAGE_KEYS.INSURERS, insurers);

    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: actorName,
      action: 'create',
      entity_type: 'insurer',
      entity_id: newInsurer.id,
      before_data: null,
      after_data: { name: newInsurer.name },
      reason: `เพิ่มบริษัทประกันภัย "${newInsurer.name}"`,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
    return newInsurer;
  }

  /**
   * Section 8.1: Never hard-delete an insurer referenced by existing plans; deactivate instead.
   */
  static deleteInsurer(id: string, actorName = 'ผู้ใช้งาน'): { mode: 'deactivated' | 'deleted' } {
    const plans = this.getPlans();
    const hasLinkedPlans = plans.some((p) => p.insurer_id === id);
    const insurers = this.getInsurers();
    const auditLogs = this.getAuditLogs();
    const target = insurers.find((i) => i.id === id);

    if (hasLinkedPlans && target) {
      target.is_active = false;
      target.updated_at = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.INSURERS, insurers);

      auditLogs.unshift({
        id: `audit-${Date.now()}`,
        actor_name: actorName,
        action: 'archive',
        entity_type: 'insurer',
        entity_id: id,
        before_data: { is_active: true },
        after_data: { is_active: false },
        reason: `ปิดการใช้งานบริษัท "${target.name}" แทนการลบ เนื่องจากมีแพ็กเกจผูกอยู่`,
        created_at: new Date().toISOString(),
      });
      saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
      return { mode: 'deactivated' };
    }

    const filtered = insurers.filter((i) => i.id !== id);
    saveToStorage(STORAGE_KEYS.INSURERS, filtered);
    if (target) {
      auditLogs.unshift({
        id: `audit-${Date.now()}`,
        actor_name: actorName,
        action: 'delete',
        entity_type: 'insurer',
        entity_id: id,
        before_data: { name: target.name },
        after_data: null,
        reason: `ลบบริษัทประกันภัย "${target.name}" ที่ยังไม่มีแพ็กเกจผูกอยู่`,
        created_at: new Date().toISOString(),
      });
      saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
    }
    return { mode: 'deleted' };
  }

  // 2. Plans & Versions
  static getPlans(): Plan[] {
    return loadFromStorage(STORAGE_KEYS.PLANS, MOCK_PLANS);
  }

  static getVersions(): PlanVersion[] {
    const versions = loadFromStorage(STORAGE_KEYS.VERSIONS, MOCK_PLAN_VERSIONS);

    // Auto-heal / migration: Ensure each plan has at most ONE 'published' version
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
        publishedList.sort((a, b) => b.version_no - a.version_no);
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
    const rolloverType = MOCK_COVERAGE_TYPES.find((t) => t.code === 'rollover_offroad');
    const standardNonType1MockVersionIds = new Set([
      '50000000-0000-0000-0000-000000000002',
      '50000000-0000-0000-0000-000000000003',
      '50000000-0000-0000-0000-000000000005',
    ]);

    if (accType || rolloverType) {
      let modified = false;
      const versions = this.getVersions();
      const plans = this.getPlans();

      for (const v of versions) {
        const plan = plans.find((p) => p.id === v.plan_id);
        const isType1 = plan?.insurance_type === 'ชั้น 1';

        if (accType) {
          const hasAcc = coverages.some(
            (c) => c.plan_version_id === v.id && c.coverage_type_id === accType.id
          );
          if (!hasAcc) {
            const isCovered = !plan || isType1 || plan.insurance_type.includes('2+');
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

        if (rolloverType) {
          const hasRollover = coverages.some(
            (c) => c.plan_version_id === v.id && c.coverage_type_id === rolloverType.id
          );
          if (!hasRollover) {
            const rolloverStatus: CoverageStatus = isType1
              ? 'covered'
              : standardNonType1MockVersionIds.has(v.id)
              ? 'not_covered'
              : 'unknown';
            coverages.push({
              id: `vc-${v.id}-rollover_offroad`,
              plan_version_id: v.id,
              coverage_type_id: rolloverType.id,
              status: rolloverStatus,
              limit_amount: null,
              limit_basis: rolloverStatus === 'covered' ? 'ตามทุนประกัน' : null,
              deductible_amount: 0,
              terms: rolloverStatus === 'covered' ? 'คุ้มครองกรณีรถพลิกคว่ำหรือตกข้างทาง' : null,
              exclusions: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            modified = true;
          }
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

  // Workflow Status Transitions with Full Persistence & Audit Logging (Section 12.2 & 12.3)
  static submitForReview(versionId: string, reason: string, actorName = 'เจ้าหน้าที่กรอกข้อมูล'): void {
    const versions = this.getVersions();
    const version = versions.find((v) => v.id === versionId);
    if (!version) throw new Error('ไม่พบรุ่นแพ็กเกจที่ระบุ');

    const beforeStatus = version.workflow_status;
    version.workflow_status = 'in_review';
    version.updated_at = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.VERSIONS, versions);

    const auditLogs = this.getAuditLogs();
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: actorName,
      action: 'submit_review',
      entity_type: 'plan_version',
      entity_id: versionId,
      before_data: { workflow_status: beforeStatus },
      after_data: { workflow_status: 'in_review' },
      reason,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
  }

  static publishPlanVersion(versionId: string, reason: string, actorName = 'ผู้ตรวจสอบ'): void {
    const versions = this.getVersions();
    const version = versions.find((v) => v.id === versionId);
    if (!version) throw new Error('ไม่พบรุ่นแพ็กเกจที่ระบุ');

    const docs = this.getDocuments().filter((d) => d.plan_version_id === versionId);
    if (docs.length === 0) {
      throw new Error('ไม่สามารถเผยแพร่ได้: ต้องแนบหรือระบุเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการ (Section 8.4)');
    }

    const now = new Date().toISOString();
    const beforeStatus = version.workflow_status;
    version.workflow_status = 'published';
    version.verified_at = now;
    version.updated_at = now;

    // Section 12.3: Archive previous published versions of the same plan atomically
    for (const other of versions) {
      if (other.plan_id === version.plan_id && other.id !== version.id && other.workflow_status === 'published') {
        other.workflow_status = 'archived';
        other.updated_at = now;
      }
    }
    saveToStorage(STORAGE_KEYS.VERSIONS, versions);

    const auditLogs = this.getAuditLogs();
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: actorName,
      action: 'publish',
      entity_type: 'plan_version',
      entity_id: versionId,
      before_data: { workflow_status: beforeStatus },
      after_data: { workflow_status: 'published', verified_at: now },
      reason,
      created_at: now,
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
  }

  static rejectPlanVersion(versionId: string, reason: string, actorName = 'ผู้ตรวจสอบ'): void {
    const versions = this.getVersions();
    const version = versions.find((v) => v.id === versionId);
    if (!version) throw new Error('ไม่พบรุ่นแพ็กเกจที่ระบุ');

    const now = new Date().toISOString();
    const beforeStatus = version.workflow_status;
    version.workflow_status = 'draft';
    version.updated_at = now;
    saveToStorage(STORAGE_KEYS.VERSIONS, versions);

    const auditLogs = this.getAuditLogs();
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: actorName,
      action: 'reject',
      entity_type: 'plan_version',
      entity_id: versionId,
      before_data: { workflow_status: beforeStatus },
      after_data: { workflow_status: 'draft' },
      reason,
      created_at: now,
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
  }

  // Comprehensive Create or Edit Plan
  static createOrUpdatePlan(payload: CreateOrUpdatePlanPayload): { plan: Plan; version: PlanVersion } {
    const plans = this.getPlans();
    const versions = this.getVersions();
    const rules = this.getEligibilityRules();
    const options = this.getPriceOptions();
    const coverages = this.getVersionCoverages();
    const docs = this.getDocuments();
    const auditLogs = this.getAuditLogs();

    const now = new Date().toISOString();
    const todayStr = getBangkokDateString(0);
    const nextYearStr = getBangkokDateString(365);

    const isEdit = Boolean(payload.planId);
    const planId = payload.planId || `plan-${Date.now()}`;
    const versionId = payload.versionId || `ver-${Date.now()}`;
    const existingRule = rules.find((r) => r.plan_version_id === versionId);
    const ruleId = existingRule ? existingRule.id : `rule-${Date.now()}`;
    const optionId = `opt-${Date.now()}`;

    // 1. Update or Create Plan
    let plan: Plan;
    const pIdx = isEdit ? plans.findIndex((p) => p.id === planId) : -1;
    if (pIdx !== -1) {
      plans[pIdx] = {
        ...plans[pIdx],
        insurer_id: payload.insurerId,
        name: payload.name.trim(),
        insurance_type: payload.insuranceType,
        updated_at: now,
      };
      plan = plans[pIdx];
    } else {
      plan = {
        id: planId,
        insurer_id: payload.insurerId,
        name: payload.name.trim(),
        insurance_type: payload.insuranceType,
        is_archived: false,
        created_at: now,
        updated_at: now,
      };
      plans.unshift(plan);
    }
    saveToStorage(STORAGE_KEYS.PLANS, plans);

    // 2. Update or Create Version
    let version: PlanVersion;
    const vIdx = versions.findIndex((v) => v.id === versionId);
    const targetStatus: WorkflowStatus = payload.workflowStatus || 'published';

    if (vIdx !== -1) {
      versions[vIdx] = {
        ...versions[vIdx],
        workflow_status: targetStatus,
        effective_from:
          payload.effectiveFrom !== undefined ? payload.effectiveFrom : versions[vIdx].effective_from,
        effective_to:
          payload.effectiveTo !== undefined ? payload.effectiveTo : versions[vIdx].effective_to,
        review_due_at:
          payload.reviewDueAt !== undefined ? payload.reviewDueAt : versions[vIdx].review_due_at,
        verified_at:
          targetStatus === 'published'
            ? versions[vIdx].verified_at || now
            : versions[vIdx].verified_at,
        notes: payload.notes !== undefined ? payload.notes : versions[vIdx].notes,
        updated_at: now,
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
        effective_from: payload.effectiveFrom ?? todayStr,
        effective_to: payload.effectiveTo ?? nextYearStr,
        verified_at: targetStatus === 'published' ? now : null,
        review_due_at: payload.reviewDueAt ?? getBangkokDateString(335),
        notes: payload.notes || 'บันทึกข้อมูลแพ็กเกจใหม่',
        created_at: now,
        updated_at: now,
      };
      versions.unshift(version);
    }

    // Versioning rule: If this version is published, archive any other published versions of this plan
    if (targetStatus === 'published') {
      for (const v of versions) {
        if (v.plan_id === planId && v.id !== version.id && v.workflow_status === 'published') {
          v.workflow_status = 'archived';
          v.updated_at = now;
        }
      }
    }

    saveToStorage(STORAGE_KEYS.VERSIONS, versions);

    // 3. Eligibility Rule
    const cleanRules = rules.filter((r) => r.plan_version_id !== versionId);
    const resolvedScope: ScopeType = payload.scopeType || 'all_models';
    const newRule: EligibilityRule = {
      id: ruleId,
      plan_version_id: versionId,
      scope_type: resolvedScope,
      vehicle_model_id: resolvedScope === 'specific_model' ? payload.vehicleModelId || null : null,
      min_age: payload.minCarAge ?? 1,
      max_age: payload.maxCarAge ?? 10,
      age_basis: payload.ageBasis !== undefined ? payload.ageBasis : existingRule?.age_basis ?? 'registration_year',
      usage_type: payload.usageType || 'private',
      registration_zone:
        payload.registrationZone !== undefined
          ? payload.registrationZone ?? 'all'
          : existingRule?.registration_zone ?? 'all',
      inspection_required: payload.inspectionRequired ?? false,
      notes:
        resolvedScope === 'specific_model'
          ? 'เงื่อนไขเฉพาะรุ่นรถที่ระบุ'
          : resolvedScope === 'unknown'
          ? 'ยังไม่ทราบขอบเขตรุ่นรถ ต้องตรวจสอบเอกสารเพิ่มเติม'
          : 'รถยนต์ทั่วไปตามเงื่อนไขอายุรถ',
      created_at: existingRule?.created_at || now,
      updated_at: now,
    };
    cleanRules.push(newRule);
    saveToStorage(STORAGE_KEYS.RULES, cleanRules);

    // 4. Price Options
    const cleanOptions = options.filter((o) => o.eligibility_rule_id !== ruleId);
    const effectiveFromDate = version.effective_from || todayStr;
    const effectiveToDate = version.effective_to || nextYearStr;

    if (payload.priceOptions && payload.priceOptions.length > 0) {
      for (let i = 0; i < payload.priceOptions.length; i++) {
        const po = payload.priceOptions[i];
        const sumMax = po.sumInsuredMax !== undefined ? po.sumInsuredMax : null;
        const sumMin = po.sumInsuredMin !== undefined ? po.sumInsuredMin : sumMax;
        cleanOptions.push({
          id: po.id || `opt-${Date.now()}-${i}`,
          eligibility_rule_id: ruleId,
          label:
            po.label?.trim() ||
            `${po.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ${
              sumMax ? `ทุน ${sumMax.toLocaleString()} บาท` : 'ยังไม่ระบุทุน'
            }`,
          repair_type: po.repairType,
          price_type: po.priceType || (po.premiumTotal != null ? 'fixed_for_conditions' : 'unknown'),
          premium_total: po.premiumTotal ?? null,
          sum_insured_min: sumMin,
          sum_insured_max: sumMax,
          deductible_amount: po.deductibleAmount ?? 0,
          deductible_terms:
            po.deductibleTerms?.trim() ||
            (po.deductibleAmount ? `มีค่าเสียหายส่วนแรก ฿${po.deductibleAmount.toLocaleString()} กรณีเป็นฝ่ายผิด` : null),
          driver_conditions: po.driverConditions?.trim() || 'ไม่จำกัดชื่อผู้ขับขี่',
          compulsory_included: po.compulsoryIncluded || 'excluded',
          valid_from: po.validFrom ?? effectiveFromDate,
          valid_to: po.validTo ?? effectiveToDate,
          created_at: now,
          updated_at: now,
        });
      }
    } else {
      const sumMax = payload.sumInsuredMax !== undefined ? payload.sumInsuredMax : 500000;
      const sumMin = payload.sumInsuredMin !== undefined ? payload.sumInsuredMin : sumMax;
      cleanOptions.unshift({
        id: optionId,
        eligibility_rule_id: ruleId,
        label:
          payload.priceOptionLabel?.trim() ||
          `${payload.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ${
            sumMax ? `ทุน ${sumMax.toLocaleString()}` : 'ยังไม่ระบุทุน'
          }`,
        repair_type: payload.repairType || 'garage',
        price_type: payload.priceType || 'fixed_for_conditions',
        premium_total: payload.premiumTotal ?? null,
        sum_insured_min: sumMin,
        sum_insured_max: sumMax,
        deductible_amount: payload.deductibleAmount ?? 0,
        deductible_terms:
          payload.deductibleTerms ||
          (payload.deductibleAmount ? `มีค่าเสียหายส่วนแรก ฿${payload.deductibleAmount.toLocaleString()} กรณีเป็นฝ่ายผิด` : null),
        driver_conditions: payload.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่',
        compulsory_included: payload.compulsoryIncluded || 'excluded',
        valid_from: effectiveFromDate,
        valid_to: effectiveToDate,
        created_at: now,
        updated_at: now,
      });
    }
    saveToStorage(STORAGE_KEYS.OPTIONS, cleanOptions);

    // 5. Version Coverages (Section 9.4: Null limit Basis must stay null, never default to 'ตามทุนประกัน')
    const prevVersionCoverages = coverages.filter((c) => c.plan_version_id === versionId);
    const cleanCoverages = coverages.filter((c) => c.plan_version_id !== versionId);
    if (payload.coverages && payload.coverages.length > 0) {
      for (const cov of payload.coverages) {
        const type = MOCK_COVERAGE_TYPES.find((t) => t.code === cov.code);
        if (type) {
          const prevCov = prevVersionCoverages.find((pc) => pc.coverage_type_id === type.id);
          cleanCoverages.push({
            id: prevCov?.id || `vc-${Date.now()}-${type.code}`,
            plan_version_id: versionId,
            coverage_type_id: type.id,
            status: cov.status,
            limit_amount: cov.limitAmount ?? null,
            limit_basis: cov.limitBasis?.trim() ? cov.limitBasis.trim() : null,
            deductible_amount: prevCov?.deductible_amount ?? 0,
            terms: cov.terms?.trim() ? cov.terms.trim() : null,
            exclusions:
              cov.exclusions !== undefined
                ? cov.exclusions.trim() || null
                : prevCov?.exclusions ?? null,
            created_at: prevCov?.created_at || now,
            updated_at: now,
          });
        }
      }
    } else {
      const isType1 = payload.insuranceType === 'ชั้น 1';
      for (const type of MOCK_COVERAGE_TYPES) {
        let status: CoverageStatus = 'covered';
        let limitAmount: number | null = null;
        let limitBasis: string | null = null;

        if (type.code === 'flood' || type.code === 'theft_fire' || type.code === 'own_damage') {
          status = isType1 || payload.insuranceType.includes('2+') ? 'covered' : 'not_covered';
          if (status === 'covered') limitBasis = 'ตามทุนประกัน';
        } else if (type.code === 'rollover_offroad') {
          status = isType1 ? 'covered' : 'not_covered';
          if (status === 'covered') limitBasis = 'ตามทุนประกัน';
        } else if (type.code === 'windshield') {
          status = isType1 ? 'covered' : 'not_covered';
          if (status === 'covered') limitBasis = 'ตามทุนประกัน';
        } else if (type.code === 'theft_personal_prop') {
          status = isType1 ? 'optional' : 'not_covered';
          if (status === 'optional') {
            limitAmount = 20000;
            limitBasis = 'ต่อครั้ง';
          }
        } else if (type.code === 'tp_life_person') {
          limitAmount = 1000000;
          limitBasis = 'ต่อคน';
        } else if (type.code === 'tp_life_event') {
          limitAmount = 10000000;
          limitBasis = 'ต่อครั้ง';
        } else if (type.code === 'tp_property') {
          limitAmount = 2500000;
          limitBasis = 'ต่อครั้ง';
        } else if (type.code === 'pa_driver_passenger' || type.code === 'medical_expenses') {
          limitAmount = 200000;
          limitBasis = 'ต่อคน';
        } else if (type.code === 'bail_bond') {
          limitAmount = 300000;
          limitBasis = 'ต่อครั้ง';
        } else if (type.code === 'roadside_assist') {
          status = isType1 ? 'covered' : 'optional';
          limitBasis = '24 ชม.';
        } else if (type.code === 'towing') {
          status = isType1 ? 'covered' : 'optional';
          limitBasis = 'ตามเงื่อนไขบริษัท';
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
          created_at: now,
          updated_at: now,
        });
      }
    }
    saveToStorage(STORAGE_KEYS.COVERAGES, cleanCoverages);

    // 6. Source Document (Update existing document for this version rather than duplicating)
    const trimmedDocTitle = payload.documentTitle?.trim() || '';
    const hasDocPayload =
      trimmedDocTitle !== '' ||
      Boolean(payload.documentStoragePath) ||
      Boolean(payload.documentSourceUrl?.trim());

    if (hasDocPayload) {
      const existingDocIdx = docs.findIndex((d) => d.plan_version_id === versionId);
      const effectiveTitle = trimmedDocTitle || `${plan.name} (เอกสารอ้างอิง)`;
      if (existingDocIdx !== -1) {
        const prevDoc = docs[existingDocIdx];
        docs[existingDocIdx] = {
          ...prevDoc,
          source_type: payload.sourceType || prevDoc.source_type || 'rate_sheet',
          title: effectiveTitle,
          page_reference:
            payload.documentRef !== undefined
              ? payload.documentRef.trim() || null
              : prevDoc.page_reference,
          storage_path:
            payload.documentStoragePath !== undefined
              ? payload.documentStoragePath || `documents/${planId}/${versionId}.pdf`
              : prevDoc.storage_path,
          source_url:
            payload.documentSourceUrl !== undefined
              ? payload.documentSourceUrl?.trim() || null
              : prevDoc.source_url,
          file_size:
            payload.documentFileSize !== undefined ? payload.documentFileSize : prevDoc.file_size,
          mime_type:
            payload.documentMimeType !== undefined ? payload.documentMimeType : prevDoc.mime_type,
        };
      } else {
        docs.unshift({
          id: `doc-${Date.now()}`,
          plan_version_id: versionId,
          source_type: payload.sourceType || 'rate_sheet',
          storage_path: payload.documentStoragePath || `documents/${planId}/${versionId}.pdf`,
          source_url: payload.documentSourceUrl?.trim() || null,
          title: effectiveTitle,
          file_size: payload.documentFileSize ?? null,
          mime_type: payload.documentMimeType ?? null,
          page_reference: payload.documentRef?.trim() || null,
          received_at: todayStr,
          created_at: now,
          created_by: null,
        });
      }
      saveToStorage(STORAGE_KEYS.DOCUMENTS, docs);
    }

    // 7. Audit Log
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: payload.actorName || 'ผู้ใช้งาน',
      action: isEdit ? 'update' : 'create',
      entity_type: 'plan_version',
      entity_id: versionId,
      before_data: isEdit ? { plan_id: planId } : null,
      after_data: { plan_name: plan.name, version_no: version.version_no, status: targetStatus },
      reason: isEdit
        ? `บันทึกการแก้ไขข้อมูลแพ็กเกจ "${plan.name}" (รุ่นที่ ${version.version_no})`
        : `สร้างแพ็กเกจใหม่ "${plan.name}" (สถานะ: ${targetStatus})`,
      created_at: now,
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);

    return { plan, version };
  }

  /**
   * Section 8.1: Published plans must be archived rather than hard-deleted.
   * Unpublished draft-only plans can be deleted along with all child records.
   */
  static deletePlan(planId: string, actorName = 'ผู้ใช้งาน'): { mode: 'archived' | 'deleted' } {
    const plans = this.getPlans();
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return { mode: 'deleted' };

    const versions = this.getVersions();
    const planVersions = versions.filter((v) => v.plan_id === planId);
    const hasPublishedHistory = planVersions.some(
      (v) => v.workflow_status === 'published' || v.workflow_status === 'archived'
    );
    const auditLogs = this.getAuditLogs();
    const now = new Date().toISOString();

    if (hasPublishedHistory) {
      targetPlan.is_archived = true;
      targetPlan.updated_at = now;
      saveToStorage(STORAGE_KEYS.PLANS, plans);

      auditLogs.unshift({
        id: `audit-${Date.now()}`,
        actor_name: actorName,
        action: 'archive',
        entity_type: 'plan',
        entity_id: planId,
        before_data: { is_archived: false },
        after_data: { is_archived: true },
        reason: `จัดเก็บแพ็กเกจ "${targetPlan.name}" เข้ากรุ (Archive) เพื่อรักษาประวัติรุ่นที่เคยเผยแพร่`,
        created_at: now,
      });
      saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
      return { mode: 'archived' };
    }

    // Draft-only plan: cascade clean all child records cleanly
    const versionIds = new Set(planVersions.map((v) => v.id));
    const rules = this.getEligibilityRules();
    const ruleIds = new Set(rules.filter((r) => versionIds.has(r.plan_version_id)).map((r) => r.id));
    const options = this.getPriceOptions();
    const optionIds = new Set(options.filter((o) => ruleIds.has(o.eligibility_rule_id)).map((o) => o.id));

    saveToStorage(STORAGE_KEYS.PLANS, plans.filter((p) => p.id !== planId));
    saveToStorage(STORAGE_KEYS.VERSIONS, versions.filter((v) => !versionIds.has(v.id)));
    saveToStorage(STORAGE_KEYS.RULES, rules.filter((r) => !versionIds.has(r.plan_version_id)));
    saveToStorage(STORAGE_KEYS.OPTIONS, options.filter((o) => !ruleIds.has(o.eligibility_rule_id)));
    saveToStorage(
      STORAGE_KEYS.COVERAGES,
      this.getVersionCoverages().filter((c) => !versionIds.has(c.plan_version_id))
    );
    saveToStorage(
      STORAGE_KEYS.OVERRIDES,
      this.getOverrides().filter((ov) => !optionIds.has(ov.price_option_id))
    );
    saveToStorage(
      STORAGE_KEYS.DOCUMENTS,
      this.getDocuments().filter((d) => !versionIds.has(d.plan_version_id))
    );

    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: actorName,
      action: 'delete',
      entity_type: 'plan',
      entity_id: planId,
      before_data: { name: targetPlan.name },
      after_data: null,
      reason: `ลบแพ็กเกจร่าง "${targetPlan.name}" ที่ยังไม่เคยเผยแพร่`,
      created_at: now,
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
    return { mode: 'deleted' };
  }

  static restorePlan(planId: string, actorName = 'ผู้ดูแลระบบ'): void {
    const plans = this.getPlans();
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

    targetPlan.is_archived = false;
    targetPlan.updated_at = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.PLANS, plans);

    const auditLogs = this.getAuditLogs();
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actor_name: actorName,
      action: 'restore',
      entity_type: 'plan',
      entity_id: planId,
      before_data: { is_archived: true },
      after_data: { is_archived: false },
      reason: `กู้คืนแพ็กเกจ "${targetPlan.name}" กลับมาใช้งาน`,
      created_at: new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.AUDIT, auditLogs);
  }

  static duplicatePlan(
    sourcePlanId: string,
    actorName = 'ผู้ใช้งาน'
  ): { plan: Plan; version: PlanVersion } {
    const plans = this.getPlans();
    const sourcePlan = plans.find((p) => p.id === sourcePlanId);
    if (!sourcePlan) {
      throw new Error('ไม่พบแพ็กเกจต้นฉบับที่ต้องการคัดลอก');
    }

    const versions = this.getVersions()
      .filter((v) => v.plan_id === sourcePlanId)
      .sort((a, b) => b.version_no - a.version_no);
    const sourceVer = versions.find((v) => v.workflow_status === 'published') ?? versions[0];

    const sourceRule = sourceVer
      ? this.getEligibilityRules().find((r) => r.plan_version_id === sourceVer.id)
      : undefined;
    const sourceOptions = sourceRule
      ? this.getPriceOptions().filter((o) => o.eligibility_rule_id === sourceRule.id)
      : [];
    const sourceCoverages = sourceVer
      ? this.getVersionCoverages().filter((c) => c.plan_version_id === sourceVer.id)
      : [];
    const sourceDoc = sourceVer
      ? this.getDocuments().find((d) => d.plan_version_id === sourceVer.id)
      : undefined;

    const coverageTypes = this.getCoverageTypes();

    return this.createOrUpdatePlan({
      insurerId: sourcePlan.insurer_id,
      name: `${sourcePlan.name} (สำเนา)`,
      insuranceType: sourcePlan.insurance_type,
      workflowStatus: 'draft',
      effectiveFrom: sourceVer?.effective_from ?? getBangkokDateString(0),
      effectiveTo: sourceVer?.effective_to ?? getBangkokDateString(365),
      notes: `คัดลอกข้อมูลตั้งต้นจาก "${sourcePlan.name}"`,
      actorName,
      scopeType: sourceRule?.scope_type ?? 'all_models',
      vehicleModelId: sourceRule?.vehicle_model_id ?? null,
      minCarAge: sourceRule?.min_age ?? 1,
      maxCarAge: sourceRule?.max_age ?? 10,
      ageBasis: sourceRule?.age_basis ?? 'registration_year',
      usageType: sourceRule?.usage_type ?? 'private',
      registrationZone: sourceRule?.registration_zone ?? 'all',
      inspectionRequired: sourceRule?.inspection_required ?? false,
      priceOptions: sourceOptions.map((o) => ({
        label: o.label,
        repairType: o.repair_type,
        priceType: o.price_type,
        premiumTotal: o.premium_total,
        sumInsuredMin: o.sum_insured_min,
        sumInsuredMax: o.sum_insured_max,
        deductibleAmount: o.deductible_amount,
        deductibleTerms: o.deductible_terms ?? undefined,
        driverConditions: o.driver_conditions ?? undefined,
        compulsoryIncluded: o.compulsory_included,
        validFrom: o.valid_from,
        validTo: o.valid_to,
      })),
      coverages: sourceCoverages
        .map((vc) => {
          const ct = coverageTypes.find((t) => t.id === vc.coverage_type_id);
          if (!ct) return null;
          return {
            code: ct.code,
            status: vc.status,
            limitAmount: vc.limit_amount ?? null,
            limitBasis: vc.limit_basis ?? undefined,
            terms: vc.terms ?? undefined,
            exclusions: vc.exclusions ?? undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
      sourceType: sourceDoc?.source_type,
      documentTitle: sourceDoc?.title,
      documentRef: sourceDoc?.page_reference ?? undefined,
      documentStoragePath: sourceDoc?.storage_path ?? null,
      documentSourceUrl: sourceDoc?.source_url ?? null,
      documentFileSize: sourceDoc?.file_size ?? null,
      documentMimeType: sourceDoc?.mime_type ?? null,
    });
  }
}
