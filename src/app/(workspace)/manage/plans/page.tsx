'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllPlans, submitForReview } from '@/lib/queries/plans';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { PlanFormModal } from '@/components/forms/PlanFormModal';
import { FileText, Plus, Send, ExternalLink, Clock, CheckCircle2, Edit3, Trash2 } from 'lucide-react';

export default function PlansManagementPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  const loadData = () => {
    setIsLoading(true);
    getAllPlans().then((res) => {
      setPlans(res);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: any) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleDelete = (planId: string, name: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบแพ็กเกจ "${name}"?`)) {
      InsuranceStore.deletePlan(planId);
      loadData();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>จัดการแพ็กเกจและข้อมูลร่าง (Plans Management)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            บันทึก แก้ไขข้อมูลแพ็กเกจ รุ่นเงื่อนไข ราคา และเอกสารอ้างอิง
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างแพ็กเกจใหม่</span>
        </button>
      </div>

      {/* Plan list table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">กำลังโหลดรายการแพ็กเกจ...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-4">บริษัทประกัน</th>
                  <th className="p-4">ชื่อแพ็กเกจ</th>
                  <th className="p-4">ประเภท</th>
                  <th className="p-4">เวอร์ชันล่าสุด</th>
                  <th className="p-4">สถานะการทำงาน</th>
                  <th className="p-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 font-bold text-slate-800">{plan.insurerName}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{plan.name}</div>
                      <div className="text-[11px] text-slate-400">ID: {plan.id.slice(0, 8)}...</div>
                    </td>
                    <td className="p-4 font-semibold text-slate-700">{plan.insurance_type}</td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-800">รุ่นที่ {plan.latestVersionNo}</span>
                      <span className="text-slate-400 text-[10px] block">({plan.versionsCount} รุ่น)</span>
                    </td>
                    <td className="p-4">
                      {plan.currentStatus === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          เผยแพร่แล้ว (Published)
                        </span>
                      ) : plan.currentStatus === 'in_review' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          รอตรวจสอบ (In Review)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700">
                          ข้อมูลร่าง (Draft)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        title="แก้ไขข้อมูลแพ็กเกจ"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>แก้ไข</span>
                      </button>

                      <Link
                        href={`/plans/${plan.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 font-semibold"
                        title="ดูรายละเอียดฉบับเต็ม"
                      >
                        <span>เปิดดู</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={() => handleDelete(plan.id, plan.name)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 cursor-pointer"
                        title="ลบแพ็กเกจ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan Form Modal for Create & Edit */}
      <PlanFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
        initialPlan={editingPlan}
      />
    </div>
  );
}
