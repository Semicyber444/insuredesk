'use client';

import { useState, useEffect } from 'react';
import { Insurer, VehicleModel, InsuranceType, RepairType, PriceType } from '@/types/database';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { X, Save, AlertCircle, Plus, FileText, Check } from 'lucide-react';

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialPlan?: any; // If editing
}

export function PlanFormModal({
  isOpen,
  onClose,
  onSaved,
  initialPlan,
}: PlanFormModalProps) {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [vehicles, setVehicles] = useState<VehicleModel[]>([]);

  // Form states
  const [insurerId, setInsurerId] = useState('');
  const [name, setName] = useState('');
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('ชั้น 1');
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'in_review' | 'published'>('published');
  const [notes, setNotes] = useState('');

  // Eligibility
  const [scopeType, setScopeType] = useState<'all_models' | 'specific_model'>('all_models');
  const [vehicleModelId, setVehicleModelId] = useState('');
  const [minCarAge, setMinCarAge] = useState(1);
  const [maxCarAge, setMaxCarAge] = useState(10);

  // Price Option
  const [priceOptionLabel, setPriceOptionLabel] = useState('');
  const [repairType, setRepairType] = useState<RepairType>('garage');
  const [priceType, setPriceType] = useState<PriceType>('fixed_for_conditions');
  const [hasPrice, setHasPrice] = useState(true);
  const [premiumTotal, setPremiumTotal] = useState<number | string>(15000);
  const [sumInsured, setSumInsured] = useState<number | string>(500000);
  const [deductibleAmount, setDeductibleAmount] = useState<number | string>(0);
  const [compulsoryIncluded, setCompulsoryIncluded] = useState<'included' | 'excluded'>('excluded');

  // Key Coverages
  const [coverOwnDamage, setCoverOwnDamage] = useState(true);
  const [coverTheftFire, setCoverTheftFire] = useState(true);
  const [coverFlood, setCoverFlood] = useState(true);
  const [tpPersonLimit, setTpPersonLimit] = useState(1000000);

  // Document
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentRef, setDocumentRef] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
      } else {
        setInsurerId(insList[0]?.id || '');
        setName('');
        setInsuranceType('ชั้น 1');
        setWorkflowStatus('published');
        setPriceOptionLabel('');
        setPremiumTotal(15000);
        setSumInsured(500000);
        setDeductibleAmount(0);
        setDocumentTitle('');
      }
    }
  }, [isOpen, initialPlan]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('กรุณากรอกชื่อแพ็กเกจ');
      return;
    }
    if (!insurerId) {
      setErrorMsg('กรุณาเลือกบริษัทประกัน');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      InsuranceStore.createOrUpdatePlan({
        planId: initialPlan?.id,
        insurerId,
        name,
        insuranceType,
        workflowStatus,
        notes,
        scopeType,
        vehicleModelId: scopeType === 'specific_model' ? vehicleModelId : null,
        minCarAge: Number(minCarAge),
        maxCarAge: Number(maxCarAge),
        priceOptionLabel: priceOptionLabel || `${repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ทุน ${Number(sumInsured).toLocaleString()}`,
        repairType,
        priceType,
        premiumTotal: hasPrice ? Number(premiumTotal) : null,
        sumInsuredMin: Number(sumInsured),
        sumInsuredMax: Number(sumInsured),
        deductibleAmount: Number(deductibleAmount),
        compulsoryIncluded,
        coverages: [
          { code: 'own_damage', status: coverOwnDamage ? 'covered' : 'not_covered' },
          { code: 'theft_fire', status: coverTheftFire ? 'covered' : 'not_covered' },
          { code: 'flood', status: coverFlood ? 'covered' : 'not_covered' },
          { code: 'tp_life_person', status: 'covered', limitAmount: Number(tpPersonLimit), limitBasis: 'ต่อคน' },
          { code: 'roadside_assist', status: 'covered', limitBasis: 'ช่วยเหลือ 24 ชม.' },
        ],
        documentTitle: documentTitle ? documentTitle : undefined,
        documentRef: documentRef ? documentRef : undefined,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {initialPlan ? 'แก้ไขข้อมูลแพ็กเกจประกัน' : 'สร้างแพ็กเกจประกันใหม่'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              บันทึกเงื่อนไขรถ ราคา ความคุ้มครอง และเอกสารอ้างอิงอย่างเป็นระบบ
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Section 1: Basic Plan Info */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-blue-700">
              1. ข้อมูลทั่วไปของแพ็กเกจ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  onChange={(e) => setInsuranceType(e.target.value as InsuranceType)}
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
                placeholder="เช่น วิริยะ ซุปเปอร์โปรเทค พรีเมียม หรือ BKI Care 2+"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">สถานะข้อมูล (Workflow Status)</label>
              <select
                value={workflowStatus}
                onChange={(e) => setWorkflowStatus(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="published">เผยแพร่ทันที (Published - แสดงในหน้าค้นหาทันที)</option>
                <option value="in_review">ส่งตรวจ (In Review - ไปที่คิวผู้ตรวจสอบ)</option>
                <option value="draft">บันทึกเป็นร่าง (Draft)</option>
              </select>
            </div>
          </div>

          {/* Section 2: Vehicle Eligibility */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-blue-700">
              2. เงื่อนไขรถที่รับประกัน (Vehicle Eligibility)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">ขอบเขตรุ่นรถ</label>
                <select
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all_models">ทุกรุ่นภายใต้เงื่อนไขอายุ (All Models)</option>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">อายุรถขั้นต่ำ (ปี)</label>
                <input
                  type="number"
                  min={0}
                  value={minCarAge}
                  onChange={(e) => setMinCarAge(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">อายุรถสูงสุด (ปี)</label>
                <input
                  type="number"
                  min={0}
                  value={maxCarAge}
                  onChange={(e) => setMaxCarAge(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Price Option */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-blue-700">
              3. ราคาและทุนประกัน (Price Option)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">ลักษณะการซ่อม *</label>
                <select
                  value={repairType}
                  onChange={(e) => setRepairType(e.target.value as RepairType)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="dealer">ซ่อมห้าง (ศูนย์บริการ)</option>
                  <option value="garage">ซ่อมอู่ (อู่ในเครือ)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ทุนประกันภัย (บาท) *</label>
                <input
                  type="number"
                  required
                  step={10000}
                  value={sumInsured}
                  onChange={(e) => setSumInsured(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">เบี้ยประกันรวม (บาท)</label>
                  <label className="text-[11px] text-slate-500 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hasPrice}
                      onChange={(e) => setHasPrice(!e.target.checked)}
                      className="rounded"
                    />
                    <span>ยังไม่ระบุราคา</span>
                  </label>
                </div>
                {hasPrice ? (
                  <input
                    type="number"
                    step={100}
                    value={premiumTotal}
                    onChange={(e) => setPremiumTotal(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-900"
                  />
                ) : (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 font-semibold">
                    แสดง &quot;ยังไม่มีข้อมูลราคา&quot;
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ค่าเสียหายส่วนแรก Deductible (บาท)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={deductibleAmount}
                  onChange={(e) => setDeductibleAmount(e.target.value)}
                  placeholder="0 หากไม่มี"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Coverages Check */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-blue-700">
              4. ความคุ้มครองหลัก
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={coverOwnDamage}
                  onChange={(e) => setCoverOwnDamage(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-semibold text-slate-700">ชนตัวรถ</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={coverTheftFire}
                  onChange={(e) => setCoverTheftFire(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-semibold text-slate-700">รถหาย/ไฟไหม้</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={coverFlood}
                  onChange={(e) => setCoverFlood(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-semibold text-slate-700">น้ำท่วม</span>
              </label>
            </div>
          </div>

          {/* Section 5: Source Document */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-blue-700">
              5. เอกสารอ้างอิงต้นทาง (Source Document)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">ชื่อเอกสารอ้างอิง</label>
                <input
                  type="text"
                  placeholder="เช่น ตารางเบี้ยประกันภัยประจำปี 2569"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">จุดอ้างอิง / เลขหน้า</label>
                <input
                  type="text"
                  placeholder="เช่น หน้า 2 ตารางเบี้ยรถกลุ่ม 3"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
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
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
