'use client';

import Link from 'next/link';
import { Columns3, X, ArrowRight } from 'lucide-react';
import { InsuranceSearchResultItem } from '@/types/insurance';

interface ComparisonFloatingDockProps {
  selectedIds: string[];
  allItems: InsuranceSearchResultItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function ComparisonFloatingDock({
  selectedIds,
  allItems,
  onRemove,
  onClear,
}: ComparisonFloatingDockProps) {
  if (selectedIds.length === 0) return null;

  const selectedItems = selectedIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is InsuranceSearchResultItem => !!item);

  const canCompare = selectedIds.length >= 2 && selectedIds.length <= 4;
  const compareUrl = `/compare?ids=${selectedIds.join(',')}`;

  return (
    // Sticky, not fixed: it rides the bottom of the screen while the results scroll and parks
    // at the end of them, so it never covers the footer disclaimer.
    <div className="sticky bottom-4 sm:bottom-6 z-40 mx-auto mt-6 w-full max-w-4xl">
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Summary & items */}
        <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700 shrink-0">
            <Columns3 className="w-5 h-5 text-blue-400" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-300">เลือกเปรียบเทียบ</span>
              <span aria-live="polite" className="text-sm font-semibold text-white">
                {selectedIds.length}/4 รายการ
              </span>
            </div>
          </div>

          {/* Selected pills */}
          <div className="flex items-center gap-2">
            {selectedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs shrink-0"
              >
                <span className="font-semibold text-blue-300">{item.insurerName}</span>
                <span className="truncate max-w-[120px]">{item.planName}</span>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="hover:text-red-400 p-0.5 rounded transition cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-400"
                  title="นำออก"
                  aria-label={`นำ ${item.planName} ออกจากการเปรียบเทียบ`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-300 hover:text-white px-3 py-2 rounded-lg transition cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            ล้างทั้งหมด
          </button>

          {canCompare ? (
            <Link
              href={compareUrl}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              <span>เปรียบเทียบ ({selectedIds.length})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-xs font-medium cursor-not-allowed"
            >
              ต้องเลือก 2-4 รายการ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
