'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { getPlanById, PlanDetailData, submitForReview } from '@/lib/queries/plans';
import { resolveCoverages } from '@/lib/queries/search';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { useAuth } from '@/lib/auth/AuthContext';
import { PlanFormModal } from '@/components/forms/PlanFormModal';
import {
  ArrowLeft,
  FileText,
  History,
  Car,
  Edit3,
  Columns3,
  Plus,
  Check,
  Send,
  Lock,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ optionId?: string }>;
}

export default function PlanDetailPage({ params, searchParams }: Props) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);

  const planId = resolvedParams.id;
  const initialOptionId = resolvedSearchParams.optionId;

  const { activeRole, userName, can } = useAuth();

  const [plan, setPlan] = useState<PlanDetailData | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [compareBasket, setCompareBasket] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const reloadData = useCallback(() => {
    setIsLoading(true);
    getPlanById(planId).then((res) => {
      setPlan(res);
      setCompareBasket(InsuranceStore.getCompareBasket());
      setIsLoading(false);
    });
  }, [planId]);

  useEffect(() => {
    let isMounted = true;
    getPlanById(planId).then((res) => {
      if (!isMounted) return;
      setPlan(res);
      setCompareBasket(InsuranceStore.getCompareBasket());
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [planId]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        กำลังโหลดข้อมูลแพ็กเกจ...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-slate-800">ไม่พบแพ็กเกจที่ระบุ</h2>
        <Link href="/search" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
          กลับไปหน้ารายการค้นหา
        </Link>
      </div>
    );
  }

  const publishedVersions = plan.versions.filter((v) => v.workflow_status === 'published');
  const isViewerRestricted = activeRole === 'viewer' && (plan.is_archived || publishedVersions.length === 0);

  if (isViewerRestricted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">แพ็กเกจนี้ยังไม่เปิดเผยแพร่สำหรับฝ่ายขาย</h2>
        <p className="text-xs text-slate-500">
          เฉพาะผู้กรอกข้อมูล (Editor), ผู้ตรวจสอบ (Reviewer), และผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดูข้อมูลร่างหรือข้อมูลที่จัดเก็บเข้ากรุได้
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับไปหน้าค้นหา</span>
        </Link>
      </div>
    );
  }

  const visibleVersions =
    activeRole === 'viewer' ? publishedVersions : plan.versions;

  const defaultVersion = publishedVersions[0] ?? visibleVersions[0];
  const activeVersion =
    visibleVersions.find((v) => v.id === selectedVersionId) ?? defaultVersion;

  const allRules = InsuranceStore.getEligibilityRules();
  const rules = allRules.filter((r) => r.plan_version_id === activeVersion?.id);
  const ruleIds = rules.map((r) => r.id);

  const allOptions = InsuranceStore.getPriceOptions();
  const options = allOptions.filter((o) => ruleIds.includes(o.eligibility_rule_id));

  const allDocs = InsuranceStore.getDocuments();
  const docs = allDocs.filter((d) => d.plan_version_id === activeVersion?.id);

  const versionIdSet = new Set(plan.versions.map((v) => v.id));
  const allAudit = InsuranceStore.getAuditLogs();
  const auditLogs = allAudit.filter(
    (a) => versionIdSet.has(a.entity_id) || a.entity_id === plan.id
  );

  const vehicleModels = InsuranceStore.getVehicleModels();

  const activeOptionId = selectedOptionId || initialOptionId || options[0]?.id;
  const selectedOption = options.find((o) => o.id === activeOptionId) || options[0];
  const coverages =
    activeVersion && selectedOption ? resolveCoverages(activeVersion.id, selectedOption.id) : [];

  const isInBasket = selectedOption ? compareBasket.includes(selectedOption.id) : false;

  const handleToggleCompare = () => {
    if (!selectedOption) return;
    const next = compareBasket.includes(selectedOption.id)
      ? compareBasket.filter((id) => id !== selectedOption.id)
      : compareBasket.length >= 4
      ? compareBasket
      : [...compareBasket, selectedOption.id];
    InsuranceStore.setCompareBasket(next);
    setCompareBasket(next);
  };

  const handleSubmitDraftForReview = async () => {
    if (!activeVersion) return;
    await submitForReview(
      activeVersion.id,
      `ส่งตรวจสอบแพ็กเกจ "${plan.name}" รุ่นที่ ${activeVersion.version_no}`,
      userName
    );
    reloadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับไปหน้ารายการค้นหา</span>
        </Link>
      </div>

      {/* Plan Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {plan.insurer?.name || 'ไม่ระบุบริษัท'}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {plan.insurance_type}
              </span>
              {activeVersion && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    activeVersion.workflow_status === 'published'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : activeVersion.workflow_status === 'in_review'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  รุ่นที่ {activeVersion.version_no} ({activeVersion.workflow_status})
                </span>
              )}
              {plan.is_archived && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                  จัดเก็บเข้ากรุแล้ว (Archived)
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{plan.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              ช่องทางติดต่อบริษัท: {plan.insurer?.contact_channels || '-'} • เว็บไซต์:{' '}
              {plan.insurer?.website || '-'}
              {activeVersion?.effective_from && (
                <>
                  {' '}
                  • มีผลบังคับใช้: {activeVersion.effective_from} ถึง{' '}
                  {activeVersion.effective_to || 'ไม่กำหนด'}
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can('canSubmitReview') && activeVersion?.workflow_status === 'draft' && (
              <button
                type="button"
                onClick={handleSubmitDraftForReview}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-amber-700" />
                <span>ส่งตรวจสอบ (Submit Review)</span>
              </button>
            )}

            {can('canEditDraft') && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>แก้ไขข้อมูลแพ็กเกจ</span>
              </button>
            )}

            {selectedOption && activeVersion?.workflow_status === 'published' && (
              <button
                type="button"
                onClick={handleToggleCompare}
                disabled={!isInBasket && compareBasket.length >= 4}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isInBasket
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50'
                }`}
              >
                {isInBasket ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isInBasket ? 'อยู่ในรายการเปรียบเทียบแล้ว' : 'เพิ่มลงรายการเปรียบเทียบ'}</span>
              </button>
            )}

            {options.length >= 2 && activeVersion?.workflow_status === 'published' && (
              <Link
                href={`/compare?ids=${options
                  .slice(0, 4)
                  .map((o) => o.id)
                  .join(',')}`}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>เทียบตัวเลือกในแผนนี้ ({Math.min(options.length, 4)})</span>
              </Link>
            )}

            {compareBasket.length >= 2 && (
              <Link
                href={`/compare?ids=${compareBasket.join(',')}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>เปิดตารางเปรียบเทียบ ({compareBasket.length})</span>
              </Link>
            )}
          </div>
        </div>

        {/* Interactive Versions Ribbon (Section 12: เลือกดูประวัติรุ่นย้อนหลังได้) */}
        <div className="pt-4 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="font-semibold text-slate-500 flex items-center gap-1 shrink-0">
            <History className="w-3.5 h-3.5" />
            ประวัติรุ่น (คลิกเพื่อดูย้อนหลัง):
          </span>
          {visibleVersions.map((ver) => {
            const isSelectedVer = ver.id === activeVersion?.id;
            return (
              <button
                key={ver.id}
                type="button"
                onClick={() => {
                  setSelectedVersionId(ver.id);
                  setSelectedOptionId(null);
                }}
                className={`px-3 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                  isSelectedVer
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>รุ่นที่ {ver.version_no}</span>
                <span
                  className={`text-[10px] uppercase font-bold ${
                    isSelectedVer ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  ({ver.workflow_status})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Options + Coverages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Price Options & Vehicle Eligibility */}
        <div className="space-y-6">
          {/* Eligibility Rules */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              <span>เงื่อนไขรถที่รับประกัน</span>
            </h3>
            {rules.length === 0 ? (
              <p className="text-xs text-slate-400">ยังไม่มีข้อมูลเงื่อนไขรถยนต์ในรุ่นนี้</p>
            ) : (
              rules.map((r) => {
                const vehicle = r.vehicle_model_id
                  ? vehicleModels.find((v) => v.id === r.vehicle_model_id)
                  : null;
                const ageBasisThai =
                  r.age_basis === 'manufacture_year'
                    ? 'นับตามปีผลิต ค.ศ.'
                    : r.age_basis === 'registration_year'
                    ? 'นับตามปีจดทะเบียน'
                    : 'ยังไม่ระบุเกณฑ์นับอายุ';
                return (
                  <div
                    key={r.id}
                    className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1"
                  >
                    <div className="font-bold text-slate-800">
                      {r.scope_type === 'specific_model'
                        ? `เฉพาะรุ่น: ${vehicle?.brand ?? ''} ${vehicle?.model ?? ''} ${
                            vehicle?.variant ? `(${vehicle.variant})` : ''
                          }`.trim()
                        : r.scope_type === 'unknown'
                        ? 'ยังไม่ระบุขอบเขตรุ่นรถชัดเจน'
                        : 'รองรับรถทั่วไปทุกรุ่นภายใต้เงื่อนไข'}
                    </div>
                    <div className="text-slate-600">
                      อายุรถ: {r.min_age ?? 1} - {r.max_age ?? 10} ปี ({ageBasisThai})
                    </div>
                    <div className="text-slate-600">
                      ตรวจสภาพรถ:{' '}
                      {r.inspection_required ? 'ต้องตรวจสภาพรถก่อนทำประกัน' : 'ไม่ต้องตรวจสภาพรถ'}
                    </div>
                    {r.notes && <div className="text-slate-500">{r.notes}</div>}
                  </div>
                );
              })
            )}
          </div>

          {/* Price Options List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              ตัวเลือกราคาในรุ่นนี้ ({options.length})
            </h3>
            {options.length === 0 ? (
              <p className="text-xs text-slate-400">ยังไม่มีตัวเลือกราคาในรุ่นนี้</p>
            ) : (
              <div className="space-y-2">
                {options.map((opt) => {
                  const isCurrent = opt.id === selectedOption?.id;
                  const sumVal = opt.sum_insured_max ?? opt.sum_insured_min;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-bold text-slate-800">{opt.label}</span>
                        <span className="font-extrabold text-blue-900 shrink-0">
                          {opt.premium_total !== null && opt.premium_total !== undefined
                            ? `฿${opt.premium_total.toLocaleString('th-TH')}`
                            : 'ยังไม่มีข้อมูลราคา'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{opt.repair_type === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'}</span>
                        <span>
                          •{' '}
                          {sumVal !== null && sumVal !== undefined
                            ? `ทุน ฿${sumVal.toLocaleString('th-TH')}`
                            : 'ยังไม่ระบุทุน'}
                        </span>
                        {opt.deductible_amount > 0 && (
                          <span className="text-amber-700">
                            • Deduct ฿{opt.deductible_amount.toLocaleString('th-TH')}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Source Documents */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>เอกสารต้นทางอ้างอิง ({docs.length})</span>
            </h3>
            {docs.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                ยังไม่มีเอกสารอ้างอิงแนบในรุ่นนี้ (ต้องแนบอย่างน้อย 1 รายการก่อนอนุมัติเผยแพร่)
              </p>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1"
                >
                  <div className="font-bold text-slate-800 line-clamp-1">{doc.title}</div>
                  {doc.page_reference && (
                    <div className="text-[11px] text-slate-500">จุดอ้างอิง: {doc.page_reference}</div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    ประเภท: {doc.source_type}
                    {doc.storage_path ? ` • ไฟล์: ${doc.storage_path}` : ''}
                    {doc.file_size ? ` (${(doc.file_size / 1024).toFixed(0)} KB)` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Full Coverages & Overrides */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">ตารางความคุ้มครองและข้อยกเว้น</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedOption
                    ? `แสดงผลตามตัวเลือก "${selectedOption.label}" (รวมข้อยกเว้นและเงื่อนไขเฉพาะ)`
                    : 'ยังไม่มีตัวเลือกราคาให้แสดงผล'}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {coverages.length} หมวด
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {coverages.map((cov) => (
                <div
                  key={cov.code}
                  className="py-3.5 flex items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{cov.name}</span>
                      {cov.isOverridden && (
                        <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded">
                          Override เฉพาะตัวเลือกนี้
                        </span>
                      )}
                    </div>
                    {cov.terms && <p className="text-slate-500 text-[11px]">{cov.terms}</p>}
                    {cov.exclusions && (
                      <p className="text-amber-700 text-[11px]">ข้อยกเว้น: {cov.exclusions}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block font-bold px-2 py-0.5 rounded text-xs ${
                        cov.status === 'covered'
                          ? 'bg-emerald-50 text-emerald-800'
                          : cov.status === 'not_covered'
                          ? 'bg-slate-100 text-slate-500'
                          : cov.status === 'optional'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {cov.status === 'covered'
                        ? cov.limitAmount
                          ? `฿${cov.limitAmount.toLocaleString('th-TH')}${
                              cov.limitBasis ? ` (${cov.limitBasis})` : ''
                            }`
                          : cov.limitBasis || 'คุ้มครอง (ยังไม่ระบุวงเงิน)'
                        : cov.status === 'not_covered'
                        ? 'ไม่คุ้มครอง'
                        : cov.status === 'optional'
                        ? 'ซื้อเพิ่มได้ (Optional)'
                        : 'ยังไม่ระบุ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Trail for this Plan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <span>ประวัติการเปลี่ยนแปลงและการตรวจสอบ (Audit Trail)</span>
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400">ยังไม่มีประวัติบันทึกสำหรับแพ็กเกจนี้</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="font-bold text-slate-700">
                        ผู้ดำเนินการ: {log.actor_name || 'ระบบ'}
                      </span>
                      <span>{new Date(log.created_at).toLocaleString('th-TH')}</span>
                    </div>
                    <div className="text-slate-800 font-medium">
                      การกระทำ:{' '}
                      <span className="text-blue-700 uppercase font-bold">{log.action}</span>
                    </div>
                    {log.reason && (
                      <div className="text-slate-600 mt-0.5">เหตุผล: {log.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <PlanFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={reloadData}
        initialPlan={plan}
      />
    </div>
  );
}
