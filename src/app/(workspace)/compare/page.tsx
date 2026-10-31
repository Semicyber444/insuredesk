'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { getComparisonData, ComparisonResult } from '@/lib/queries/compare';
import { InsuranceSearchResultItem } from '@/types/insurance';
import {
  Columns3,
  AlertTriangle,
  FileText,
  ArrowLeft,
  CheckCircle2,
  MinusCircle,
  HelpCircle,
  ShieldAlert,
  SlidersHorizontal,
  ExternalLink,
  Printer,
  Sparkles,
  Car,
  Shield,
  Users,
  HeartPulse,
  Trash2,
  Check,
  Building2,
  Wrench,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';

function getInsurerBadge(name: string) {
  if (name.includes('วิริยะ')) {
    return { bg: 'bg-blue-50 text-blue-900 border-blue-200', tag: 'VIRIYAH' };
  }
  if (name.includes('กรุงเทพ')) {
    return { bg: 'bg-indigo-50 text-indigo-900 border-indigo-200', tag: 'BKI' };
  }
  if (name.includes('ธนชาต')) {
    return { bg: 'bg-amber-50 text-amber-900 border-amber-200', tag: 'THANACHART' };
  }
  if (name.includes('ทิพย')) {
    return { bg: 'bg-sky-50 text-sky-900 border-sky-200', tag: 'DHIPAYA' };
  }
  if (name.includes('เมืองไทย')) {
    return { bg: 'bg-pink-50 text-pink-900 border-pink-200', tag: 'MTI' };
  }
  if (name.includes('ชับบ์') || name.toLowerCase().includes('chubb')) {
    return { bg: 'bg-purple-50 text-purple-900 border-purple-200', tag: 'CHUBB' };
  }
  return { bg: 'bg-slate-100 text-slate-800 border-slate-200', tag: 'INSURER' };
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'ชั้น 1':
      return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white';
    case 'ชั้น 2+':
      return 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white';
    case 'ชั้น 3+':
      return 'bg-gradient-to-r from-amber-600 to-orange-600 text-white';
    case 'ชั้น 2':
      return 'bg-gradient-to-r from-slate-600 to-slate-700 text-white';
    default:
      return 'bg-gradient-to-r from-slate-500 to-slate-600 text-white';
  }
}

function getCategoryIcon(name: string) {
  if (name.includes('ตัวรถ')) return Car;
  if (name.includes('บุคคลภายนอก')) return Users;
  if (name.includes('เพิ่มเติม') || name.includes('ค่าชดเชย')) return HeartPulse;
  return Shield;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get('ids');

  const [data, setData] = useState<ComparisonResult | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [isWarningsOpen, setIsWarningsOpen] = useState(true);
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
      setData(null);
      setIsLoading(false);
    }
  }, [idsParam]);

  const handleRemoveOption = (optionIdToRemove: string) => {
    if (!data) return;
    const remainingIds = data.options.filter((o) => o.id !== optionIdToRemove).map((o) => o.id);
    if (remainingIds.length > 0) {
      router.push(`/compare?ids=${remainingIds.join(',')}`);
    } else {
      router.push('/search');
    }
  };

  const handleClearAll = () => {
    router.push('/search');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-700">กำลังประมวลผลข้อมูลเปรียบเทียบ...</p>
      </div>
    );
  }

  if (!data || data.options.length < 2) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xs border border-blue-100">
          <Columns3 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">กรุณาเลือกตัวเลือกประกัน 2 ถึง 4 รายการ</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          ไปที่หน้าค้นหาประกัน และกดปุ่ม <span className="font-bold text-slate-700">&quot;+ เปรียบเทียบ&quot;</span> บนการ์ดแพ็กเกจที่ต้องการนำมาเทียบเงื่อนไขแบบเคียงข้าง (Side-by-side)
        </p>
        <div className="mt-8">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับไปหน้าค้นหาและเลือกแพ็กเกจ</span>
          </Link>
        </div>
      </div>
    );
  }

  const { options, warnings, categories } = data;

  // 1. Calculate Differences in Core Specs
  const isDiffSumInsured = new Set(options.map((o) => o.sumInsuredMax ?? o.sumInsuredMin ?? 0)).size > 1;
  const isDiffPremium = new Set(options.map((o) => o.premiumTotal ?? -1)).size > 1;
  const isDiffRepairType = new Set(options.map((o) => o.repairType)).size > 1;
  const isDiffDeductible = new Set(options.map((o) => o.deductibleAmount ?? 0)).size > 1;
  const isDiffCompulsory = new Set(options.map((o) => o.compulsoryIncluded)).size > 1;
  const isDiffDriver = new Set(options.map((o) => o.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่')).size > 1;
  const isDiffCarAge = new Set(options.map((o) => `${o.minCarAge ?? 1}-${o.maxCarAge ?? 10}`)).size > 1;
  const isDiffInspection = new Set(options.map((o) => !!o.inspectionRequired)).size > 1;

  interface CoreSpecRow {
    id: string;
    label: string;
    hasDifference: boolean;
    renderValue: (opt: InsuranceSearchResultItem) => React.ReactNode;
  }

  const coreSpecs: CoreSpecRow[] = [
    {
      id: 'sum_insured',
      label: 'ทุนประกันภัย (บาท)',
      hasDifference: isDiffSumInsured,
      renderValue: (opt) => (
        <div>
          <span className="text-sm font-black text-slate-900">
            {opt.sumInsuredMax ? (
              `฿${opt.sumInsuredMax.toLocaleString('th-TH')}`
            ) : opt.sumInsuredMin ? (
              `฿${opt.sumInsuredMin.toLocaleString('th-TH')}`
            ) : (
              <span className="text-slate-400">ยังไม่ระบุทุน</span>
            )}
          </span>
          {opt.sumInsuredMin && opt.sumInsuredMax && opt.sumInsuredMin !== opt.sumInsuredMax && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              (ทุนขั้นต่ำ ฿{opt.sumInsuredMin.toLocaleString()})
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'premium_total',
      label: 'เบี้ยประกันภัยรวม (บาท/ปี)',
      hasDifference: isDiffPremium,
      renderValue: (opt) => (
        <div>
          {opt.premiumTotal ? (
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-blue-700">
                ฿{opt.premiumTotal.toLocaleString('th-TH')}
              </span>
              <span className="text-[10px] text-slate-500">/ ปี</span>
            </div>
          ) : (
            <span className="inline-flex text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              ยังไม่มีข้อมูลราคา
            </span>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5">
            {opt.compulsoryIncluded === 'included' ? 'รวม พ.ร.บ. แล้ว' : 'ไม่รวม พ.ร.บ.'}
          </div>
        </div>
      ),
    },
    {
      id: 'repair_type',
      label: 'ลักษณะการซ่อม (ศูนย์ / อู่)',
      hasDifference: isDiffRepairType,
      renderValue: (opt) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
            opt.repairType === 'dealer'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {opt.repairType === 'dealer' ? (
            <>
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>ซ่อมห้าง (ศูนย์บริการ)</span>
            </>
          ) : (
            <>
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span>ซ่อมอู่ (อู่ในเครือ)</span>
            </>
          )}
        </span>
      ),
    },
    {
      id: 'deductible',
      label: 'ค่าเสียหายส่วนแรก (Deductible)',
      hasDifference: isDiffDeductible,
      renderValue: (opt) => (
        <div>
          {opt.deductibleAmount > 0 ? (
            <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-xs inline-block">
              ฿{opt.deductibleAmount.toLocaleString()} บาท
            </span>
          ) : (
            <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-xs inline-block">
              ไม่มีค่าเสียหายส่วนแรก (฿0)
            </span>
          )}
          {opt.deductibleTerms && (
            <div className="text-[11px] text-slate-500 mt-1 leading-tight">{opt.deductibleTerms}</div>
          )}
        </div>
      ),
    },
    {
      id: 'driver_conditions',
      label: 'เงื่อนไขผู้ขับขี่',
      hasDifference: isDiffDriver,
      renderValue: (opt) => (
        <span className="text-xs text-slate-800 font-medium">
          {opt.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่'}
        </span>
      ),
    },
    {
      id: 'vehicle_conditions',
      label: 'เงื่อนไขอายุและรุ่นรถยนต์',
      hasDifference: isDiffCarAge,
      renderValue: (opt) => (
        <div className="space-y-0.5 text-xs text-slate-800">
          <div>
            {opt.scopeType === 'specific_model' ? (
              <span className="font-bold text-purple-700">
                เฉพาะ {opt.vehicleBrand} {opt.vehicleModel}
              </span>
            ) : (
              <span className="font-medium">รถทั่วไปอายุ {opt.minCarAge ?? 1} - {opt.maxCarAge ?? 10} ปี</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {opt.inspectionRequired ? (
              <span className="text-amber-700 font-semibold">⚠️ ต้องตรวจสภาพรถก่อนทำ</span>
            ) : (
              <span>ไม่ต้องตรวจสภาพรถ</span>
            )}
          </div>
        </div>
      ),
    },
  ];

  // Count total differences for the badge
  const coreDiffCount = coreSpecs.filter((s) => s.hasDifference).length;
  const coverageDiffCount = categories.reduce(
    (acc, cat) => acc + cat.items.filter((item) => item.hasDifference).length,
    0
  );
  const totalDifferences = coreDiffCount + coverageDiffCount;

  const visibleCoreSpecs = onlyDifferences
    ? coreSpecs.filter((s) => s.hasDifference)
    : coreSpecs;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับไปหน้ารายการค้นหา</span>
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              เปรียบเทียบ {options.length} แผน
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Columns3 className="w-6 h-6 text-blue-600" />
            <span>เปรียบเทียบแพ็กเกจประกันภัยรถยนต์ (Side-by-Side Comparison)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ตารางเปรียบเทียบเงื่อนไข ทุนประกัน เบี้ย และความคุ้มครองมาตรฐาน 14 หมวด โดยไม่จัดอันดับแผนดีที่สุดโดยอัตโนมัติ เพื่อการพิจารณาที่เป็นกลาง
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Differences Only Toggle */}
          <button
            onClick={() => setOnlyDifferences(!onlyDifferences)}
            className={`flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl border transition cursor-pointer shadow-xs ${
              onlyDifferences
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${onlyDifferences ? 'text-amber-300' : 'text-blue-600'}`} />
            <span>เน้นเฉพาะจุดต่าง</span>
            <span
              className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                onlyDifferences ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalDifferences}
            </span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            title="พิมพ์หรือบันทึกเป็น PDF"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">พิมพ์ / PDF</span>
          </button>

          {/* Clear Comparison */}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200 px-3 py-2.5 rounded-xl transition cursor-pointer"
            title="ล้างรายการเปรียบเทียบ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ล้างตาราง</span>
          </button>
        </div>
      </div>

      {/* Warnings & Differences Alert Banner (Section 11) */}
      {warnings.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span>ข้อสังเกตความแตกต่างที่สำคัญ ({warnings.length} ประเด็น)</span>
            </div>
            <button
              onClick={() => setIsWarningsOpen(!isWarningsOpen)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
            >
              <span>{isWarningsOpen ? 'ย่อข้อความ' : 'ดูรายละเอียด'}</span>
              {isWarningsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {isWarningsOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="bg-white/90 p-3 rounded-xl border border-amber-200/70 shadow-2xs flex items-start gap-2.5"
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      w.severity === 'caution' ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{w.title}</span>
                    <span className="text-[11px] text-slate-600 leading-relaxed block mt-0.5">
                      {w.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Comparison Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            {/* Column Width Definitions */}
            <colgroup>
              <col className="w-72 min-w-[280px]" />
              {options.map((opt) => (
                <col key={opt.id} style={{ width: `${100 / options.length}%` }} className="min-w-[280px]" />
              ))}
            </colgroup>

            {/* Sticky Table Header with Plan Cards */}
            <thead className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b-2 border-slate-200 shadow-xs">
              <tr>
                <th className="p-4 align-top bg-slate-50/95 sticky left-0 z-40 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  <div className="flex flex-col justify-between h-full space-y-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                      รายการเปรียบเทียบ
                    </span>
                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                      เลื่อนลงเพื่อดูตารางความคุ้มครองครบ 14 หมวดมาตรฐาน
                    </p>
                    {onlyDifferences && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md self-start">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>กำลังเน้นเฉพาะจุดต่าง</span>
                      </span>
                    )}
                  </div>
                </th>

                {options.map((opt) => {
                  const insBadge = getInsurerBadge(opt.insurerName);
                  return (
                    <th
                      key={opt.id}
                      className="p-4 align-top border-l border-slate-200 bg-white text-left font-normal"
                    >
                      <div className="flex flex-col justify-between h-full space-y-3">
                        {/* Insurer & Plan Type & Delete Option */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${insBadge.bg}`}
                            >
                              {opt.insurerName}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xs ${getTypeBadge(
                                opt.insuranceType
                              )}`}
                            >
                              {opt.insuranceType}
                            </span>
                          </div>

                          {options.length > 2 && (
                            <button
                              onClick={() => handleRemoveOption(opt.id)}
                              title="นำออกจากตารางเปรียบเทียบ"
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Plan Name & Tier Label */}
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-900 leading-snug line-clamp-2">
                            {opt.planName}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">
                            {opt.priceOptionLabel}
                          </p>
                        </div>

                        {/* Premium & Quick Badges */}
                        <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                          <div className="flex items-baseline gap-1">
                            {opt.premiumTotal ? (
                              <>
                                <span className="text-2xl font-black text-blue-900 tracking-tight">
                                  ฿{opt.premiumTotal.toLocaleString('th-TH')}
                                </span>
                                <span className="text-[11px] text-slate-500 font-normal">/ ปี</span>
                              </>
                            ) : (
                              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                ยังไม่มีข้อมูลราคา
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {opt.repairType === 'dealer' ? (
                                <Building2 className="w-3 h-3 text-blue-600" />
                              ) : (
                                <Wrench className="w-3 h-3 text-emerald-600" />
                              )}
                              <span>{opt.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                              <Shield className="w-3 h-3 text-blue-600" />
                              <span>ทุน ฿{(opt.sumInsuredMax || opt.sumInsuredMin || 0).toLocaleString()}</span>
                            </span>
                          </div>
                        </div>

                        {/* Details Link */}
                        <div className="pt-1">
                          <Link
                            href={`/plans/${opt.planId}?optionId=${opt.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <span>ดูรายละเอียดแพ็กเกจ</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {/* SECTION 1: Core Specs & Pricing */}
              {visibleCoreSpecs.length > 0 && (
                <>
                  <tr className="bg-slate-100/90 border-t-2 border-b border-slate-200 font-bold text-slate-800 text-xs">
                    <td
                      colSpan={options.length + 1}
                      className="px-4 py-2.5 uppercase tracking-wider sticky left-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                        <span>1. ข้อมูลพื้นฐานและเงื่อนไขราคา (Core Specs & Pricing)</span>
                        <span className="text-[10px] font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                          {visibleCoreSpecs.length} รายการ
                        </span>
                      </div>
                    </td>
                  </tr>

                  {visibleCoreSpecs.map((spec) => (
                    <tr
                      key={spec.id}
                      className={`hover:bg-slate-50/70 transition ${
                        spec.hasDifference ? 'bg-amber-50/25' : ''
                      }`}
                    >
                      <td className="p-4 text-xs font-bold text-slate-700 bg-slate-50/90 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="leading-snug">{spec.label}</span>
                          {spec.hasDifference && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              <span>ต่างกัน</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {options.map((opt) => (
                        <td
                          key={opt.id}
                          className={`p-4 text-xs border-l border-slate-100 align-middle ${
                            spec.hasDifference ? 'bg-amber-50/10' : ''
                          }`}
                        >
                          {spec.renderValue(opt)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {/* SECTIONS 2, 3, 4: Coverages by Standard Category */}
              {categories.map((cat, cIdx) => {
                const itemsToDisplay = onlyDifferences
                  ? cat.items.filter((item) => item.hasDifference)
                  : cat.items;

                if (itemsToDisplay.length === 0) return null;

                const CategoryIcon = getCategoryIcon(cat.name);

                return (
                  <Fragment key={`cat-${cIdx}`}>
                    {/* Category Header Row */}
                    <tr className="bg-slate-100/90 border-t-2 border-b border-slate-200 font-bold text-slate-800 text-xs">
                      <td
                        colSpan={options.length + 1}
                        className="px-4 py-2.5 uppercase tracking-wider sticky left-0"
                      >
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>
                            {cIdx + 2}. หมวดความคุ้มครอง: {cat.name}
                          </span>
                          <span className="text-[10px] font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {itemsToDisplay.length} รายการ
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Category Coverage Rows */}
                    {itemsToDisplay.map((item) => (
                      <tr
                        key={item.code}
                        className={`hover:bg-slate-50/70 transition ${
                          item.hasDifference ? 'bg-blue-50/25' : ''
                        }`}
                      >
                        <td className="p-4 text-xs font-semibold text-slate-800 bg-slate-50/90 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.04)]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="leading-snug">{item.name}</span>
                            {item.hasDifference && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full shrink-0">
                                <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                                <span>ต่างกัน</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {options.map((opt) => {
                          const val = item.values[opt.id];
                          const isCovered = val?.status === 'covered';
                          const isNotCovered = val?.status === 'not_covered';
                          const isOptional = val?.status === 'optional';

                          return (
                            <td
                              key={opt.id}
                              className={`p-4 text-xs border-l border-slate-100 align-middle ${
                                item.hasDifference ? 'bg-blue-50/10' : ''
                              }`}
                            >
                              {isCovered && (
                                <div className="inline-flex items-start gap-2 bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 p-2.5 rounded-xl w-full">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-slate-900 block leading-tight">
                                      {val?.text}
                                    </span>
                                    {val?.isOverridden && (
                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded inline-block">
                                        เงื่อนไขเฉพาะตัวเลือกนี้
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {isNotCovered && (
                                <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200/60 text-slate-400 p-2.5 rounded-xl w-full">
                                  <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="font-medium text-xs text-slate-400">ไม่คุ้มครอง</span>
                                </div>
                              )}

                              {isOptional && (
                                <div className="inline-flex items-start gap-2 bg-amber-50/80 border border-amber-200/80 text-amber-900 p-2.5 rounded-xl w-full">
                                  <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-xs text-amber-900 block leading-tight">
                                      {val?.text}
                                    </span>
                                    {val?.isOverridden && (
                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded inline-block">
                                        เงื่อนไขเฉพาะตัวเลือกนี้
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {!isCovered && !isNotCovered && !isOptional && (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}

              {/* SECTION 5: Source Documents (Section 11) */}
              <tr className="bg-slate-100/90 border-t-2 border-b border-slate-200 font-bold text-slate-800 text-xs">
                <td
                  colSpan={options.length + 1}
                  className="px-4 py-2.5 uppercase tracking-wider sticky left-0"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>5. เอกสารอ้างอิงต้นทาง (Source Documents)</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition">
                <td className="p-4 text-xs font-bold text-slate-700 bg-slate-50/90 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.04)]">
                  <div>
                    <span className="block font-bold">เอกสารตรวจสอบ</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ตารางเบี้ย / กรมธรรม์ตัวจริง
                    </span>
                  </div>
                </td>

                {options.map((opt) => (
                  <td key={opt.id} className="p-4 text-xs border-l border-slate-100 align-top">
                    {opt.documents.length > 0 ? (
                      <div className="space-y-2">
                        {opt.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-center gap-1.5 font-bold text-slate-800 line-clamp-1 text-xs">
                              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>{doc.title}</span>
                            </div>
                            {doc.page_reference && (
                              <div className="text-[11px] text-slate-500">{doc.page_reference}</div>
                            )}
                            <button
                              onClick={() =>
                                alert(`เปิดเอกสารต้นทาง (Private Bucket signed URL): ${doc.storage_path}`)
                              }
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer pt-1"
                            >
                              <span>ดาวน์โหลด / เปิดอ่าน</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">ไม่มีเอกสารแนบ</span>
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
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-3">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600">กำลังโหลดหน้าเปรียบเทียบ...</p>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
