'use client';

import { useState, useEffect } from 'react';
import { Insurer, VehicleModel, InsuranceType, RepairType, PriceType, CoverageStatus } from '@/types/database';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { MOCK_COVERAGE_TYPES } from '@/lib/queries/mockData';
import {
  X,
  Save,
  AlertCircle,
  Plus,
  FileText,
  Check,
  Sparkles,
  Layers,
  Copy,
  Trash2,
  HelpCircle,
  DollarSign
} from 'lucide-react';

interface CoverageItemState {
  code: string;
  name: string;
  category: string;
  status: CoverageStatus;
  limitAmount?: number | string;
  limitBasis?: string;
  terms?: string;
}

export interface PriceOptionItemState {
  id?: string;
  label: string;
  repairType: RepairType;
  priceType: PriceType;
  hasPrice: boolean;
  premiumTotal?: number | string;
  sumInsuredMax: number | string;
  deductibleAmount: number | string;
  deductibleTerms?: string;
  compulsoryIncluded: 'included' | 'excluded' | 'unspecified';
  driverConditions?: string;
}

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialPlan?: any;
}

export function PlanFormModal({
  isOpen,
  onClose,
  onSaved,
  initialPlan,
}: PlanFormModalProps) {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [vehicles, setVehicles] = useState<VehicleModel[]>([]);

  // 1. Basic Plan info
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentVersionNo, setCurrentVersionNo] = useState<number>(1);
  const [saveMode, setSaveMode] = useState<'update' | 'new_version'>('update');
  const [insurerId, setInsurerId] = useState('');
  const [name, setName] = useState('');
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('ชั้น 1');
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'in_review' | 'published'>('published');
  const [notes, setNotes] = useState('');

  // 2. Vehicle Eligibility
  const [scopeType, setScopeType] = useState<'all_models' | 'specific_model'>('all_models');
  const [vehicleModelId, setVehicleModelId] = useState('');
  const [minCarAge, setMinCarAge] = useState<number | string>(1);
  const [maxCarAge, setMaxCarAge] = useState<number | string>(10);
  const [usageType, setUsageType] = useState<'private' | 'commercial' | 'all'>('private');
  const [inspectionRequired, setInspectionRequired] = useState(false);
  const [ageBasis, setAgeBasis] = useState<'registration_year' | 'manufacture_year'>('registration_year');

  // 3. Price Options (Multiple tiers per plan!)
  const [priceOptionsList, setPriceOptionsList] = useState<PriceOptionItemState[]>([
    {
      label: 'ซ่อมอู่ - ทุน 50,000',
      repairType: 'garage',
      priceType: 'fixed_for_conditions',
      hasPrice: true,
      premiumTotal: 5400,
      sumInsuredMax: 50000,
      deductibleAmount: 0,
      deductibleTerms: '',
      compulsoryIncluded: 'excluded',
      driverConditions: 'ไม่จำกัดชื่อผู้ขับขี่',
    },
  ]);

  // 4. All 14 Standard Coverages
  const [coveragesState, setCoveragesState] = useState<CoverageItemState[]>([]);

  // 5. Document
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [sourceType, setSourceType] = useState('rate_sheet');

  const [activeTab, setActiveTab] = useState<'info' | 'vehicle' | 'price' | 'coverages' | 'document'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Helper: Apply Preset according to insurance type
  const applyCoveragePreset = (type: InsuranceType) => {
    const isType1 = type === 'ชั้น 1';
    const is2Plus = type === 'ชั้น 2+';
    const is3Plus = type === 'ชั้น 3+';

    const newCoverages: CoverageItemState[] = MOCK_COVERAGE_TYPES.map((ct) => {
      let status: CoverageStatus = 'covered';
      let limitAmount: number | string = '';
      let limitBasis = 'ตามทุนประกัน';
      let terms = '';

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
          limitBasis = '-';
        }
      } else if (ct.code === 'theft_fire') {
        if (isType1 || is2Plus || type === 'ชั้น 2') {
          status = 'covered';
          limitBasis = 'ตามทุนประกัน';
        } else {
          status = 'not_covered';
          limitBasis = '-';
        }
      } else if (ct.code === 'flood') {
        if (isType1 || is2Plus) {
          status = 'covered';
          limitBasis = 'ตามทุนประกัน';
        } else {
          status = 'not_covered';
          limitBasis = '-';
        }
      } else if (ct.code === 'windshield') {
        status = isType1 ? 'covered' : 'not_covered';
      } else if (ct.code === 'theft_personal_prop') {
        status = isType1 ? 'optional' : 'not_covered';
        if (status === 'optional') limitAmount = 20000;
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
        status = 'covered';
        limitBasis = 'ช่วยเหลือ 24 ชม.';
      } else if (ct.code === 'towing') {
        status = 'covered';
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
      };
    });

    setCoveragesState(newCoverages);
  };

  useEffect(() => {
    if (isOpen) {
      const insList = InsuranceStore.getInsurers();
      const vehList = InsuranceStore.getVehicleModels();
      setInsurers(insList);
      setVehicles(vehList);

      if (initialPlan) {
        setInsurerId(initialPlan.insurer_id || insList[0]?.id || '');
        setName(initialPlan.name || '');
        setInsuranceType(initialPlan.insurance_type || 'ชั้น 1');
        setWorkflowStatus(initialPlan.currentStatus || 'published');

        // Load existing version data (latest version first)
        const versions = InsuranceStore.getVersions()
          .filter((v) => v.plan_id === initialPlan.id)
          .sort((a, b) => b.version_no - a.version_no);
        const latestVer = versions[0];
        if (latestVer) {
          setCurrentVersionId(latestVer.id);
          setCurrentVersionNo(latestVer.version_no);
          setSaveMode('update');
          setNotes(latestVer.notes || '');

          const rules = InsuranceStore.getEligibilityRules().filter((r) => r.plan_version_id === latestVer.id);
          const rule = rules[0];
          if (rule) {
            setScopeType(rule.scope_type as any || 'all_models');
            setVehicleModelId(rule.vehicle_model_id || '');
            setMinCarAge(rule.min_age ?? 1);
            setMaxCarAge(rule.max_age ?? 10);
            setUsageType(rule.usage_type as any || 'private');
            setInspectionRequired(rule.inspection_required ?? false);

            // Load all price options for this rule!
            const options = InsuranceStore.getPriceOptions().filter((o) => o.eligibility_rule_id === rule.id);
            if (options.length > 0) {
              setPriceOptionsList(
                options.map((o) => ({
                  id: o.id,
                  label: o.label || '',
                  repairType: o.repair_type,
                  priceType: o.price_type,
                  hasPrice: o.premium_total !== null && o.premium_total !== undefined,
                  premiumTotal: o.premium_total ?? '',
                  sumInsuredMax: o.sum_insured_max ?? 500000,
                  deductibleAmount: o.deductible_amount ?? 0,
                  deductibleTerms: o.deductible_terms || '',
                  compulsoryIncluded: o.compulsory_included || 'excluded',
                  driverConditions: o.driver_conditions || 'ไม่จำกัดชื่อผู้ขับขี่',
                }))
              );
            }
          }

          // Load version coverages
          const vCoverages = InsuranceStore.getVersionCoverages().filter((vc) => vc.plan_version_id === latestVer.id);
          if (vCoverages.length > 0) {
            const mapped = MOCK_COVERAGE_TYPES.map((ct) => {
              const found = vCoverages.find((vc) => vc.coverage_type_id === ct.id);
              return {
                code: ct.code,
                name: ct.name,
                category: ct.category,
                status: found?.status ?? 'unknown',
                limitAmount: found?.limit_amount ?? '',
                limitBasis: found?.limit_basis ?? '',
                terms: found?.terms ?? '',
              };
            });
            setCoveragesState(mapped);
          } else {
            applyCoveragePreset(initialPlan.insurance_type || 'ชั้น 1');
          }

          // Load documents
          const docs = InsuranceStore.getDocuments().filter((d) => d.plan_version_id === latestVer.id);
          if (docs.length > 0) {
            setDocumentTitle(docs[0].title);
            setDocumentRef(docs[0].page_reference || '');
          }
        }
      } else {
        setCurrentVersionId(null);
        setCurrentVersionNo(1);
        setSaveMode('new_version');
        setInsurerId(insList[0]?.id || '');
        setName('');
        setInsuranceType('ชั้น 1');
        setWorkflowStatus('published');
        setScopeType('all_models');
        setVehicleModelId('');
        setMinCarAge(1);
        setMaxCarAge(10);
        setPriceOptionsList([
          {
            label: 'ซ่อมอู่ - ทุน 50,000',
            repairType: 'garage',
            priceType: 'fixed_for_conditions',
            hasPrice: true,
            premiumTotal: 5400,
            sumInsuredMax: 50000,
            deductibleAmount: 0,
            deductibleTerms: '',
            compulsoryIncluded: 'excluded',
            driverConditions: 'ไม่จำกัดชื่อผู้ขับขี่',
          },
        ]);
        setDocumentTitle('');
        setDocumentRef('');
        applyCoveragePreset('ชั้น 1');
      }
      setActiveTab('info');
      setErrorMsg('');
    }
  }, [isOpen, initialPlan]);

  if (!isOpen) return null;

  // Add a new price tier
  const handleAddPriceTier = () => {
    const lastTier = priceOptionsList[priceOptionsList.length - 1];
    const newSum = lastTier ? Number(lastTier.sumInsuredMax) + 100000 : 100000;
    const newPremium = lastTier && lastTier.hasPrice ? Number(lastTier.premiumTotal) + 1000 : 6500;
    const repair = lastTier ? lastTier.repairType : 'garage';

    setPriceOptionsList((prev) => [
      ...prev,
      {
        label: `${repair === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${newSum.toLocaleString()}`,
        repairType: repair,
        priceType: 'fixed_for_conditions',
        hasPrice: true,
        premiumTotal: newPremium,
        sumInsuredMax: newSum,
        deductibleAmount: 0,
        deductibleTerms: '',
        compulsoryIncluded: 'excluded',
        driverConditions: 'ไม่จำกัดชื่อผู้ขับขี่',
      },
    ]);
  };

  // Duplicate an existing price tier
  const handleDuplicateTier = (index: number) => {
    const source = priceOptionsList[index];
    const newSum = Number(source.sumInsuredMax) + 50000;
    const newPremium = source.hasPrice ? Number(source.premiumTotal) + 800 : '';

    setPriceOptionsList((prev) => [
      ...prev.slice(0, index + 1),
      {
        ...source,
        id: undefined,
        label: `${source.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${newSum.toLocaleString()}`,
        sumInsuredMax: newSum,
        premiumTotal: newPremium,
      },
      ...prev.slice(index + 1),
    ]);
  };

  // Remove a price tier
  const handleRemoveTier = (index: number) => {
    if (priceOptionsList.length <= 1) {
      alert('แพ็กเกจต้องมีตัวเลือกราคาอย่างน้อย 1 รายการ');
      return;
    }
    setPriceOptionsList((prev) => prev.filter((_, i) => i !== index));
  };

  // Update a field in a price tier
  const handleUpdateTierField = (index: number, field: keyof PriceOptionItemState, value: any) => {
    setPriceOptionsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };

      // Auto update label if sum or repair changed and label matches default pattern
      if (field === 'sumInsuredMax' || field === 'repairType') {
        const sum = field === 'sumInsuredMax' ? value : copy[index].sumInsuredMax;
        const rep = field === 'repairType' ? value : copy[index].repairType;
        copy[index].label = `${rep === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${Number(sum).toLocaleString()}`;
      }

      return copy;
    });
  };

  const handleCoverageStatusChange = (code: string, newStatus: CoverageStatus) => {
    setCoveragesState((prev) =>
      prev.map((c) => (c.code === code ? { ...c, status: newStatus } : c))
    );
  };

  const handleCoverageFieldChange = (code: string, field: 'limitAmount' | 'limitBasis' | 'terms', value: any) => {
    setCoveragesState((prev) =>
      prev.map((c) => (c.code === code ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('กรุณากรอกชื่อแพ็กเกจ');
      setActiveTab('info');
      return;
    }
    if (!insurerId) {
      setErrorMsg('กรุณาเลือกบริษัทประกันภัย');
      setActiveTab('info');
      return;
    }
    if (priceOptionsList.length === 0) {
      setErrorMsg('กรุณาระบุตัวเลือกราคาและทุนประกันอย่างน้อย 1 รายการ');
      setActiveTab('price');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const targetVersionId = initialPlan && saveMode === 'update' && currentVersionId ? currentVersionId : undefined;

    try {
      InsuranceStore.createOrUpdatePlan({
        planId: initialPlan?.id,
        versionId: targetVersionId,
        insurerId,
        name,
        insuranceType,
        workflowStatus,
        notes: saveMode === 'new_version' && initialPlan
          ? `สร้างรุ่นที่ ${currentVersionNo + 1}: ${notes || 'ปรับปรุงเงื่อนไขใหม่'}`
          : notes,
        // Eligibility
        scopeType,
        vehicleModelId: scopeType === 'specific_model' ? vehicleModelId : null,
        minCarAge: Number(minCarAge),
        maxCarAge: Number(maxCarAge),
        usageType,
        inspectionRequired,
        // Multiple Price Options / Tiers!
        priceOptions: priceOptionsList.map((po) => ({
          id: po.id,
          label: po.label || `${po.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${Number(po.sumInsuredMax).toLocaleString()}`,
          repairType: po.repairType,
          priceType: po.priceType,
          premiumTotal: po.hasPrice && po.premiumTotal !== '' ? Number(po.premiumTotal) : null,
          sumInsuredMin: Number(po.sumInsuredMax),
          sumInsuredMax: Number(po.sumInsuredMax),
          deductibleAmount: Number(po.deductibleAmount || 0),
          deductibleTerms: po.deductibleTerms || undefined,
          compulsoryIncluded: po.compulsoryIncluded,
          driverConditions: po.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่',
        })),
        // Coverages
        coverages: coveragesState.map((c) => ({
          code: c.code,
          status: c.status,
          limitAmount: c.limitAmount ? Number(c.limitAmount) : null,
          limitBasis: c.limitBasis || undefined,
          terms: c.terms || undefined,
        })),
        // Document
        documentTitle: documentTitle || undefined,
        documentRef: documentRef || undefined,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(new Set(MOCK_COVERAGE_TYPES.map((c) => c.category)));

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
              รองรับตารางหลายทุนและหลายเบี้ยในแพ็กเกจเดียวกัน (Multiple Price Tiers), เงื่อนไขรถ, ความคุ้มครอง 14 หมวด, และเอกสารต้นทาง
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-slate-100 shrink-0 text-xs">
          {[
            { id: 'info', label: '1. ข้อมูลแพ็กเกจ' },
            { id: 'vehicle', label: '2. เงื่อนไขรถ' },
            { id: 'price', label: `3. ราคาและทุนประกัน (${priceOptionsList.length} ตัวเลือก)` },
            { id: 'coverages', label: `4. ความคุ้มครอง (${coveragesState.length} หมวด)` },
            { id: 'document', label: '5. เอกสารอ้างอิง' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
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

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-6 text-xs pr-1">
          {/* TAB 1: General Info */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {initialPlan && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block animate-pulse"></span>
                      เวอร์ชันปัจจุบันที่กำลังแก้ไข: รุ่นที่ {currentVersionNo}
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
                        value="update"
                        checked={saveMode === 'update'}
                        onChange={() => setSaveMode('update')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>อัปเดตข้อมูลในรุ่นที่ {currentVersionNo} โดยตรง (แก้ไขข้อมูลเดิม)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="saveMode"
                        value="new_version"
                        checked={saveMode === 'new_version'}
                        onChange={() => setSaveMode('new_version')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>สร้างเป็นรุ่นใหม่ (รุ่นที่ {currentVersionNo + 1}) — เก็บประวัติรุ่นเดิม</span>
                    </label>
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
                        {ins.name}
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
                      applyCoveragePreset(newType);
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
                  <label className="font-semibold text-slate-700 block mb-1">สถานะข้อมูล (Workflow Status)</label>
                  <select
                    value={workflowStatus}
                    onChange={(e) => setWorkflowStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="published">เผยแพร่ทันที (Published - แสดงในผลค้นหา)</option>
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
                    onChange={(e) => setScopeType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all_models">รองรับทุกรุ่นภายใต้เงื่อนไข (All Models)</option>
                    <option value="specific_model">เฉพาะรุ่นรถที่ระบุ (Specific Model)</option>
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
                    onChange={(e) => setAgeBasis(e.target.value as any)}
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
                    onChange={(e) => setUsageType(e.target.value as any)}
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

          {/* TAB 3: Multiple Price Options / Tiers (แก้ปัญหา: แพ็กเกจชื่อเดียวกัน ต่างกันที่ทุนและเบี้ย) */}
          {activeTab === 'price' && (
            <div className="space-y-4">
              {/* Informative Guidance Banner */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-blue-900 block">
                      ตารางทุนและเบี้ยประกันภัย (Price Options / Tiers)
                    </span>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      แพ็กเกจชื่อเดียวกันสามารถมีได้หลายตัวเลือกราคา โดยระบุทุนประกันและเบี้ยที่ต่างกันได้
                      (เช่น ทุน 50,000 เบี้ย 5,400 / ทุน 100,000 เบี้ย 6,200 หรือ ซ่อมห้าง/ซ่อมอู่)
                      ทุกตัวเลือกจะแชร์ชื่อแพ็กเกจและความคุ้มครองหลักร่วมกันโดยอัตโนมัติ
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

              {/* Price Options Cards List */}
              <div className="space-y-3">
                {priceOptionsList.map((tier, idx) => (
                  <div
                    key={idx}
                    className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 relative hover:border-slate-300 transition"
                  >
                    {/* Tier Card Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">
                          {tier.label || `ตัวเลือกที่ ${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
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

                    {/* Inputs Grid for this Tier */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          ทุนประกันภัย (บาท) *
                        </label>
                        <input
                          type="number"
                          required
                          step={10000}
                          placeholder="เช่น 50000 หรือ 100000"
                          value={tier.sumInsuredMax}
                          onChange={(e) => handleUpdateTierField(idx, 'sumInsuredMax', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-slate-700">เบี้ยประกันรวม (บาท)</label>
                          <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!tier.hasPrice}
                              onChange={(e) => handleUpdateTierField(idx, 'hasPrice', !e.target.checked)}
                              className="rounded"
                            />
                            <span>ยังไม่ระบุ</span>
                          </label>
                        </div>
                        {tier.hasPrice ? (
                          <input
                            type="number"
                            step={100}
                            placeholder="เช่น 5400"
                            value={tier.premiumTotal}
                            onChange={(e) => handleUpdateTierField(idx, 'premiumTotal', e.target.value)}
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
                          onChange={(e) => handleUpdateTierField(idx, 'repairType', e.target.value as RepairType)}
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
                          onChange={(e) => handleUpdateTierField(idx, 'deductibleAmount', e.target.value)}
                          placeholder="0 หากไม่มี"
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">การรวม พ.ร.บ.</label>
                        <select
                          value={tier.compulsoryIncluded}
                          onChange={(e) => handleUpdateTierField(idx, 'compulsoryIncluded', e.target.value as any)}
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
                          onChange={(e) => handleUpdateTierField(idx, 'driverConditions', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Add Tier Button */}
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

          {/* TAB 4: Full 14 Coverages Editor */}
          {activeTab === 'coverages' && (
            <div className="space-y-6">
              {/* Preset buttons */}
              <div className="flex items-center justify-between bg-blue-50/70 p-3 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 text-blue-900 font-bold">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>ตั้งค่ามาตรฐานด่วนตามประเภทประกัน:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyCoveragePreset('ชั้น 1')}
                    className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-300 font-semibold cursor-pointer"
                  >
                    ชั้น 1
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCoveragePreset('ชั้น 2+')}
                    className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-300 font-semibold cursor-pointer"
                  >
                    ชั้น 2+
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCoveragePreset('ชั้น 3+')}
                    className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-300 font-semibold cursor-pointer"
                  >
                    ชั้น 3+
                  </button>
                </div>
              </div>

              {/* Coverages categorized */}
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

                            {/* Status Selector */}
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

                          {/* Limit Amount & Basis inputs */}
                          {cov.status === 'covered' || cov.status === 'optional' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                              <div>
                                <input
                                  type="number"
                                  placeholder="วงเงิน (บาท) เว้นว่างหากตามทุน"
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
                                  placeholder="เกณฑ์วงเงิน เช่น ต่อคน, ต่อครั้ง"
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
                                  placeholder="เงื่อนไข/ข้อยกเว้นเพิ่มเติม"
                                  value={cov.terms}
                                  onChange={(e) =>
                                    handleCoverageFieldChange(cov.code, 'terms', e.target.value)
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
                  การอ้างอิงเอกสารต้นทาง (Section 13)
                </p>
                <p>
                  ตามหลักการออกแบบ ทุกชุดข้อมูลที่เผยแพร่ต้องมีเอกสารอ้างอิงต้นทาง (Rate sheet, Brochure หรือ กรมธรรม์) และระบุเลขหน้าหรือหัวข้อ เพื่อให้สมาชิกในทีมสามารถตรวจเทียบย้อนหลังได้
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ประเภทเอกสาร</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="rate_sheet">ตารางอัตราเบี้ยประกันภัย (Rate Sheet)</option>
                    <option value="policy_schedule">ตารางกรมธรรม์ (Policy Schedule)</option>
                    <option value="brochure">โบรชัวร์เผยแพร่ (Brochure)</option>
                    <option value="endorsement">เอกสารแนบท้าย (Endorsement)</option>
                    <option value="other">เอกสารอื่น ๆ</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ชื่อเอกสารอ้างอิง</label>
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
              <span>แท็บปัจจุบัน:</span>
              <span className="font-bold text-blue-700 uppercase">{activeTab}</span>
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
