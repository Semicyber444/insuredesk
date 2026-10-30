'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getPlanById } from '@/lib/queries/plans';
import { resolveCoverages } from '@/lib/queries/search';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { PlanFormModal } from '@/components/forms/PlanFormModal';
import {
  ArrowLeft,
  Shield,
  FileText,
  CheckCircle2,
  Clock,
  History,
  Car,
  ExternalLink,
  Edit3
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

  const [plan, setPlan] = useState<any>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    getPlanById(planId).then((res) => {
      setPlan(res);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadData();
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

  const latestVersion = plan.versions[0];
  const allRules = InsuranceStore.getEligibilityRules();
  const rules = allRules.filter((r) => r.plan_version_id === latestVersion?.id);
  const ruleIds = rules.map((r) => r.id);

  const allOptions = InsuranceStore.getPriceOptions();
  const options = allOptions.filter((o) => ruleIds.includes(o.eligibility_rule_id));

  const allDocs = InsuranceStore.getDocuments();
  const docs = allDocs.filter((d) => d.plan_version_id === latestVersion?.id);

  const allAudit = InsuranceStore.getAuditLogs();
  const auditLogs = allAudit.filter(
    (a) => a.entity_id === latestVersion?.id || a.entity_id === plan.id
  );

  const vehicleModels = InsuranceStore.getVehicleModels();

  const activeOptionId = selectedOptionId || initialOptionId || options[0]?.id;
  const selectedOption = options.find((o) => o.id === activeOptionId) || options[0];
  const coverages = latestVersion && selectedOption ? resolveCoverages(latestVersion.id, selectedOption.id) : [];

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
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {plan.insurer?.name}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {plan.insurance_type}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                รุ่นที่ {latestVersion?.version_no} ({latestVersion?.workflow_status})
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{plan.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              ช่องทางติดต่อบริษัท: {plan.insurer?.contact_channels || '-'} • เว็บไซต์: {plan.insurer?.website || '-'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>แก้ไขข้อมูลแพ็กเกจ</span>
            </button>

            {selectedOption && (
              <Link
                href={`/compare?ids=${selectedOption.id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <span>เปิดในตารางเปรียบเทียบ</span>
              </Link>
            )}
          </div>
        </div>

        {/* Versions Ribbon (Section 12: เก็บรุ่นเดิมเพื่ออ่านย้อนหลัง ไม่แก้ทับ) */}
        <div className="pt-4 flex items-center gap-3 overflow-x-auto text-xs">
          <span className="font-semibold text-slate-500 flex items-center gap-1">
            <History className="w-3.5 h-3.5" />
            ประวัติรุ่น (Versions):
          </span>
          {plan.versions.map((ver: any) => (
            <div
              key={ver.id}
              className={`px-3 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${
                ver.id === latestVersion?.id
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span>รุ่นที่ {ver.version_no}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">({ver.workflow_status})</span>
            </div>
          ))}
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
            {rules.map((r) => {
              const vehicle = r.vehicle_model_id
                ? vehicleModels.find((v) => v.id === r.vehicle_model_id)
                : null;
              return (
                <div key={r.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    {r.scope_type === 'specific_model' ? (
                      `เฉพาะรุ่น: ${vehicle?.brand} ${vehicle?.model} (${vehicle?.variant || ''})`
                    ) : (
                      'รองรับรถทั่วไปทุกรุ่นภายใต้เงื่อนไข'
                    )}
                  </div>
                  <div className="text-slate-600">
                    อายุรถ: {r.min_age ?? 1} - {r.max_age ?? 10} ปี ({r.age_basis || 'ปีจดทะเบียน'})
                  </div>
                  <div className="text-slate-500">{r.notes}</div>
                </div>
              );
            })}
          </div>

          {/* Price Options List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">ตัวเลือกราคาในรุ่นนี้ ({options.length})</h3>
            <div className="space-y-2">
              {options.map((opt) => {
                const isCurrent = opt.id === selectedOption?.id;
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
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800">{opt.label}</span>
                      <span className="font-extrabold text-blue-900">
                        {opt.premium_total ? `฿${opt.premium_total.toLocaleString()}` : 'ยังไม่ระบุราคา'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{opt.repair_type === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'}</span>
                      <span>• ทุน ฿{(opt.sum_insured_max ?? 0).toLocaleString()}</span>
                      {opt.deductible_amount > 0 && (
                        <span className="text-amber-700">• Deduct ฿{opt.deductible_amount.toLocaleString()}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Documents */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>เอกสารต้นทางอ้างอิง ({docs.length})</span>
            </h3>
            {docs.map((doc) => (
              <div key={doc.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800 line-clamp-1">{doc.title}</div>
                {doc.page_reference && (
                  <div className="text-[11px] text-slate-500">จุดอ้างอิง: {doc.page_reference}</div>
                )}
                <div className="text-[10px] text-slate-400">
                  ไฟล์: {doc.storage_path} • ขนาด {(doc.file_size ? (doc.file_size / 1024).toFixed(0) : 0)} KB
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Full Coverages & Overrides (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">ตารางความคุ้มครองและข้อยกเว้น</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  แสดงผลตามตัวเลือก &quot;{selectedOption?.label}&quot; (รวมข้อยกเว้นและเงื่อนไขเฉพาะ)
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {coverages.length} หมวด
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {coverages.map((cov) => (
                <div key={cov.code} className="py-3.5 flex items-start justify-between gap-4 text-xs">
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
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {cov.status === 'covered'
                        ? cov.limitAmount
                          ? `฿${cov.limitAmount.toLocaleString()} ${cov.limitBasis ? '(' + cov.limitBasis + ')' : ''}`
                          : cov.limitBasis || 'คุ้มครองตามเงื่อนไข'
                        : cov.status === 'not_covered'
                        ? 'ไม่คุ้มครอง'
                        : 'ซื้อเพิ่มได้ (Optional)'}
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
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="font-bold text-slate-700">ผู้ดำเนินการ: {log.actor_name || 'ระบบ'}</span>
                    <span>{new Date(log.created_at).toLocaleString('th-TH')}</span>
                  </div>
                  <div className="text-slate-800 font-medium">
                    การกระทำ: <span className="text-blue-700 uppercase font-bold">{log.action}</span>
                  </div>
                  {log.reason && <div className="text-slate-600 mt-0.5">เหตุผล: {log.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <PlanFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={loadData}
        initialPlan={plan}
      />
    </div>
  );
}
