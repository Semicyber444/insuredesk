'use client';

import { SearchFilters } from '@/types/insurance';
import { Insurer, VehicleModel, CoverageType, InsuranceType, RepairType } from '@/types/database';
import { Filter, RotateCcw, Search } from 'lucide-react';

interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
  insurers: Insurer[];
  vehicleModels: VehicleModel[];
  coverageTypes: CoverageType[];
  totalResults: number;
}

const INSURANCE_TYPES: InsuranceType[] = ['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3'];
const REPAIR_TYPES: { label: string; value: RepairType }[] = [
  { label: 'ซ่อมห้าง (ศูนย์บริการ)', value: 'dealer' },
  { label: 'ซ่อมอู่ (อู่ในเครือ)', value: 'garage' },
];

export function FilterSidebar({
  filters,
  onFilterChange,
  insurers,
  vehicleModels,
  coverageTypes,
  totalResults,
}: FilterSidebarProps) {
  const handleReset = () => {
    onFilterChange({
      page: 1,
      pageSize: 20,
    });
  };

  const toggleInsurer = (id: string) => {
    const current = filters.insurerIds ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onFilterChange({ ...filters, insurerIds: next, page: 1 });
  };

  const toggleInsuranceType = (type: InsuranceType) => {
    const current = filters.insuranceTypes ?? [];
    const next = current.includes(type) ? current.filter((x) => x !== type) : [...current, type];
    onFilterChange({ ...filters, insuranceTypes: next, page: 1 });
  };

  const toggleRepairType = (repair: RepairType) => {
    const current = filters.repairTypes ?? [];
    const next = current.includes(repair) ? current.filter((x) => x !== repair) : [...current, repair];
    onFilterChange({ ...filters, repairTypes: next, page: 1 });
  };

  const toggleCoverage = (code: string) => {
    const current = filters.requiredCoverageCodes ?? [];
    const next = current.includes(code) ? current.filter((x) => x !== code) : [...current, code];
    onFilterChange({ ...filters, requiredCoverageCodes: next, page: 1 });
  };

  return (
    <aside className="w-full lg:w-72 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>ตัวกรองค้นหา</span>
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {totalResults}
          </span>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          ล้างค่า
        </button>
      </div>

      {/* 1. Keyword search */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700">ค้นหาชื่อบริษัท หรือ แพ็กเกจ</label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="เช่น วิริยะ, BKI, ซ่อมห้าง..."
            value={filters.query ?? ''}
            onChange={(e) => onFilterChange({ ...filters, query: e.target.value, page: 1 })}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* 2. Insurance Types */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">ประเภทประกันภัย</label>
        <div className="grid grid-cols-2 gap-1.5">
          {INSURANCE_TYPES.map((type) => {
            const isSelected = (filters.insuranceTypes ?? []).includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleInsuranceType(type)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Repair Type */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">ลักษณะการซ่อม</label>
        <div className="space-y-1.5">
          {REPAIR_TYPES.map((item) => {
            const isChecked = (filters.repairTypes ?? []).includes(item.value);
            return (
              <label
                key={item.value}
                className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleRepairType(item.value)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. Insurers Multi-select */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">บริษัทประกันภัย</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {insurers.map((ins) => {
            const isChecked = (filters.insurerIds ?? []).includes(ins.id);
            return (
              <label
                key={ins.id}
                className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleInsurer(ins.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{ins.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. Car Model & Age */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">รุ่นรถยนต์</label>
          <select
            value={filters.vehicleModelId ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                vehicleModelId: e.target.value || undefined,
                page: 1,
              })
            }
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ทุกรุ่น / ไม่ระบุ</option>
            {vehicleModels.map((vm) => (
              <option key={vm.id} value={vm.id}>
                {vm.brand} {vm.model} ({vm.variant || vm.powertrain || 'ทั่วไป'})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">อายุรถยนต์ (ปี)</label>
          <input
            type="number"
            min={0}
            max={30}
            placeholder="เช่น 3 ปี"
            value={filters.carAge ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                carAge: e.target.value ? parseInt(e.target.value, 10) : undefined,
                page: 1,
              })
            }
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 6. Premium Range */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-700">ช่วงเบี้ยรวม (บาท)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="ต่ำสุด"
            value={filters.minPremium ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                minPremium: e.target.value ? parseFloat(e.target.value) : undefined,
                page: 1,
              })
            }
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="สูงสุด"
            value={filters.maxPremium ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                maxPremium: e.target.value ? parseFloat(e.target.value) : undefined,
                page: 1,
              })
            }
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={filters.includeUnknownPrice ?? false}
            onChange={(e) =>
              onFilterChange({ ...filters, includeUnknownPrice: e.target.checked, page: 1 })
            }
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>รวมแผนที่ยังไม่ระบุราคา</span>
        </label>
      </div>

      {/* 7. Required Coverages (Section 10.2) */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-700">ความคุ้มครองที่ต้องมี (บังคับคุ้มครอง)</label>
          <span className="text-[10px] text-slate-500">แผนต้องคุ้มครอง ไม่นับที่เป็นตัวเลือกซื้อเพิ่ม</span>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {coverageTypes.slice(0, 6).map((ct) => {
            const isChecked = (filters.requiredCoverageCodes ?? []).includes(ct.code);
            return (
              <label
                key={ct.id}
                className="flex items-start gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCoverage(ct.code)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <span className="line-clamp-1">{ct.name}</span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
