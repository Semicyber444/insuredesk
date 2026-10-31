'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense, Fragment } from 'react';
import Link from 'next/link';
import { getComparisonData, ComparisonResult } from '@/lib/queries/compare';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { useAuth } from '@/lib/auth/AuthContext';
import { InsuranceSearchResultItem } from '@/types/insurance';
import {
  Columns3,
  AlertTriangle,
  ArrowLeft,
  ShieldAlert,
  Printer,
  Sparkles,
  Shield,
  RotateCcw,
  X,
} from 'lucide-react';

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userName } = useAuth();
  const idsParam = searchParams.get('ids');
  const currentKey = idsParam ?? '__basket__';

  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [isWarningsOpen, setIsWarningsOpen] = useState(false);

  const isLoading = loadedKey !== currentKey;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'ใบเสนอราคาประกันภัยรถยนต์ - InsureDesk';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const urlIds = idsParam ? idsParam.split(',').filter(Boolean).slice(0, 4) : [];
    const targetIds = urlIds.length >= 2 ? urlIds : InsuranceStore.getCompareBasket().slice(0, 4);

    if (urlIds.length >= 2) {
      InsuranceStore.setCompareBasket(urlIds);
    }

    Promise.resolve()
      .then(() => (targetIds.length >= 2 ? getComparisonData(targetIds) : null))
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoadedKey(currentKey);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [idsParam, currentKey]);

  const handleRemoveOption = (optionIdToRemove: string) => {
    if (!data) return;
    const remainingIds = data.options.filter((o) => o.id !== optionIdToRemove).map((o) => o.id);
    InsuranceStore.setCompareBasket(remainingIds);
    if (remainingIds.length >= 2) {
      router.push(`/compare?ids=${remainingIds.join(',')}`);
    } else {
      router.push('/search');
    }
  };

  const handleClearAll = () => {
    InsuranceStore.setCompareBasket([]);
    router.push('/search');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="inline-block w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-700">กำลังจัดทำใบเสนอราคาและตารางเปรียบเทียบ...</p>
      </div>
    );
  }

  if (!data || data.options.length < 2) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs border border-blue-100">
          <Columns3 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">กรุณาเลือกตัวเลือกประกัน 2 ถึง 4 รายการ</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          ไปที่หน้าค้นหาประกัน และกดปุ่ม <span className="font-bold text-slate-700">&quot;+ เปรียบเทียบ&quot;</span> เพื่อสร้างใบเสนอราคาและตารางเปรียบเทียบเงื่อนไข
        </p>
        <div className="mt-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md hover:bg-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับไปหน้าค้นหาและเลือกแพ็กเกจ</span>
          </Link>
        </div>
      </div>
    );
  }

  const { options, warnings, categories } = data;

  // Differences Detection (Never map null sum insured to 0)
  const isDiffSumInsured =
    new Set(options.map((o) => o.sumInsuredMax ?? o.sumInsuredMin ?? 'UNKNOWN')).size > 1;
  const isDiffRepairType = new Set(options.map((o) => o.repairType)).size > 1;
  const isDiffDeductible = new Set(options.map((o) => o.deductibleAmount ?? 0)).size > 1;
  const isDiffCompulsory = new Set(options.map((o) => o.compulsoryIncluded)).size > 1;
  const isDiffDriver = new Set(options.map((o) => o.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่')).size > 1;
  const isDiffCarAge =
    new Set(options.map((o) => `${o.scopeType}:${o.vehicleModelId ?? ''}:${o.minCarAge ?? 1}-${o.maxCarAge ?? 10}`))
      .size > 1;

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
      renderValue: (opt) => {
        const sumVal = opt.sumInsuredMax ?? opt.sumInsuredMin;
        return (
          <span className="font-bold text-slate-900">
            {sumVal !== null && sumVal !== undefined ? (
              `฿${sumVal.toLocaleString('th-TH')}`
            ) : (
              <span className="text-slate-400 font-normal">ยังไม่ระบุทุน</span>
            )}
          </span>
        );
      },
    },
    {
      id: 'repair_type',
      label: 'ลักษณะการซ่อม',
      hasDifference: isDiffRepairType,
      renderValue: (opt) => (
        <span className="font-semibold text-slate-800">
          {opt.repairType === 'dealer' ? 'ซ่อมห้าง (ศูนย์บริการ)' : 'ซ่อมอู่ (อู่ในเครือ)'}
        </span>
      ),
    },
    {
      id: 'deductible',
      label: 'ค่าเสียหายส่วนแรก (Deductible)',
      hasDifference: isDiffDeductible,
      renderValue: (opt) => (
        <span>
          {opt.deductibleAmount > 0 ? (
            <span className="font-bold text-amber-800">
              ฿{opt.deductibleAmount.toLocaleString()} บาท (เมื่อเป็นฝ่ายผิด)
            </span>
          ) : (
            <span className="text-emerald-700 font-medium">ไม่มี (฿0)</span>
          )}
        </span>
      ),
    },
    {
      id: 'driver_conditions',
      label: 'เงื่อนไขผู้ขับขี่',
      hasDifference: isDiffDriver,
      renderValue: (opt) => <span>{opt.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่'}</span>,
    },
    {
      id: 'compulsory',
      label: 'พ.ร.บ. คุ้มครองผู้ประสบภัย',
      hasDifference: isDiffCompulsory,
      renderValue: (opt) => (
        <span>
          {opt.compulsoryIncluded === 'included'
            ? 'รวมในเบี้ยแล้ว'
            : opt.compulsoryIncluded === 'unspecified'
            ? 'ยังไม่ระบุ'
            : 'ไม่รวม พ.ร.บ.'}
        </span>
      ),
    },
    {
      id: 'vehicle_conditions',
      label: 'เงื่อนไขอายุและรุ่นรถ',
      hasDifference: isDiffCarAge,
      renderValue: (opt) => (
        <span>
          {opt.scopeType === 'specific_model'
            ? `เฉพาะ ${opt.vehicleBrand ?? ''} ${opt.vehicleModel ?? ''}`.trim()
            : opt.scopeType === 'unknown'
            ? 'ยังไม่ระบุขอบเขตรุ่นรถ'
            : `รถทั่วไปอายุ ${opt.minCarAge ?? 1}-${opt.maxCarAge ?? 10} ปี`}
        </span>
      ),
    },
  ];

  const visibleCoreSpecs = onlyDifferences
    ? coreSpecs.filter((s) => s.hasDifference)
    : coreSpecs;

  // Dynamic Summary Header across all compared options
  const usageSet = new Set(options.map((o) => o.usageType || 'private'));
  const usageSummary =
    usageSet.size === 1
      ? options[0].usageType === 'commercial'
        ? 'รถยนต์เชิงพาณิชย์ / รับจ้าง'
        : options[0].usageType === 'all'
        ? 'รองรับทุกรูปแบบการใช้งาน'
        : 'รถยนต์ใช้งานส่วนบุคคล'
      : 'แตกต่างกันตามแต่ละแผน';

  const scopeSummary = (() => {
    const scopes = new Set(
      options.map((o) =>
        o.scopeType === 'specific_model'
          ? `เฉพาะ ${o.vehicleBrand ?? ''} ${o.vehicleModel ?? ''}`.trim()
          : o.scopeType === 'unknown'
          ? 'ยังไม่ระบุขอบเขตรุ่นรถ'
          : 'รองรับทุกรุ่นภายใต้เงื่อนไข'
      )
    );
    return scopes.size === 1 ? Array.from(scopes)[0] : 'ตามเงื่อนไขแต่ละแผน (ดูในตาราง)';
  })();

  const ageSummary = (() => {
    const ages = new Set(options.map((o) => `อายุ ${o.minCarAge ?? 1} - ${o.maxCarAge ?? 10} ปี`));
    return ages.size === 1 ? Array.from(ages)[0] : 'แตกต่างกันตามแต่ละแผน';
  })();

  const inspectionSummary = options.every((o) => o.inspectionRequired)
    ? 'ต้องตรวจสภาพรถก่อนทำประกัน'
    : options.every((o) => !o.inspectionRequired)
    ? 'ไม่ต้องตรวจสภาพรถ'
    : 'ขึ้นอยู่กับแผนที่เลือก';

  // Quotation Document Metadata
  const today = new Date();
  const thaiBuddhistYear = today.getFullYear() + 543;
  const dateFormattedThai = today.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const validUntilDate = new Date(today);
  validUntilDate.setDate(validUntilDate.getDate() + 30);
  const validUntilThai = validUntilDate.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const quotationNo = `QT-${thaiBuddhistYear}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate()
  ).padStart(2, '0')}-${options[0]?.id.slice(-4) || '01'}`;

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Print Specific CSS to Guarantee 1 Page A4 Fit */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important; /* Removes browser default URL, title, date, page number */
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
            font-size: 8.5pt !important;
            line-height: 1.15 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .a4-quotation-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 6mm 8mm !important; /* Replaces page margin cleanly inside paper */
            border: none !important;
            box-shadow: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          table {
            page-break-inside: avoid !important;
            font-size: 8.5pt !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          th, td {
            padding-top: 1.5px !important;
            padding-bottom: 1.5px !important;
            padding-left: 5px !important;
            padding-right: 5px !important;
            line-height: 1.12 !important;
          }
        }
      `}} />

      {/* Screen Control Toolbar (Hidden in Print) */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับไปหน้าค้นหา</span>
          </Link>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
            {options.length} แผนประกัน
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Differences Toggle */}
          <button
            onClick={() => setOnlyDifferences(!onlyDifferences)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              onlyDifferences
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${onlyDifferences ? 'text-amber-300' : 'text-blue-600'}`} />
            <span>เน้นเฉพาะจุดต่าง</span>
          </button>

          {/* Warnings Toggle */}
          {warnings.length > 0 && (
            <button
              onClick={() => setIsWarningsOpen(!isWarningsOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>ข้อสังเกต ({warnings.length})</span>
            </button>
          )}

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ใบเสนอราคา (A4 1 หน้า)</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 px-2 py-1.5 transition cursor-pointer"
            title="ล้างการเปรียบเทียบ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Screen Warnings Banner (Hidden in Print) */}
      {warnings.length > 0 && isWarningsOpen && (
        <div className="no-print bg-amber-50/90 border border-amber-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              ข้อสังเกตความแตกต่างที่สำคัญ
            </span>
            <button
              onClick={() => setIsWarningsOpen(false)}
              className="text-[11px] text-amber-800 hover:underline cursor-pointer"
            >
              ปิดแถบนี้
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
            {warnings.map((w, idx) => (
              <div key={idx} className="bg-white/80 p-2 rounded-lg border border-amber-200/70">
                <span className="font-bold text-amber-950 block text-[11px]">{w.title}</span>
                <span className="text-[10px] text-slate-600 leading-snug">{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A4 QUOTATION SHEET CONTAINER */}
      <div className="a4-quotation-sheet bg-white border border-slate-300 rounded-2xl shadow-sm p-4 sm:p-6 print:p-0 print:border-none print:shadow-none space-y-2.5">
        {/* 1. Formal Quotation Header */}
        <div className="border-b-2 border-slate-800 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900 tracking-tight">InsureDesk</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                  ใบเสนอราคาประกันภัยรถยนต์
                </span>
              </div>
              <p className="text-[10px] text-slate-500 -mt-0.5">
                ระบบจัดการและเปรียบเทียบข้อมูลประกันภัยรถยนต์ • ฝ่ายบริการข้อมูลลูกค้า
              </p>
            </div>
          </div>

          <div className="text-right text-[10px] text-slate-600 space-y-0.5 self-end sm:self-auto">
            <div>
              <span className="font-semibold text-slate-500">เลขที่ใบเสนอราคา: </span>
              <span className="font-bold font-mono text-slate-900">{quotationNo}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">วันที่เสนอราคา: </span>
              <span className="font-semibold text-slate-900">{dateFormattedThai}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">การยืนยันราคา: </span>
              <span className="font-bold text-slate-900">30 วัน (ถึงวันที่ {validUntilThai})</span>
            </div>
          </div>
        </div>

        {/* 2. Compact Vehicle & Customer Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="text-slate-500 block">ประเภทการใช้งาน:</span>
            <span className="font-bold text-slate-800">{usageSummary}</span>
          </div>
          <div>
            <span className="text-slate-500 block">ขอบเขตรุ่นรถยนต์:</span>
            <span className="font-bold text-slate-800">{scopeSummary}</span>
          </div>
          <div>
            <span className="text-slate-500 block">อายุรถยนต์ที่รับประกัน:</span>
            <span className="font-bold text-slate-800">{ageSummary}</span>
          </div>
          <div>
            <span className="text-slate-500 block">การตรวจสภาพรถ:</span>
            <span className="font-bold text-slate-800">{inspectionSummary}</span>
          </div>
        </div>

        {/* 3. Formal Side-by-side Quotation Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse border border-slate-300 text-[10px]">
            {/* Column Width Sizing */}
            <colgroup>
              <col style={{ width: '28%' }} />
              {options.map((opt) => (
                <col key={opt.id} style={{ width: `${72 / options.length}%` }} />
              ))}
            </colgroup>

            {/* Table Header: Plan & Price Details */}
            <thead>
              <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                <th className="p-3 text-center align-middle font-bold text-slate-700 uppercase tracking-wider border-r border-slate-300 bg-slate-50/70">
                  <div className="flex flex-col items-center justify-center h-full space-y-1">
                    <span className="block text-[11.5px] font-black text-slate-900">
                      รายการเปรียบเทียบ
                    </span>
                    <span className="text-[9px] font-normal text-slate-500">
                      ความคุ้มครองและเงื่อนไข
                    </span>
                  </div>
                </th>

                {options.map((opt, idx) => {
                  const sumVal = opt.sumInsuredMax ?? opt.sumInsuredMin;
                  const compulsoryLabel =
                    opt.compulsoryIncluded === 'included'
                      ? 'รวม พ.ร.บ.'
                      : opt.compulsoryIncluded === 'unspecified'
                      ? 'ยังไม่ระบุ พ.ร.บ.'
                      : 'ไม่รวม พ.ร.บ.';

                  return (
                    <th key={opt.id} className="p-2 text-center align-top border-r border-slate-300 bg-white">
                      <div className="space-y-1">
                        {/* Plan Option Number Tag */}
                        <div className="flex items-center justify-between text-[9px] font-bold pb-1 border-b border-slate-100">
                          <span className="bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-black">
                            ตัวเลือกที่ {idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">{opt.insuranceType}</span>
                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(opt.id)}
                                title="นำตัวเลือกนี้ออก"
                                className="no-print text-slate-400 hover:text-red-600 p-0.5 rounded transition cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Insurer Name & Plan Name */}
                        <div className="min-h-[30px] flex flex-col justify-center">
                          <div className="font-bold text-[10.5px] text-slate-900 leading-tight line-clamp-1">
                            {opt.insurerName}
                          </div>
                          <div className="text-[9.5px] text-slate-600 line-clamp-1">
                            {opt.planName}
                          </div>
                        </div>

                        {/* Premium Price Box (Quotation Highlight — Section 9.3) */}
                        <div className="bg-blue-50/80 border border-blue-200 rounded-md p-1.5 my-1">
                          <span className="text-[9px] text-blue-800 block">
                            เบี้ยประกันภัยรวม ({compulsoryLabel})
                          </span>
                          <div className="text-base font-black text-blue-950 tracking-tight">
                            {opt.premiumTotal !== null && opt.premiumTotal !== undefined ? (
                              `฿${opt.premiumTotal.toLocaleString('th-TH')}`
                            ) : (
                              <span className="text-xs text-amber-700">ยังไม่มีข้อมูลราคา</span>
                            )}
                          </div>
                          <span className="text-[8.5px] text-slate-500 block">
                            {opt.repairType === 'dealer' ? 'ซ่อมห้าง (ศูนย์บริการ)' : 'ซ่อมอู่ (อู่ในเครือ)'}
                          </span>
                        </div>

                        {/* Sum Insured Badge (Never show ฿0 for null) */}
                        <div className="text-[9.5px] font-bold text-slate-800">
                          {sumVal !== null && sumVal !== undefined
                            ? `ทุนประกัน ฿${sumVal.toLocaleString('th-TH')} บาท`
                            : 'ยังไม่ระบุทุนประกัน'}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Grouped Rows */}
            <tbody className="divide-y divide-slate-200">
              {/* GROUP 1: Core Specs & Pricing */}
              <tr className="bg-slate-200/80 font-bold text-slate-900 text-[9.5px]">
                <td colSpan={options.length + 1} className="py-1 px-2 uppercase tracking-wide">
                  1. ข้อมูลพื้นฐานและเงื่อนไขราคา (Pricing & Basic Conditions)
                </td>
              </tr>

              {visibleCoreSpecs.map((spec) => (
                <tr key={spec.id} className="hover:bg-slate-50/60">
                  <td className="py-1 px-2 font-semibold text-slate-700 border-r border-slate-300">
                    <div className="flex items-center justify-between">
                      <span>{spec.label}</span>
                      {spec.hasDifference && (
                        <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 rounded no-print">
                          ต่างกัน
                        </span>
                      )}
                    </div>
                  </td>
                  {options.map((opt) => (
                    <td key={opt.id} className="py-1 px-2 text-center border-r border-slate-300 align-middle">
                      {spec.renderValue(opt)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* GROUP 2, 3, 4: Standard Coverages */}
              {categories.map((cat, cIdx) => {
                const itemsToDisplay = onlyDifferences
                  ? cat.items.filter((item) => item.hasDifference)
                  : cat.items;

                if (itemsToDisplay.length === 0) return null;

                return (
                  <Fragment key={`cat-${cIdx}`}>
                    {/* Category Title Row */}
                    <tr className="bg-slate-200/80 font-bold text-slate-900 text-[9.5px]">
                      <td colSpan={options.length + 1} className="py-1 px-2 uppercase tracking-wide">
                        {cIdx + 2}. หมวดความคุ้มครอง: {cat.name}
                      </td>
                    </tr>

                    {/* Category Item Rows */}
                    {itemsToDisplay.map((item) => (
                      <tr key={item.code} className="hover:bg-slate-50/60">
                        <td className="py-1 px-2 font-medium text-slate-800 border-r border-slate-300">
                          <div className="flex items-center justify-between">
                            <span>{item.name}</span>
                            {item.hasDifference && (
                              <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 rounded no-print">
                                ต่างกัน
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
                            <td key={opt.id} className="py-1 px-2 text-center border-r border-slate-300 align-middle">
                              {isCovered && (
                                <div className="leading-tight">
                                  <span className="font-bold text-slate-900">
                                    {val.text}
                                  </span>
                                  {val.isOverridden && (
                                    <span className="text-[8px] text-purple-700 block font-semibold">*เงื่อนไขเฉพาะ</span>
                                  )}
                                </div>
                              )}
                              {isNotCovered && (
                                <span className="text-slate-400 font-normal">ไม่คุ้มครอง</span>
                              )}
                              {isOptional && (
                                <span className="text-amber-800 font-medium">{val.text}</span>
                              )}
                              {!isCovered && !isNotCovered && !isOptional && (
                                <span className="text-slate-400">ยังไม่ระบุ</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Terms, Remarks & Signature Section (Quotation Footer) */}
        <div className="pt-2 border-t border-slate-300 space-y-2">
          {/* Remarks */}
          <div className="text-[8.5px] text-slate-500 leading-tight space-y-0.5">
            <p className="font-bold text-slate-700">หมายเหตุและเงื่อนไขประกอบใบเสนอราคา:</p>
            <p>1. เบี้ยประกันภัยและทุนประกันภัยข้างต้นเป็นราคาที่รวมภาษีอากรและ พ.ร.บ. ตามเงื่อนไขที่ระบุแล้ว</p>
            <p>2. ความคุ้มครอง ข้อยกเว้น และเงื่อนไขการเรียกร้องค่าเสียหายเป็นไปตามกรมธรรม์ประกันภัยของแต่ละบริษัทประกันภัยที่ได้รับความเห็นชอบจาก คปภ.</p>
            <p>3. ใบเสนอราคานี้ใช้สำหรับเปรียบเทียบข้อมูลภายในทีม InsureDesk เพื่อเสนอแนะแก่ลูกค้า ขอสงวนสิทธิ์ในการเปลี่ยนแปลงตามผลการตรวจสภาพรถหรือประวัติการขับขี่</p>
          </div>

          {/* Two-Column Signature Blocks */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-[9.5px]">
            {/* Left: Prepared By Advisor */}
            <div className="border border-slate-200 rounded-lg p-2 text-center space-y-1 bg-slate-50/50">
              <span className="font-bold text-slate-700 block">ผู้จัดทำใบเสนอราคา (Advisor)</span>
              <div className="h-6"></div>
              <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
              <span className="text-slate-600 block">( {userName} / ทีม InsureDesk )</span>
              <span className="text-slate-400 text-[8.5px] block">วันที่: {dateFormattedThai}</span>
            </div>

            {/* Right: Customer Acceptance */}
            <div className="border border-slate-200 rounded-lg p-2 text-center space-y-1 bg-slate-50/50">
              <span className="font-bold text-slate-700 block">ผู้ขอเอาประกันภัย / ลูกค้า (Customer Acceptance)</span>
              <div className="flex items-center justify-center gap-3 text-[9px] pt-0.5">
                {options.map((opt, i) => (
                  <label key={opt.id} className="inline-flex items-center gap-1 cursor-pointer">
                    <span className="w-3 h-3 border border-slate-400 rounded-xs inline-block"></span>
                    <span>เลือกตัวเลือกที่ {i + 1}</span>
                  </label>
                ))}
              </div>
              <div className="border-b border-slate-400 w-3/4 mx-auto mt-2"></div>
              <span className="text-slate-600 block">ลงชื่อ: ................................................................</span>
              <span className="text-slate-400 text-[8.5px] block">
                วันที่: ........ / ........ / {thaiBuddhistYear}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-3">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-600">กำลังโหลดหน้าใบเสนอราคา...</p>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
