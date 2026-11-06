'use client';

import { useState } from 'react';
import { SearchFilters, PlateFilter } from '@/types/insurance';
import { Insurer, VehicleModel, CoverageType, InsuranceType, RepairType } from '@/types/database';
import { Filter, RotateCcw, Search, MapPin, ChevronDown } from 'lucide-react';

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
  // Below lg the filters fold away so results start on the first screen.
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = [
    filters.query?.trim(),
    filters.insuranceTypes?.length,
    filters.repairTypes?.length,
    filters.insurerIds?.length,
    filters.vehicleBrand,
    filters.vehicleModelId,
    filters.carAge != null,
    filters.usageType,
    filters.registrationPlate,
    filters.minPremium != null || filters.maxPremium != null,
    filters.includeUnknownPrice,
    filters.minSumInsured != null || filters.maxSumInsured != null,
    filters.requiredCoverageCodes?.length,
  ].filter(Boolean).length;

  const handleReset = () => {
    onFilterChange({
      page: 1,
      pageSize: 20,
      sortBy: filters.sortBy ?? 'premium_asc',
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

  // Group coverages by category & derive vehicle brands
  const categories = Array.from(new Set(coverageTypes.map((c) => c.category)));
  const brands = Array.from(new Set(vehicleModels.map((vm) => vm.brand)));
  const visibleModels = filters.vehicleBrand
    ? vehicleModels.filter((vm) => vm.brand === filters.vehicleBrand)
    : vehicleModels;

  return (
    <aside
      aria-label="ตัวกรองค้นหา"
      className="w-full lg:w-80 lg:shrink-0 bg-white border border-slate-200 rounded-xl p-5 shadow-xs"
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 ${isOpen ? 'pb-3 border-b border-slate-100' : 'lg:pb-3 lg:border-b lg:border-slate-100'}`}>
        {/* Phone and tablet: the heading opens and closes the panel */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-controls="filter-panel"
          className="lg:hidden flex items-center gap-2 text-slate-800 font-bold text-base rounded-lg -m-1 p-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Filter className="w-4 h-4 text-blue-600" />
          <span>ตัวกรองค้นหา</span>
          {activeCount > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              ใช้อยู่ {activeCount}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {/* Desktop: the panel is always open */}
        <div className="hidden lg:flex items-center gap-2 text-slate-800 font-bold text-base">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>ตัวกรองค้นหา</span>
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            <span className="sr-only">พบ </span>
            {totalResults}
            <span className="sr-only"> รายการ</span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <RotateCcw className="w-3 h-3" />
          ล้างค่า
        </button>
      </div>

      <div id="filter-panel" className={`${isOpen ? 'block' : 'hidden'} lg:block mt-6 space-y-6`}>

      {/* 1. Keyword search */}
      <div className="space-y-1.5">
        <label htmlFor="filter-query" className="text-xs font-semibold text-slate-700">ค้นหาชื่อบริษัท หรือ แพ็กเกจ</label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            id="filter-query"
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
        <span id="filter-insurance-types" className="text-xs font-semibold text-slate-700">ประเภทประกันภัย</span>
        <div role="group" aria-labelledby="filter-insurance-types" className="grid grid-cols-2 gap-1.5">
          {INSURANCE_TYPES.map((type) => {
            const isSelected = (filters.insuranceTypes ?? []).includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleInsuranceType(type)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
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
        <span id="filter-repair-types" className="text-xs font-semibold text-slate-700">ลักษณะการซ่อม</span>
        <div role="group" aria-labelledby="filter-repair-types" className="space-y-1.5">
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
        <span id="filter-insurers" className="text-xs font-semibold text-slate-700">บริษัทประกันภัย</span>
        <div role="group" aria-labelledby="filter-insurers" className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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

      {/* 5. Car Brand, Model, Age & Usage Type */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="space-y-1.5">
          <label htmlFor="filter-vehicleBrand" className="text-xs font-semibold text-slate-700">ยี่ห้อรถยนต์</label>
          <select
            id="filter-vehicleBrand"
            value={filters.vehicleBrand ?? ''}
            onChange={(e) => {
              const nextBrand = e.target.value || undefined;
              const currentModel = vehicleModels.find((vm) => vm.id === filters.vehicleModelId);
              onFilterChange({
                ...filters,
                vehicleBrand: nextBrand,
                vehicleModelId:
                  nextBrand && currentModel && currentModel.brand !== nextBrand
                    ? undefined
                    : filters.vehicleModelId,
                page: 1,
              });
            }}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ทุกยี่ห้อ / ไม่ระบุ</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-vehicleModelId" className="text-xs font-semibold text-slate-700">รุ่นรถยนต์</label>
          <select
            id="filter-vehicleModelId"
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
            {visibleModels.map((vm) => (
              <option key={vm.id} value={vm.id}>
                {vm.brand} {vm.model} ({vm.variant || vm.powertrain || 'ทั่วไป'})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label htmlFor="filter-carAge" className="text-xs font-semibold text-slate-700">อายุรถ (ปี)</label>
            <input
              id="filter-carAge"
              type="number"
              min={0}
              max={35}
              placeholder="เช่น 3 ปี"
              value={filters.carAge ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  carAge: e.target.value !== '' ? parseInt(e.target.value, 10) : undefined,
                  page: 1,
                })
              }
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-usageType" className="text-xs font-semibold text-slate-700">การใช้งาน</label>
            <select
              id="filter-usageType"
              value={filters.usageType ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  usageType: e.target.value || undefined,
                  page: 1,
                })
              }
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              <option value="private">ส่วนบุคคล</option>
              <option value="commercial">เชิงพาณิชย์</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-registrationPlate" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>ป้ายทะเบียนรถ</span>
          </label>
          <select
            id="filter-registrationPlate"
            value={filters.registrationPlate ?? ''}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                registrationPlate: (e.target.value || undefined) as PlateFilter | undefined,
                page: 1,
              })
            }
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ทุกป้ายทะเบียน / ไม่ระบุ</option>
            <option value="bangkok">รถป้าย กทม. (แสดงแผนที่รับรถ กทม.)</option>
            <option value="metro">รถป้ายปริมณฑล</option>
            <option value="upcountry">รถป้ายต่างจังหวัด (ตจว.)</option>
            <option value="bangkok_only_strict">ดูเฉพาะแผนจำกัดป้าย กทม. เท่านั้น</option>
          </select>
        </div>
      </div>

      {/* 6. Premium & Sum Insured Ranges */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="space-y-1.5">
          <span id="filter-premium-range" className="text-xs font-semibold text-slate-700">ช่วงเบี้ยรวม (บาท)</span>
          <div role="group" aria-labelledby="filter-premium-range" className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              placeholder="ต่ำสุด"
              aria-label="เบี้ยรวมต่ำสุด (บาท)"
              value={filters.minPremium ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  minPremium: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              min={0}
              placeholder="สูงสุด"
              aria-label="เบี้ยรวมสูงสุด (บาท)"
              value={filters.maxPremium ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  maxPremium: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
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

        <div className="space-y-1.5">
          <span id="filter-sum-range" className="text-xs font-semibold text-slate-700">ช่วงทุนประกัน (บาท)</span>
          <div role="group" aria-labelledby="filter-sum-range" className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              step={50000}
              placeholder="ทุนต่ำสุด"
              aria-label="ทุนประกันต่ำสุด (บาท)"
              value={filters.minSumInsured ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  minSumInsured: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              min={0}
              step={50000}
              placeholder="ทุนสูงสุด"
              aria-label="ทุนประกันสูงสุด (บาท)"
              value={filters.maxSumInsured ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  maxSumInsured: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 7. All Required Coverages (Section 10.2: ALL standard coverage categories) */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <span id="filter-coverages" className="text-xs font-semibold text-slate-700 block">
              ความคุ้มครองที่ต้องมี ({filters.requiredCoverageCodes?.length || 0})
            </span>
            <span className="text-[10px] text-slate-500">แผนต้องคุ้มครอง ไม่นับที่เป็นตัวเลือกซื้อเพิ่ม</span>
          </div>
        </div>

        <div role="group" aria-labelledby="filter-coverages" className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const typesInCat = coverageTypes.filter((c) => c.category === cat);
            return (
              <div key={cat} className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  หมวด{cat}
                </span>
                <div className="space-y-1">
                  {typesInCat.map((ct) => {
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
            );
          })}
        </div>
      </div>
      </div>
    </aside>
  );
}
