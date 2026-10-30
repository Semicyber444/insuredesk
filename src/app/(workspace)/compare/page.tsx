'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { getComparisonData, ComparisonResult } from '@/lib/queries/compare';
import {
  Columns3,
  AlertTriangle,
  FileText,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  ShieldAlert,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';

function CompareContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids');

  const [data, setData] = useState<ComparisonResult | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ids: string[] = [];
    if (idsParam) {
      ids = idsParam.split(',').filter(Boolean);
    }

    if (ids.length >= 2) {
      setIsLoading(true);
      getComparisonData(ids).then((res) => {
        setData(res);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [idsParam]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium text-slate-600">กำลังโหลดข้อมูลเปรียบเทียบ...</p>
      </div>
    );
  }

  if (!data || data.options.length < 2) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Columns3 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">กรุณาเลือกตัวเลือกประกัน 2 ถึง 4 รายการ</h2>
        <p className="text-sm text-slate-500 mt-2">
          ไปที่หน้าค้นหาประกัน และกดปุ่ม &quot;เปรียบเทียบ&quot; ที่แพ็กเกจที่ต้องการนำมาเทียบเงื่อนไข
        </p>
        <div className="mt-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xs hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับไปหน้าค้นหา</span>
          </Link>
        </div>
      </div>
    );
  }

  const { options, warnings, categories } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/search"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              กลับไปหน้าค้นหา
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>เปรียบเทียบแพ็กเกจประกัน ({options.length} รายการ)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ระบบเปรียบเทียบโดยไม่จัดอันดับแผนดีที่สุดโดยอัตโนมัติ เพื่อให้ทีมพิจารณาตามข้อเท็จจริงในเอกสาร
          </p>
        </div>

        {/* Diff Mode Toggle */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2 px-3 shadow-xs">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyDifferences}
              onChange={(e) => setOnlyDifferences(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>แสดงเฉพาะหัวข้อที่มีความแตกต่าง</span>
          </label>
        </div>
      </div>

      {/* Warnings & Differences Alert Banner (Section 11) */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>ข้อสังเกตความแตกต่างที่สำคัญ ({warnings.length} รายการ)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-amber-800">
            {warnings.map((w, idx) => (
              <div key={idx} className="bg-white/70 p-2.5 rounded-lg border border-amber-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-950 block">{w.title}</span>
                  <span className="text-[11px] text-amber-800">{w.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Grid Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            {/* Header Columns for Each Plan */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 w-64 min-w-[200px] text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100/60 sticky left-0 z-10">
                  รายการเปรียบเทียบ
                </th>
                {options.map((opt) => (
                  <th key={opt.id} className="p-4 min-w-[240px] align-top border-l border-slate-200">
                    <div className="flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {opt.insurerName}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                            {opt.insuranceType}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-2">{opt.planName}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{opt.priceOptionLabel}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <div className="text-xl font-black text-slate-900">
                          {opt.premiumTotal ? (
                            `฿${opt.premiumTotal.toLocaleString('th-TH')}`
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ยังไม่มีข้อมูลราคา
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {opt.repairType === 'dealer' ? 'ซ่อมห้าง (ศูนย์บริการ)' : 'ซ่อมอู่ในเครือ'}
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Core Specs Section */}
            <tbody>
              <tr className="bg-slate-100/70 border-b border-slate-200">
                <td colSpan={options.length + 1} className="p-2.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. ข้อมูลพื้นฐานและเงื่อนไขราคา
                </td>
              </tr>

              {/* Row: ทุนประกัน */}
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-3.5 text-xs font-semibold text-slate-700 bg-slate-50/50 sticky left-0">
                  ทุนประกันภัย (บาท)
                </td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3.5 text-xs font-bold text-slate-800 border-l border-slate-100">
                    {opt.sumInsuredMax ? (
                      `฿${opt.sumInsuredMax.toLocaleString('th-TH')}`
                    ) : opt.sumInsuredMin ? (
                      `฿${opt.sumInsuredMin.toLocaleString('th-TH')}`
                    ) : (
                      <span className="text-slate-400">ยังไม่ระบุทุน</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row: ค่าเสียหายส่วนแรก */}
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-3.5 text-xs font-semibold text-slate-700 bg-slate-50/50 sticky left-0">
                  ค่าเสียหายส่วนแรก (Deductible)
                </td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3.5 text-xs text-slate-800 border-l border-slate-100">
                    {opt.deductibleAmount > 0 ? (
                      <span className="font-bold text-amber-700">฿{opt.deductibleAmount.toLocaleString()}</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">ไม่มี Deductible</span>
                    )}
                    {opt.deductibleTerms && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.deductibleTerms}</div>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row: เงื่อนไขผู้ขับขี่ */}
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-3.5 text-xs font-semibold text-slate-700 bg-slate-50/50 sticky left-0">
                  เงื่อนไขผู้ขับขี่
                </td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3.5 text-xs text-slate-700 border-l border-slate-100">
                    {opt.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่'}
                  </td>
                ))}
              </tr>

              {/* Row: เงื่อนไขรถที่รับประกัน */}
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-3.5 text-xs font-semibold text-slate-700 bg-slate-50/50 sticky left-0">
                  เงื่อนไขรถยนต์
                </td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-3.5 text-xs text-slate-700 border-l border-slate-100">
                    <div>
                      {opt.scopeType === 'specific_model' ? (
                        <span className="font-semibold text-purple-700">
                          เฉพาะ {opt.vehicleBrand} {opt.vehicleModel}
                        </span>
                      ) : (
                        <span>รถทั่วไปอายุ {opt.minCarAge ?? 1}-{opt.maxCarAge ?? 10} ปี</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {opt.inspectionRequired ? 'ต้องตรวจสภาพก่อนทำ' : 'ไม่ต้องตรวจสภาพ'}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Coverages by Category */}
              {categories.map((cat, cIdx) => {
                const itemsToDisplay = onlyDifferences
                  ? cat.items.filter((item) => item.hasDifference)
                  : cat.items;

                if (itemsToDisplay.length === 0) return null;

                return (
                  <tbody key={cIdx}>
                    <tr className="bg-slate-100/70 border-b border-slate-200">
                      <td colSpan={options.length + 1} className="p-2.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {cIdx + 2}. หมวดความคุ้มครอง: {cat.name}
                      </td>
                    </tr>
                    {itemsToDisplay.map((item) => (
                      <tr
                        key={item.code}
                        className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                          item.hasDifference ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="p-3.5 text-xs font-medium text-slate-700 bg-slate-50/50 sticky left-0">
                          <div className="flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.hasDifference && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" title="มีความแตกต่าง"></span>
                            )}
                          </div>
                        </td>
                        {options.map((opt) => {
                          const val = item.values[opt.id];
                          const isCovered = val?.status === 'covered';
                          const isNotCovered = val?.status === 'not_covered';
                          const isOptional = val?.status === 'optional';

                          return (
                            <td key={opt.id} className="p-3.5 text-xs text-slate-800 border-l border-slate-100">
                              <div className="flex items-start gap-1.5">
                                {isCovered && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                                {isNotCovered && <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
                                {isOptional && <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                                <div>
                                  <span
                                    className={`font-semibold ${
                                      isCovered
                                        ? 'text-slate-900'
                                        : isNotCovered
                                        ? 'text-slate-400'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {val?.text}
                                  </span>
                                  {val?.isOverridden && (
                                    <span className="block text-[10px] text-purple-600 font-medium">
                                      (เงื่อนไขเฉพาะตัวเลือกนี้)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                );
              })}

              {/* Source Documents Row (Section 11: เปิดดูเอกสารต้นทางได้) */}
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="p-4 text-xs font-bold text-slate-700 bg-slate-100/60 sticky left-0">
                  เอกสารอ้างอิงต้นทาง
                </td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-4 text-xs text-slate-700 border-l border-slate-200 align-top">
                    {opt.documents.length > 0 ? (
                      <div className="space-y-2">
                        {opt.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] shadow-2xs space-y-1"
                          >
                            <div className="flex items-center gap-1 font-semibold text-slate-800 line-clamp-1">
                              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{doc.title}</span>
                            </div>
                            {doc.page_reference && (
                              <div className="text-[10px] text-slate-500">{doc.page_reference}</div>
                            )}
                            <button
                              onClick={() =>
                                alert(`เปิดเอกสารต้นทาง (Private Bucket signed URL): ${doc.storage_path}`)
                              }
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer pt-0.5"
                            >
                              <span>ดาวน์โหลด/เปิดอ่าน</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">ไม่มีเอกสารแนบ</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
      <CompareContent />
    </Suspense>
  );
}
