'use client';

import Link from 'next/link';
import { InsuranceSearchResultItem } from '@/types/insurance';
import { Shield, CheckCircle2, AlertTriangle, FileText, ExternalLink, Plus, Check } from 'lucide-react';

interface PriceOptionCardProps {
  item: InsuranceSearchResultItem;
  isSelectedForCompare: boolean;
  onToggleCompare: (id: string) => void;
  canSelectMore: boolean;
}

export function PriceOptionCard({
  item,
  isSelectedForCompare,
  onToggleCompare,
  canSelectMore,
}: PriceOptionCardProps) {
  // Format price helper according to Section 9.3
  const renderPrice = () => {
    if (item.premiumTotal === null || item.premiumTotal === undefined) {
      return (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            ยังไม่มีข้อมูลราคา
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5">ต้องติดต่อบริษัทเพื่อเช็คเบี้ย</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            ฿{item.premiumTotal.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-slate-500 font-medium">/ปี</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
          {item.priceType === 'starting' && (
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">ราคาเริ่มต้น</span>
          )}
          {item.priceType === 'indicative' && (
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">ราคาประมาณการ</span>
          )}
          <span>{item.compulsoryIncluded === 'included' ? 'รวม พ.ร.บ.' : 'ไม่รวม พ.ร.บ.'}</span>
        </div>
      </div>
    );
  };

  // Find key coverage statuses
  const ownDamage = item.coverages.find((c) => c.code === 'own_damage');
  const theftFire = item.coverages.find((c) => c.code === 'theft_fire');
  const flood = item.coverages.find((c) => c.code === 'flood');

  return (
    <div
      className={`relative bg-white border rounded-xl p-5 shadow-xs transition hover:shadow-md ${
        isSelectedForCompare
          ? 'border-blue-600 ring-2 ring-blue-100'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Header: Insurer & Insurance Type */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {item.insurerName}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {item.insuranceType}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                item.repairType === 'dealer'
                  ? 'bg-purple-50 text-purple-700 border border-purple-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}
            >
              {item.repairType === 'dealer' ? 'ซ่อมห้าง (ศูนย์)' : 'ซ่อมอู่'}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1.5 line-clamp-1">{item.planName}</h3>
          <p className="text-xs text-slate-500 line-clamp-1">{item.priceOptionLabel}</p>
        </div>

        {/* Compare Checkbox Button */}
        <button
          type="button"
          disabled={!isSelectedForCompare && !canSelectMore}
          onClick={() => onToggleCompare(item.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            isSelectedForCompare
              ? 'bg-blue-600 text-white shadow-xs'
              : !canSelectMore
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700'
          }`}
        >
          {isSelectedForCompare ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>เลือกเปรียบเทียบแล้ว</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>เปรียบเทียบ</span>
            </>
          )}
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-b border-slate-100">
        {/* Price */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            เบี้ยประกันรวม
          </span>
          {renderPrice()}
        </div>

        {/* Sum Insured */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            ทุนประกันภัย
          </span>
          <div className="text-lg font-bold text-slate-800">
            {item.sumInsuredMax ? (
              `฿${item.sumInsuredMax.toLocaleString('th-TH')}`
            ) : item.sumInsuredMin ? (
              `฿${item.sumInsuredMin.toLocaleString('th-TH')}`
            ) : (
              <span className="text-slate-400 text-sm">ยังไม่ระบุทุน</span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            {item.scopeType === 'specific_model' ? (
              `เฉพาะ ${item.vehicleBrand ?? ''} ${item.vehicleModel ?? ''}`
            ) : (
              `รองรับรถอายุ ${item.minCarAge ?? 1}-${item.maxCarAge ?? 10} ปี`
            )}
          </span>
        </div>

        {/* Deductibles */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            ค่าเสียหายส่วนแรก (Deductible)
          </span>
          <div className="text-lg font-bold text-slate-800">
            {item.deductibleAmount > 0 ? (
              <span className="text-amber-700">฿{item.deductibleAmount.toLocaleString()}</span>
            ) : (
              <span className="text-emerald-700">ไม่มี Deductible</span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 line-clamp-1">
            {item.deductibleTerms || 'กรณีเกิดเหตุเป็นฝ่ายถูกไม่ต้องจ่าย'}
          </span>
        </div>
      </div>

      {/* Quick Coverage Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-3">
        <span className="text-[11px] text-slate-400 font-medium mr-1">ความคุ้มครองหลัก:</span>

        {/* Own damage */}
        <span
          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${
            ownDamage?.status === 'covered'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          ชนตัวรถ: {ownDamage?.status === 'covered' ? 'คุ้มครอง' : 'ไม่คุ้มครอง'}
        </span>

        {/* Theft / Fire */}
        <span
          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${
            theftFire?.status === 'covered'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          รถหาย/ไฟไหม้: {theftFire?.status === 'covered' ? 'คุ้มครอง' : 'ไม่คุ้มครอง'}
        </span>

        {/* Flood */}
        <span
          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${
            flood?.status === 'covered'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          น้ำท่วม: {flood?.status === 'covered' ? 'คุ้มครอง' : 'ไม่คุ้มครอง'}
        </span>
      </div>

      {/* Card Footer: Source document & Detail Link */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {item.documents.length > 0 ? (
              <span className="font-medium text-slate-600">มีเอกสารอ้างอิง ({item.documents.length})</span>
            ) : (
              <span className="text-amber-600">รอแนบเอกสาร</span>
            )}
          </span>
          {item.verifiedAt && (
            <span className="hidden sm:inline text-slate-400">
              • ตรวจทานเมื่อ {new Date(item.verifiedAt).toLocaleDateString('th-TH')}
            </span>
          )}
        </div>

        <Link
          href={`/plans/${item.planId}?optionId=${item.id}`}
          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <span>ดูรายละเอียดเต็ม</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
