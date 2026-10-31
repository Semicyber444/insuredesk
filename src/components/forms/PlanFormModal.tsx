'use client';

import { useState } from 'react';
import {
  Insurer,
  VehicleModel,
  InsuranceType,
  RepairType,
  PriceType,
  CoverageStatus,
  WorkflowStatus,
  ScopeType,
  SourceType,
  CompulsoryInclusion,
} from '@/types/database';
import { InsuranceStore, getBangkokDateString } from '@/lib/store/insuranceStore';
import { MOCK_COVERAGE_TYPES } from '@/lib/queries/mockData';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  PlanSchema,
  PlanVersionSchema,
  EligibilityRuleSchema,
  PriceOptionSchema,
} from '@/lib/validation/schemas';
import {
  X,
  Save,
  AlertCircle,
  Plus,
  Sparkles,
  Layers,
  Copy,
  Trash2,
} from 'lucide-react';

interface CoverageItemState {
  code: string;
  name: string;
  category: string;
  status: CoverageStatus;
  limitAmount: number | string;
  limitBasis: string;
  terms: string;
  exclusions: string;
}

export interface PriceOptionItemState {
  id?: string;
  label: string;
  repairType: RepairType;
  priceType: PriceType;
  hasPrice: boolean;
  premiumTotal: number | string;
  hasSumInsured: boolean;
  sumInsuredMax: number | string;
  deductibleAmount: number | string;
  deductibleTerms: string;
  compulsoryIncluded: CompulsoryInclusion;
  driverConditions: string;
}

export interface EditablePlanInput {
  id: string;
  insurer_id: string;
  name: string;
  insurance_type: InsuranceType;
  currentStatus?: WorkflowStatus;
}

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialPlan?: EditablePlanInput | null;
}

type ModalTabId = 'info' | 'vehicle' | 'price' | 'coverages' | 'document';

function buildCoveragePreset(type: InsuranceType): CoverageItemState[] {
  const isType1 = type === 'ชั้น 1';
  const is2Plus = type === 'ชั้น 2+';
  const is3Plus = type === 'ชั้น 3+';
  const isType2 = type === 'ชั้น 2';

  return MOCK_COVERAGE_TYPES.map((ct) => {
    let status: CoverageStatus = 'covered';
    let limitAmount: number | string = '';
    let limitBasis = '';
    let terms = '';
    const exclusions = '';

    if (ct.code === 'own_damage') {
      if (isType1) {
        status = 'covered';
        limitBasis = 'ตามทุนประกัน';
        terms = 'คุ้มครองอุบัติเหตุทุกกรณี';
      } else if (is2Plus || is3Plus) {
        status = 'covered';
        limitBasis = 'ตามทุนประกัน (ชนกับยานพาหนะทางบก)';
        terms = 'ต้องมีคู่กรณีเป็นยานพาหนะทางบก';
      } else {
        status = 'not_covered';
      }
    } else if (ct.code === 'rollover_offroad') {
      if (isType1) {
        status = 'covered';
        limitBasis = 'ตามทุนประกัน';
        terms = 'คุ้มครองกรณีรถพลิกคว่ำหรือตกข้างทาง';
      } else {
        status = 'not_covered';
      }
    } else if (ct.code === 'theft_fire') {
      if (isType1 || is2Plus || isType2) {
        status = 'covered';
        limitBasis = 'ตามทุนประกัน';
      } else {
        status = 'not_covered';
      }
    } else if (ct.code === 'flood') {
      if (isType1 || is2Plus) {
        status = 'covered';
        limitBasis = 'ตามทุนประกัน';
      } else {
        status = 'not_covered';
      }
    } else if (ct.code === 'windshield') {
      status = isType1 ? 'covered' : 'not_covered';
      if (status === 'covered') limitBasis = 'ตามทุนประกัน';
    } else if (ct.code === 'theft_personal_prop') {
      status = isType1 ? 'optional' : 'not_covered';
      if (status === 'optional') {
        limitAmount = 20000;
        limitBasis = 'ต่อครั้ง';
      }
    } else if (ct.code === 'accessories') {
      status = isType1 || is2Plus ? 'covered' : 'optional';
      limitAmount = 20000;
      limitBasis = 'ต่อครั้ง (ตามที่แจ้งไว้)';
      terms = 'คุ้มครองอุปกรณ์ตกแต่งตามที่แจ้งไว้ไม่เกิน 20,000 บาท';
    } else if (ct.code === 'tp_life_person') {
      status = 'covered';
      limitAmount = 1000000;
      limitBasis = 'ต่อคน';
    } else if (ct.code === 'tp_life_event') {
      status = 'covered';
      limitAmount = 10000000;
      limitBasis = 'ต่อครั้ง';
    } else if (ct.code === 'tp_property') {
      status = 'covered';
      limitAmount = isType1 ? 2500000 : 1000000;
      limitBasis = 'ต่อครั้ง';
    } else if (ct.code === 'pa_driver_passenger') {
      status = 'covered';
      limitAmount = 200000;
      limitBasis = 'ต่อคน (5 ที่นั่ง)';
    } else if (ct.code === 'medical_expenses') {
      status = 'covered';
      limitAmount = 200000;
      limitBasis = 'ต่อคน';
    } else if (ct.code === 'bail_bond') {
      status = 'covered';
      limitAmount = 300000;
      limitBasis = 'ต่อครั้ง';
    } else if (ct.code === 'roadside_assist') {
      status = isType1 || is2Plus ? 'covered' : 'optional';
      limitBasis = 'ช่วยเหลือ 24 ชม.';
    } else if (ct.code === 'towing') {
      status = isType1 || is2Plus ? 'covered' : 'optional';
      limitAmount = 1500;
      limitBasis = 'ไม่เกิน 50 กม.';
    } else if (ct.code === 'loss_of_use') {
      status = 'optional';
      limitAmount = 500;
      limitBasis = 'ต่อวัน';
      terms = 'ซื้อความคุ้มครองเสริม';
    }

    return {
      code: ct.code,
      name: ct.name,
      category: ct.category,
      status,
      limitAmount,
      limitBasis,
      terms,
      exclusions,
    };
  });
}

function isAutoGeneratedLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed === '' || /^(ซ่อมห้าง|ซ่อมอู่)\s*-\s*(ทุน|ยังไม่ระบุทุน)/.test(trimmed);
}

function formatAutoLabel(repairType: RepairType, hasSumInsured: boolean, sumInsuredMax: number | string): string {
  const prefix = repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่';
  if (!hasSumInsured || sumInsuredMax === '' || Number(sumInsuredMax) <= 0) {
    return `${prefix} - ยังไม่ระบุทุน`;
  }
  return `${prefix} - ทุน ${Number(sumInsuredMax).toLocaleString('th-TH')}`;
}

function buildInitialModalState(initialPlan: EditablePlanInput | null | undefined, canPublish: boolean) {
  const insList = InsuranceStore.getInsurers();
  const vehList = InsuranceStore.getVehicleModels();
  const defaultEffectiveFrom = getBangkokDateString(0);
  const defaultEffectiveTo = getBangkokDateString(365);

  const defaultTier: PriceOptionItemState = {
    label: 'ซ่อมอู่ - ทุน 50,000',
    repairType: 'garage',
    priceType: 'fixed_for_conditions',
    hasPrice: true,
    premiumTotal: 5400,
    hasSumInsured: true,
    sumInsuredMax: 50000,
    deductibleAmount: 0,
    deductibleTerms: '',
    compulsoryIncluded: 'excluded',
    driverConditions: 'ไม่จำกัดชื่อผู้ขับขี่',
  };

  if (!initialPlan) {
    return {
      insList,
      vehList,
      currentVersionId: null as string | null,
      currentVersionNo: 1,
      currentVersionStatus: 'draft' as WorkflowStatus,
      saveMode: 'new_version' as 'update' | 'new_version',
      insurerId: insList.find((i) => i.is_active)?.id || insList[0]?.id || '',
      name: '',
      insuranceType: 'ชั้น 1' as InsuranceType,
      workflowStatus: (canPublish ? 'published' : 'in_review') as 'draft' | 'in_review' | 'published',
      effectiveFrom: defaultEffectiveFrom,
      effectiveTo: defaultEffectiveTo,
      notes: '',
      scopeType: 'all_models' as ScopeType,
      vehicleModelId: '',
      minCarAge: 1 as number | string,
      maxCarAge: 10 as number | string,
      usageType: 'private' as 'private' | 'commercial' | 'all',
      inspectionRequired: false,
      ageBasis: 'registration_year' as 'registration_year' | 'manufacture_year',
      priceOptionsList: [defaultTier],
      coveragesState: buildCoveragePreset('ชั้น 1'),
      documentTitle: '',
      documentRef: '',
      sourceType: 'rate_sheet' as SourceType,
    };
  }

  const versions = InsuranceStore.getVersions()
    .filter((v) => v.plan_id === initialPlan.id)
    .sort((a, b) => b.version_no - a.version_no);
  const publishedVer = versions.find((v) => v.workflow_status === 'published');
  const latestVer = publishedVer ?? versions[0];

  const isPublishedOrArchived =
    latestVer?.workflow_status === 'published' || latestVer?.workflow_status === 'archived';

  // Section 12.2: Published versions default to creating a new version to preserve history
  const saveMode: 'update' | 'new_version' = isPublishedOrArchived ? 'new_version' : 'update';

  const rawStatus = latestVer?.workflow_status ?? initialPlan.currentStatus ?? 'draft';
  const resolvedWorkflowStatus: 'draft' | 'in_review' | 'published' =
    !canPublish
      ? rawStatus === 'draft'
        ? 'draft'
        : 'in_review'
      : rawStatus === 'archived'
      ? 'draft'
      : rawStatus;

  let scopeType: ScopeType = 'all_models';
  let vehicleModelId = '';
  let minCarAge: number | string = 1;
  let maxCarAge: number | string = 10;
  let usageType: 'private' | 'commercial' | 'all' = 'private';
  let inspectionRequired = false;
  let ageBasis: 'registration_year' | 'manufacture_year' = 'registration_year';
  let priceOptionsList: PriceOptionItemState[] = [defaultTier];
  let coveragesState: CoverageItemState[] = buildCoveragePreset(initialPlan.insurance_type || 'ชั้น 1');
  let documentTitle = '';
  let documentRef = '';
  let sourceType: SourceType = 'rate_sheet';

  if (latestVer) {
    const rule = InsuranceStore.getEligibilityRules().find((r) => r.plan_version_id === latestVer.id);
    if (rule) {
      scopeType = rule.scope_type || 'all_models';
      vehicleModelId = rule.vehicle_model_id || '';
      minCarAge = rule.min_age ?? 1;
      maxCarAge = rule.max_age ?? 10;
      usageType = (rule.usage_type as 'private' | 'commercial' | 'all') || 'private';
      inspectionRequired = rule.inspection_required ?? false;
      ageBasis = rule.age_basis || 'registration_year';

      const options = InsuranceStore.getPriceOptions().filter((o) => o.eligibility_rule_id === rule.id);
      if (options.length > 0) {
        priceOptionsList = options.map((o) => {
          const sumVal = o.sum_insured_max ?? o.sum_insured_min;
          return {
            id: isPublishedOrArchived ? undefined : o.id,
            label: o.label || '',
            repairType: o.repair_type,
            priceType: o.price_type,
            hasPrice: o.premium_total !== null && o.premium_total !== undefined,
            premiumTotal: o.premium_total ?? '',
            hasSumInsured: sumVal !== null && sumVal !== undefined,
            sumInsuredMax: sumVal ?? '',
            deductibleAmount: o.deductible_amount ?? 0,
            deductibleTerms: o.deductible_terms || '',
            compulsoryIncluded: o.compulsory_included || 'excluded',
            driverConditions: o.driver_conditions || 'ไม่จำกัดชื่อผู้ขับขี่',
          };
        });
      }
    }

    const vCoverages = InsuranceStore.getVersionCoverages().filter(
      (vc) => vc.plan_version_id === latestVer.id
    );
    if (vCoverages.length > 0) {
      const isType1 = (initialPlan.insurance_type || '') === 'ชั้น 1';
      const is2Plus = (initialPlan.insurance_type || '').includes('2+');
      coveragesState = MOCK_COVERAGE_TYPES.map((ct) => {
        const found = vCoverages.find((vc) => vc.coverage_type_id === ct.id);
        let status: CoverageStatus = found?.status ?? 'unknown';
        let limitAmount: number | string = found?.limit_amount ?? '';
        let limitBasis = found?.limit_basis ?? '';
        let terms = found?.terms ?? '';
        const exclusions = found?.exclusions ?? '';

        if (!found && ct.code === 'accessories') {
          status = isType1 || is2Plus ? 'covered' : 'optional';
          limitAmount = 20000;
          limitBasis = 'ต่อครั้ง (ตามที่แจ้งไว้)';
          terms = 'คุ้มครองอุปกรณ์ตกแต่งตามที่แจ้งไว้ไม่เกิน 20,000 บาท';
        } else if (!found && ct.code === 'rollover_offroad') {
          status = isType1 ? 'covered' : 'unknown';
          if (isType1) {
            limitBasis = 'ตามทุนประกัน';
            terms = 'คุ้มครองกรณีรถพลิกคว่ำหรือตกข้างทาง';
          }
        }

        return {
          code: ct.code,
          name: ct.name,
          category: ct.category,
          status,
          limitAmount,
          limitBasis,
          terms,
          exclusions,
        };
      });
    }

    const docs = InsuranceStore.getDocuments().filter((d) => d.plan_version_id === latestVer.id);
    if (docs.length > 0) {
      documentTitle = docs[0].title;
      documentRef = docs[0].page_reference || '';
      sourceType = docs[0].source_type || 'rate_sheet';
    }
  }

  return {
    insList,
    vehList,
    currentVersionId: latestVer?.id ?? null,
    currentVersionNo: latestVer?.version_no ?? 1,
    currentVersionStatus: (latestVer?.workflow_status ?? 'draft') as WorkflowStatus,
    saveMode,
    insurerId: initialPlan.insurer_id || insList[0]?.id || '',
    name: initialPlan.name || '',
    insuranceType: initialPlan.insurance_type || 'ชั้น 1',
    workflowStatus: resolvedWorkflowStatus,
    effectiveFrom: latestVer?.effective_from || defaultEffectiveFrom,
    effectiveTo: latestVer?.effective_to || defaultEffectiveTo,
    notes: latestVer?.notes || '',
    scopeType,
    vehicleModelId,
    minCarAge,
    maxCarAge,
    usageType,
    inspectionRequired,
    ageBasis,
    priceOptionsList,
    coveragesState,
    documentTitle,
    documentRef,
    sourceType,
  };
}

export function PlanFormModal({ isOpen, onClose, onSaved, initialPlan }: PlanFormModalProps) {
  if (!isOpen) return null;

  return (
    <PlanFormModalBody
      key={`${initialPlan?.id ?? 'create'}-${initialPlan?.currentStatus ?? 'new'}`}
      onClose={onClose}
      onSaved={onSaved}
      initialPlan={initialPlan}
    />
  );
}

function PlanFormModalBody({
  onClose,
  onSaved,
  initialPlan,
}: Omit<PlanFormModalProps, 'isOpen'>) {
  const { userName, can } = useAuth();
  const canPublish = can('canPublish');

  const [init] = useState(() => buildInitialModalState(initialPlan, canPublish));

  const insurers: Insurer[] = init.insList;
  const vehicles: VehicleModel[] = init.vehList;
  const currentVersionId = init.currentVersionId;
  const currentVersionNo = init.currentVersionNo;
  const currentVersionStatus = init.currentVersionStatus;

  const [saveMode, setSaveMode] = useState<'update' | 'new_version'>(init.saveMode);
  const [insurerId, setInsurerId] = useState(init.insurerId);
  const [name, setName] = useState(init.name);
  const [insuranceType, setInsuranceType] = useState<InsuranceType>(init.insuranceType);
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'in_review' | 'published'>(
    init.workflowStatus
  );
  const [effectiveFrom, setEffectiveFrom] = useState(init.effectiveFrom);
  const [effectiveTo, setEffectiveTo] = useState(init.effectiveTo);
  const [notes, setNotes] = useState(init.notes);

  const [scopeType, setScopeType] = useState<ScopeType>(init.scopeType);
  const [vehicleModelId, setVehicleModelId] = useState(init.vehicleModelId);
  const [minCarAge, setMinCarAge] = useState<number | string>(init.minCarAge);
  const [maxCarAge, setMaxCarAge] = useState<number | string>(init.maxCarAge);
  const [usageType, setUsageType] = useState<'private' | 'commercial' | 'all'>(init.usageType);
  const [inspectionRequired, setInspectionRequired] = useState(init.inspectionRequired);
  const [ageBasis, setAgeBasis] = useState<'registration_year' | 'manufacture_year'>(init.ageBasis);

  const [priceOptionsList, setPriceOptionsList] = useState<PriceOptionItemState[]>(
    init.priceOptionsList
  );
  const [coveragesState, setCoveragesState] = useState<CoverageItemState[]>(init.coveragesState);

  const [documentTitle, setDocumentTitle] = useState(init.documentTitle);
  const [documentRef, setDocumentRef] = useState(init.documentRef);
  const [sourceType, setSourceType] = useState<SourceType>(init.sourceType);

  const [activeTab, setActiveTab] = useState<ModalTabId>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const applyCoveragePreset = (type: InsuranceType) => {
    setCoveragesState(buildCoveragePreset(type));
  };

  const handleAddPriceTier = () => {
    const lastTier = priceOptionsList[priceOptionsList.length - 1];
    const newSum = lastTier && lastTier.hasSumInsured ? Number(lastTier.sumInsuredMax || 0) + 100000 : 100000;
    const newPremium = lastTier && lastTier.hasPrice ? Number(lastTier.premiumTotal || 0) + 1000 : 6500;
    const repair = lastTier ? lastTier.repairType : 'garage';

    setPriceOptionsList((prev) => [
      ...prev,
      {
        label: formatAutoLabel(repair, true, newSum),
        repairType: repair,
        priceType: 'fixed_for_conditions',
        hasPrice: true,
        premiumTotal: newPremium,
        hasSumInsured: true,
        sumInsuredMax: newSum,
        deductibleAmount: 0,
        deductibleTerms: '',
        compulsoryIncluded: 'excluded',
        driverConditions: 'ไม่จำกัดชื่อผู้ขับขี่',
      },
    ]);
  };

  const handleDuplicateTier = (index: number) => {
    const source = priceOptionsList[index];
    const newSum = source.hasSumInsured ? Number(source.sumInsuredMax || 0) + 50000 : '';
    const newPremium = source.hasPrice ? Number(source.premiumTotal || 0) + 800 : '';

    setPriceOptionsList((prev) => [
      ...prev.slice(0, index + 1),
      {
        ...source,
        id: undefined,
        label: formatAutoLabel(source.repairType, source.hasSumInsured, newSum),
        sumInsuredMax: newSum,
        premiumTotal: newPremium,
      },
      ...prev.slice(index + 1),
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (priceOptionsList.length <= 1) {
      setErrorMsg('แพ็กเกจต้องมีตัวเลือกราคาอย่างน้อย 1 รายการ');
      return;
    }
    setPriceOptionsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTierField = <K extends keyof PriceOptionItemState>(
    index: number,
    field: K,
    value: PriceOptionItemState[K]
  ) => {
    setPriceOptionsList((prev) => {
      const copy = [...prev];
      const prevLabel = copy[index].label;
      copy[index] = { ...copy[index], [field]: value };

      if (
        (field === 'sumInsuredMax' || field === 'repairType' || field === 'hasSumInsured') &&
        isAutoGeneratedLabel(prevLabel)
      ) {
        copy[index].label = formatAutoLabel(
          copy[index].repairType,
          copy[index].hasSumInsured,
          copy[index].sumInsuredMax
        );
      }

      return copy;
    });
  };

  const handleCoverageStatusChange = (code: string, newStatus: CoverageStatus) => {
    setCoveragesState((prev) =>
      prev.map((c) => (c.code === code ? { ...c, status: newStatus } : c))
    );
  };

  const handleCoverageFieldChange = (
    code: string,
    field: 'limitAmount' | 'limitBasis' | 'terms' | 'exclusions',
    value: string
  ) => {
    setCoveragesState((prev) =>
      prev.map((c) => (c.code === code ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 1. Validate Plan Info
    const planParse = PlanSchema.safeParse({
      insurer_id: insurerId,
      name,
      insurance_type: insuranceType,
    });
    if (!planParse.success) {
      setErrorMsg(planParse.error.issues[0]?.message || 'ข้อมูลแพ็กเกจไม่ถูกต้อง');
      setActiveTab('info');
      return;
    }

    // 2. Validate Version Dates
    const versionParse = PlanVersionSchema.safeParse({
      plan_id: initialPlan?.id || 'temp-plan',
      version_no: 1,
      effective_from: effectiveFrom || null,
      effective_to: effectiveTo || null,
      notes: notes || null,
    });
    if (!versionParse.success) {
      setErrorMsg(versionParse.error.issues[0]?.message || 'วันที่บังคับใช้ไม่ถูกต้อง');
      setActiveTab('info');
      return;
    }

    // 3. Validate Vehicle Eligibility Rule
    const parsedMinAge = minCarAge === '' ? null : Number(minCarAge);
    const parsedMaxAge = maxCarAge === '' ? null : Number(maxCarAge);
    const ruleParse = EligibilityRuleSchema.safeParse({
      plan_version_id: 'temp-version',
      scope_type: scopeType,
      vehicle_model_id: scopeType === 'specific_model' ? vehicleModelId || null : null,
      min_age: parsedMinAge,
      max_age: parsedMaxAge,
      age_basis: ageBasis,
      usage_type: usageType,
      inspection_required: inspectionRequired,
    });
    if (!ruleParse.success) {
      setErrorMsg(ruleParse.error.issues[0]?.message || 'เงื่อนไขรถยนต์ไม่ถูกต้อง');
      setActiveTab('vehicle');
      return;
    }

    // 4. Validate Price Options
    if (priceOptionsList.length === 0) {
      setErrorMsg('กรุณาระบุตัวเลือกราคาและทุนประกันอย่างน้อย 1 รายการ');
      setActiveTab('price');
      return;
    }

    for (let i = 0; i < priceOptionsList.length; i++) {
      const po = priceOptionsList[i];
      const premVal = po.hasPrice && po.premiumTotal !== '' ? Number(po.premiumTotal) : null;
      const sumVal = po.hasSumInsured && po.sumInsuredMax !== '' ? Number(po.sumInsuredMax) : null;
      const deductVal = po.deductibleAmount !== '' ? Number(po.deductibleAmount) : 0;
      const resolvedLabel =
        po.label.trim() || formatAutoLabel(po.repairType, po.hasSumInsured, po.sumInsuredMax);

      const poParse = PriceOptionSchema.safeParse({
        eligibility_rule_id: 'temp-rule',
        label: resolvedLabel,
        repair_type: po.repairType,
        price_type: premVal !== null ? po.priceType : 'unknown',
        premium_total: premVal,
        sum_insured_min: sumVal,
        sum_insured_max: sumVal,
        deductible_amount: deductVal,
        compulsory_included: po.compulsoryIncluded,
      });

      if (!poParse.success) {
        setErrorMsg(`ตัวเลือกที่ ${i + 1}: ${poParse.error.issues[0]?.message || 'ข้อมูลราคาไม่ถูกต้อง'}`);
        setActiveTab('price');
        return;
      }
    }

    // 5. Enforce RBAC & Source Document rule before publishing (Section 8.4)
    const effectiveStatus: WorkflowStatus = !canPublish && workflowStatus === 'published'
      ? 'in_review'
      : workflowStatus;

    if (effectiveStatus === 'published' && !documentTitle.trim()) {
      setErrorMsg('ตามกฎ Section 8.4 ต้องระบุชื่อเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการก่อนเผยแพร่');
      setActiveTab('document');
      return;
    }

    setIsSubmitting(true);

    const targetVersionId =
      initialPlan && saveMode === 'update' && currentVersionId ? currentVersionId : undefined;

    try {
      InsuranceStore.createOrUpdatePlan({
        planId: initialPlan?.id,
        versionId: targetVersionId,
        insurerId,
        name,
        insuranceType,
        workflowStatus: effectiveStatus,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        actorName: userName,
        notes:
          saveMode === 'new_version' && initialPlan
            ? notes || `ปรับปรุงข้อมูลจากรุ่นที่ ${currentVersionNo}`
            : notes,
        // Eligibility
        scopeType,
        vehicleModelId: scopeType === 'specific_model' ? vehicleModelId : null,
        minCarAge: parsedMinAge,
        maxCarAge: parsedMaxAge,
        ageBasis,
        usageType,
        inspectionRequired,
        // Price Options
        priceOptions: priceOptionsList.map((po) => {
          const premVal = po.hasPrice && po.premiumTotal !== '' ? Number(po.premiumTotal) : null;
          const sumVal = po.hasSumInsured && po.sumInsuredMax !== '' ? Number(po.sumInsuredMax) : null;
          return {
            id: saveMode === 'new_version' ? undefined : po.id,
            label: po.label.trim() || formatAutoLabel(po.repairType, po.hasSumInsured, po.sumInsuredMax),
            repairType: po.repairType,
            priceType: premVal !== null ? po.priceType : 'unknown',
            premiumTotal: premVal,
            sumInsuredMin: sumVal,
            sumInsuredMax: sumVal,
            deductibleAmount: Number(po.deductibleAmount || 0),
            deductibleTerms: po.deductibleTerms || undefined,
            compulsoryIncluded: po.compulsoryIncluded,
            driverConditions: po.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่',
            validFrom: effectiveFrom || null,
            validTo: effectiveTo || null,
          };
        }),
        // Coverages
        coverages: coveragesState.map((c) => ({
          code: c.code,
          status: c.status,
          limitAmount: c.limitAmount !== '' ? Number(c.limitAmount) : null,
          limitBasis: c.limitBasis || undefined,
          terms: c.terms || undefined,
          exclusions: c.exclusions || undefined,
        })),
        // Document
        sourceType,
        documentTitle: documentTitle || undefined,
        documentRef: documentRef || undefined,
      });

      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(new Set(MOCK_COVERAGE_TYPES.map((c) => c.category)));
  const isLockedPublished =
    currentVersionStatus === 'published' || currentVersionStatus === 'archived';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>{initialPlan ? 'แก้ไขแพ็กเกจประกันภัย' : 'เพิ่มแพ็กเกจประกันภัยใหม่'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              รองรับตารางหลายทุนและหลายเบี้ยในแพ็กเกจเดียวกัน (Multiple Price Tiers), เงื่อนไขรถ, ความคุ้มครอง {MOCK_COVERAGE_TYPES.length} หมวดมาตรฐาน, และเอกสารต้นทาง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-slate-100 shrink-0 text-xs">
          {(
            [
              { id: 'info', label: '1. ข้อมูลแพ็กเกจ' },
              { id: 'vehicle', label: '2. เงื่อนไขรถ' },
              { id: 'price', label: `3. ราคาและทุนประกัน (${priceOptionsList.length} ตัวเลือก)` },
              { id: 'coverages', label: `4. ความคุ้มครอง (${coveragesState.length} หมวด)` },
              { id: 'document', label: '5. เอกสารอ้างอิง' },
            ] as { id: ModalTabId; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="my-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-6 text-xs pr-1">
          {/* TAB 1: General Info */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {initialPlan && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block animate-pulse"></span>
                      รุ่นอ้างอิงล่าสุด: รุ่นที่ {currentVersionNo} ({currentVersionStatus})
                    </span>
                    <span className="text-[11px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md font-mono">
                      ID: {currentVersionId?.slice(0, 12)}...
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 font-semibold pt-2 border-t border-blue-100 flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="saveMode"
                        value="new_version"
                        checked={saveMode === 'new_version'}
                        onChange={() => setSaveMode('new_version')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        สร้างเป็นรุ่นใหม่ (รุ่นที่ {currentVersionNo + 1}) — เก็บประวัติรุ่นเดิมตามมาตรฐาน
                      </span>
                    </label>
                    {!isLockedPublished && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="saveMode"
                          value="update"
                          checked={saveMode === 'update'}
                          onChange={() => setSaveMode('update')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>แก้ไขในรุ่นร่างปัจจุบัน (รุ่นที่ {currentVersionNo}) โดยตรง</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">บริษัทประกันภัย *</label>
                  <select
                    required
                    value={insurerId}
                    onChange={(e) => setInsurerId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {insurers.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.name} {!ins.is_active ? '(ปิดใช้งาน)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ประเภทประกันภัย *</label>
                  <select
                    value={insuranceType}
                    onChange={(e) => {
                      const newType = e.target.value as InsuranceType;
                      setInsuranceType(newType);
                      if (
                        !initialPlan ||
                        confirm(
                          `ต้องการรีเซ็ตตารางความคุ้มครอง ${MOCK_COVERAGE_TYPES.length} หมวดให้เป็นค่าเริ่มต้นของ "${newType}" หรือไม่? (กดยกเลิกเพื่อคงค่าที่ปรับแต่งไว้เดิม)`
                        )
                      ) {
                        applyCoveragePreset(newType);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ชั้น 1">ชั้น 1</option>
                    <option value="ชั้น 2+">ชั้น 2+</option>
                    <option value="ชั้น 3+">ชั้น 3+</option>
                    <option value="ชั้น 2">ชั้น 2</option>
                    <option value="ชั้น 3">ชั้น 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ชื่อแพ็กเกจประกัน *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น วิริยะ ซุปเปอร์โปรเทค พรีเมียม หรือ ธนชาต 2+ ฟิต อุ่นใจ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">วันเริ่มมีผลบังคับใช้</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">วันสิ้นสุดผลบังคับใช้</label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">สถานะข้อมูล (Workflow Status)</label>
                  <select
                    value={workflowStatus}
                    onChange={(e) =>
                      setWorkflowStatus(e.target.value as 'draft' | 'in_review' | 'published')
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {canPublish && (
                      <option value="published">เผยแพร่ทันที (Published - แสดงในผลค้นหา)</option>
                    )}
                    <option value="in_review">ส่งตรวจ (In Review - ไปที่คิวตรวจสอบ)</option>
                    <option value="draft">บันทึกร่าง (Draft)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">หมายเหตุของรุ่น (Version Notes)</label>
                  <input
                    type="text"
                    placeholder="เช่น อัตราเบี้ยปี 2569 ได้รับอนุมัติแล้ว"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Vehicle Eligibility */}
          {activeTab === 'vehicle' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ขอบเขตรุ่นรถที่รับประกัน</label>
                  <select
                    value={scopeType}
                    onChange={(e) => setScopeType(e.target.value as ScopeType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all_models">รองรับทุกรุ่นภายใต้เงื่อนไข (All Models)</option>
                    <option value="specific_model">เฉพาะรุ่นรถที่ระบุ (Specific Model)</option>
                    <option value="unknown">ยังไม่ระบุขอบเขตรุ่นรถชัดเจน (Unknown)</option>
                  </select>
                </div>

                {scopeType === 'specific_model' && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">เลือกรุ่นรถเฉพาะ *</label>
                    <select
                      value={vehicleModelId}
                      onChange={(e) => setVehicleModelId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- กรุณาเลือกรุ่นรถ --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.brand} {v.model} ({v.variant || v.powertrain || 'ทั่วไป'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">อายุรถขั้นต่ำ (ปี)</label>
                  <input
                    type="number"
                    min={0}
                    value={minCarAge}
                    onChange={(e) => setMinCarAge(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">อายุรถสูงสุด (ปี)</label>
                  <input
                    type="number"
                    min={0}
                    value={maxCarAge}
                    onChange={(e) => setMaxCarAge(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">เกณฑ์นับอายุรถ</label>
                  <select
                    value={ageBasis}
                    onChange={(e) =>
                      setAgeBasis(e.target.value as 'registration_year' | 'manufacture_year')
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="registration_year">ปีจดทะเบียน</option>
                    <option value="manufacture_year">ปีที่ผลิต (ค.ศ.)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ลักษณะการใช้งาน</label>
                  <select
                    value={usageType}
                    onChange={(e) => setUsageType(e.target.value as 'private' | 'commercial' | 'all')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="private">การใช้งานส่วนบุคคล (Private)</option>
                    <option value="commercial">การพาณิชย์/รับจ้าง (Commercial)</option>
                    <option value="all">รองรับทุกรูปแบบ</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inspectionRequired}
                      onChange={(e) => setInspectionRequired(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-700">ต้องตรวจสภาพรถก่อนทำประกัน</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Multiple Price Options / Tiers */}
          {activeTab === 'price' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-blue-900 block">
                      ตารางทุนและเบี้ยประกันภัย (Price Options / Tiers)
                    </span>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      แพ็กเกจชื่อเดียวกันสามารถมีได้หลายตัวเลือกราคา โดยระบุทุนประกันและเบี้ยที่ต่างกันได้
                      หากยังไม่ทราบราคาหรือทุนประกัน สามารถติ๊ก &quot;ยังไม่ระบุ&quot; ได้โดยไม่บันทึกเป็น 0 บาท
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddPriceTier}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มตัวเลือกราคา / ทุน</span>
                </button>
              </div>

              <div className="space-y-3">
                {priceOptionsList.map((tier, idx) => (
                  <div
                    key={idx}
                    className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 relative hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={tier.label}
                          onChange={(e) => handleUpdateTierField(idx, 'label', e.target.value)}
                          placeholder={`ชื่อตัวเลือกที่ ${idx + 1}`}
                          className="font-bold text-slate-800 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 w-full max-w-sm"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDuplicateTier(idx)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition cursor-pointer"
                          title="คัดลอกตัวเลือกนี้แล้วเปลี่ยนทุน"
                        >
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>คัดลอก</span>
                        </button>

                        {priceOptionsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="ลบตัวเลือกราคานี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-700">ทุนประกันภัย (บาท)</label>
                          <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!tier.hasSumInsured}
                              onChange={(e) =>
                                handleUpdateTierField(idx, 'hasSumInsured', !e.target.checked)
                              }
                              className="rounded"
                            />
                            <span>ยังไม่ระบุ</span>
                          </label>
                        </div>
                        {tier.hasSumInsured ? (
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            placeholder="เช่น 50000 หรือ 100000"
                            value={tier.sumInsuredMax}
                            onChange={(e) =>
                              handleUpdateTierField(idx, 'sumInsuredMax', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm"
                          />
                        ) : (
                          <div className="p-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold text-xs">
                            ยังไม่ระบุทุนประกัน
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-700">เบี้ยประกันรวม (บาท)</label>
                          <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!tier.hasPrice}
                              onChange={(e) =>
                                handleUpdateTierField(idx, 'hasPrice', !e.target.checked)
                              }
                              className="rounded"
                            />
                            <span>ยังไม่ระบุ</span>
                          </label>
                        </div>
                        {tier.hasPrice ? (
                          <input
                            type="number"
                            min={0}
                            step={100}
                            placeholder="เช่น 5400"
                            value={tier.premiumTotal}
                            onChange={(e) =>
                              handleUpdateTierField(idx, 'premiumTotal', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-900 text-sm"
                          />
                        ) : (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 font-semibold text-xs">
                            ยังไม่มีข้อมูลราคา
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">ลักษณะการซ่อม *</label>
                        <select
                          value={tier.repairType}
                          onChange={(e) =>
                            handleUpdateTierField(idx, 'repairType', e.target.value as RepairType)
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <option value="garage">ซ่อมอู่ (อู่ในเครือ)</option>
                          <option value="dealer">ซ่อมห้าง (ศูนย์บริการ)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          ค่าเสียหายส่วนแรก Deductible (บาท)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={tier.deductibleAmount}
                          onChange={(e) =>
                            handleUpdateTierField(idx, 'deductibleAmount', e.target.value)
                          }
                          placeholder="0 หากไม่มี"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">การรวม พ.ร.บ.</label>
                        <select
                          value={tier.compulsoryIncluded}
                          onChange={(e) =>
                            handleUpdateTierField(
                              idx,
                              'compulsoryIncluded',
                              e.target.value as CompulsoryInclusion
                            )
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <option value="excluded">ไม่รวม พ.ร.บ.</option>
                          <option value="included">รวม พ.ร.บ. แล้ว</option>
                          <option value="unspecified">ยังไม่ระบุ</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">เงื่อนไขผู้ขับขี่</label>
                        <input
                          type="text"
                          placeholder="เช่น ไม่จำกัดชื่อ หรือ ระบุอายุ"
                          value={tier.driverConditions}
                          onChange={(e) =>
                            handleUpdateTierField(idx, 'driverConditions', e.target.value)
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAddPriceTier}
                  className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-2xl font-bold text-slate-600 hover:text-blue-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มตัวเลือกราคา / ทุนประกันอีกรายการ (เช่น ทุน 100,000 / 200,000 / 300,000)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Full 15 Standard Coverages Editor */}
          {activeTab === 'coverages' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/70 p-3 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 text-blue-900 font-bold">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>ตั้งค่ามาตรฐานด่วนตามประเภทประกัน:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3'] as InsuranceType[]).map(
                    (presetType) => (
                      <button
                        key={presetType}
                        type="button"
                        onClick={() => applyCoveragePreset(presetType)}
                        className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-300 font-semibold cursor-pointer"
                      >
                        {presetType}
                      </button>
                    )
                  )}
                </div>
              </div>

              {categories.map((catName) => {
                const items = coveragesState.filter((c) => c.category === catName);
                if (items.length === 0) return null;

                return (
                  <div key={catName} className="space-y-3">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] bg-slate-100 p-2 rounded-lg">
                      หมวด{catName} ({items.length} รายการ)
                    </h4>
                    <div className="space-y-2">
                      {items.map((cov) => (
                        <div
                          key={cov.code}
                          className="bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-xs">{cov.name}</span>

                            <div className="flex items-center gap-1">
                              {(
                                [
                                  { value: 'covered', label: 'คุ้มครอง' },
                                  { value: 'not_covered', label: 'ไม่คุ้มครอง' },
                                  { value: 'optional', label: 'ซื้อเพิ่มได้' },
                                  { value: 'unknown', label: 'ยังไม่ระบุ' },
                                ] as { value: CoverageStatus; label: string }[]
                              ).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleCoverageStatusChange(cov.code, opt.value)}
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                                    cov.status === opt.value
                                      ? opt.value === 'covered'
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : opt.value === 'not_covered'
                                        ? 'bg-slate-700 border-slate-700 text-white'
                                        : opt.value === 'optional'
                                        ? 'bg-amber-600 border-amber-600 text-white'
                                        : 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {cov.status === 'covered' || cov.status === 'optional' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                              <div>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="วงเงิน (บาท)"
                                  value={cov.limitAmount}
                                  onChange={(e) =>
                                    handleCoverageFieldChange(cov.code, 'limitAmount', e.target.value)
                                  }
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  placeholder="เกณฑ์วงเงิน เช่น ตามทุน, ต่อครั้ง"
                                  value={cov.limitBasis}
                                  onChange={(e) =>
                                    handleCoverageFieldChange(cov.code, 'limitBasis', e.target.value)
                                  }
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  placeholder="เงื่อนไขความคุ้มครอง"
                                  value={cov.terms}
                                  onChange={(e) =>
                                    handleCoverageFieldChange(cov.code, 'terms', e.target.value)
                                  }
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  placeholder="ข้อยกเว้น (ถ้ามี)"
                                  value={cov.exclusions}
                                  onChange={(e) =>
                                    handleCoverageFieldChange(cov.code, 'exclusions', e.target.value)
                                  }
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: Document Attachment */}
          {activeTab === 'document' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-600 text-xs">
                <p className="font-semibold text-slate-800 mb-1">
                  การอ้างอิงเอกสารต้นทาง (Section 8.4 & Section 13)
                </p>
                <p>
                  ตามหลักการออกแบบ ทุกชุดข้อมูลที่เผยแพร่ต้องมีเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการ (Rate sheet, Brochure หรือ กรมธรรม์) และระบุเลขหน้าหรือหัวข้อ เพื่อให้สมาชิกในทีมสามารถตรวจเทียบย้อนหลังได้
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ประเภทเอกสาร</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as SourceType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="rate_sheet">ตารางอัตราเบี้ยประกันภัย (Rate Sheet)</option>
                    <option value="policy_schedule">ตารางกรมธรรม์ (Policy Schedule)</option>
                    <option value="brochure">โบรชัวร์เผยแพร่ (Brochure)</option>
                    <option value="endorsement">เอกสารแนบท้าย (Endorsement)</option>
                    <option value="manual_note">บันทึกภายใน (Manual Note)</option>
                    <option value="other">เอกสารอื่น ๆ</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    ชื่อเอกสารอ้างอิง {workflowStatus === 'published' ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ตารางเบี้ยประกันภัยวิริยะ ซุปเปอร์โปรเทค 2569"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">จุดอ้างอิง / เลขหน้าในเอกสาร</label>
                <input
                  type="text"
                  placeholder="เช่น หน้า 3-5 ตารางเบี้ยรถกลุ่ม 3, 4"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Form Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <span>ผู้บันทึก:</span>
              <span className="font-bold text-slate-800">{userName}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกแพ็กเกจ'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
