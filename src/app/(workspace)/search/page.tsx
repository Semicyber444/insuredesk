'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchFilters, InsuranceSearchResultItem } from '@/types/insurance';
import { Insurer, VehicleModel, CoverageType } from '@/types/database';
import { searchInsuranceOptions, buildSearchResultItems } from '@/lib/queries/search';
import { getInsurers, getVehicleModels, getCoverageTypes } from '@/lib/queries/insurers';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { MOCK_INSURERS, MOCK_VEHICLE_MODELS, MOCK_COVERAGE_TYPES } from '@/lib/queries/mockData';
import { FilterSidebar } from '@/components/search/FilterSidebar';
import { PriceOptionCard } from '@/components/search/PriceOptionCard';
import { ComparisonFloatingDock } from '@/components/search/ComparisonFloatingDock';
import { SearchX, ArrowUpDown } from 'lucide-react';

export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    page: 1,
    pageSize: 20,
    sortBy: 'premium_asc',
  });

  const [insurers, setInsurers] = useState<Insurer[]>(MOCK_INSURERS);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>(MOCK_VEHICLE_MODELS);
  const [coverageTypes, setCoverageTypes] = useState<CoverageType[]>(MOCK_COVERAGE_TYPES);
  const [allOptionsPool, setAllOptionsPool] = useState<InsuranceSearchResultItem[]>([]);

  const [results, setResults] = useState<{
    items: InsuranceSearchResultItem[];
    totalCount: number;
    page: number;
    totalPages: number;
  }>({
    items: [],
    totalCount: 0,
    page: 1,
    totalPages: 1,
  });

  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleFilterChange = useCallback((nextFilters: SearchFilters) => {
    setIsLoading(true);
    setFilters(nextFilters);
  }, []);

  // Load dynamic reference data & saved compare basket on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([getInsurers(true), getVehicleModels(), getCoverageTypes()]).then(
      ([insList, vehList, covList]) => {
        if (!isMounted) return;
        setInsurers(insList);
        setVehicleModels(vehList);
        setCoverageTypes(covList);
        const pool = buildSearchResultItems();
        setAllOptionsPool(pool);
        const validIds = new Set(pool.map((p) => p.id));
        const savedBasket = InsuranceStore.getCompareBasket().filter((id) => validIds.has(id));
        setSelectedForCompare(savedBasket);
        InsuranceStore.setCompareBasket(savedBasket);
      }
    );
    return () => {
      isMounted = false;
    };
  }, []);

  // Execute search whenever filters change
  useEffect(() => {
    let isMounted = true;

    searchInsuranceOptions(filters).then((res) => {
      if (isMounted) {
        setResults(res);
        setAllOptionsPool(buildSearchResultItems());
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [filters]);

  const handleToggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4
        ? prev
        : [...prev, id];
      InsuranceStore.setCompareBasket(next);
      return next;
    });
  };

  const handleRemoveCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      const next = prev.filter((x) => x !== id);
      InsuranceStore.setCompareBasket(next);
      return next;
    });
  };

  const handleClearCompare = () => {
    setSelectedForCompare([]);
    InsuranceStore.setCompareBasket([]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            ค้นหาและเปรียบเทียบประกันภัยรถยนต์
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ฐานข้อมูลเงื่อนไขและราคาอ้างอิงภายในทีม เฉพาะแพ็กเกจที่ผ่านการอนุมัติเผยแพร่แล้ว
          </p>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">เรียงตาม:</span>
          <select
            value={filters.sortBy ?? 'premium_asc'}
            onChange={(e) =>
              handleFilterChange({
                ...filters,
                sortBy: e.target.value as SearchFilters['sortBy'],
                page: 1,
              })
            }
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="premium_asc">เบี้ยประกันรวม: ต่ำไปสูง</option>
            <option value="premium_desc">เบี้ยประกันรวม: สูงไปต่ำ</option>
            <option value="sum_insured_desc">ทุนประกัน: มากไปน้อย</option>
            <option value="name_asc">ชื่อบริษัทประกัน (ก-ฮ)</option>
          </select>
        </div>
      </div>

      {/* Main Content Layout: Sidebar + List */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Filter Sidebar */}
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          insurers={insurers}
          vehicleModels={vehicleModels}
          coverageTypes={coverageTypes}
          totalResults={results.totalCount}
        />

        {/* Results Stream */}
        <div className="flex-1 w-full space-y-4">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium text-slate-600">กำลังประมวลผลการค้นหา...</p>
            </div>
          ) : results.items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                <SearchX className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">ไม่พบแพ็กเกจที่ตรงตามเงื่อนไข</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                ลองปรับลดเงื่อนไขตัวกรอง เช่น ขยายช่วงเบี้ย หรือเลือกไม่บังคับความคุ้มครองบางรายการ
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  แสดง {results.items.length} จากทั้งหมด {results.totalCount} รายการ
                </span>
                <span>(คลิกปุ่ม &quot;เปรียบเทียบ&quot; เพื่อเลือกเทียบได้สูงสุด 4 รายการ)</span>
              </div>

              {results.items.map((item) => (
                <PriceOptionCard
                  key={item.id}
                  item={item}
                  isSelectedForCompare={selectedForCompare.includes(item.id)}
                  onToggleCompare={handleToggleCompare}
                  canSelectMore={selectedForCompare.length < 4}
                />
              ))}

              {/* Pagination */}
              {results.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-6">
                  {Array.from({ length: results.totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleFilterChange({ ...filters, page: idx + 1 })}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition cursor-pointer ${
                        results.page === idx + 1
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating compare dock at bottom of page */}
      <ComparisonFloatingDock
        selectedIds={selectedForCompare}
        allItems={allOptionsPool.length > 0 ? allOptionsPool : results.items}
        onRemove={handleRemoveCompare}
        onClear={handleClearCompare}
      />
    </div>
  );
}
