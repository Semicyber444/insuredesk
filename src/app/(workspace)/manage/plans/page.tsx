'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAllPlans, PlanListItem, submitForReview } from '@/lib/queries/plans';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { useAuth } from '@/lib/auth/AuthContext';
import { PlanFormModal } from '@/components/forms/PlanFormModal';
import {
  FileText,
  Plus,
  Send,
  ExternalLink,
  Clock,
  CheckCircle2,
  Edit3,
  Copy,
  Trash2,
  RotateCcw,
  Lock,
  Archive,
} from 'lucide-react';

export default function PlansManagementPage() {
  const { userName, can } = useAuth();
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanListItem | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);

  const reloadData = useCallback(
    (includeArch = showArchived) => {
      setIsLoading(true);
      getAllPlans(includeArch).then((res) => {
        setPlans(res);
        setIsLoading(false);
      });
    },
    [showArchived]
  );

  useEffect(() => {
    let isMounted = true;
    getAllPlans(showArchived).then((res) => {
      if (!isMounted) return;
      setPlans(res);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [showArchived]);

  if (!can('canEditDraft')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">ไม่มีสิทธิ์เข้าถึงหน้าจัดการแพ็กเกจ</h2>
        <p className="text-xs text-slate-500">
          หน้านี้จำกัดเฉพาะบทบาทผู้กรอกข้อมูล (Editor) และผู้ดูแลระบบ (Admin) เท่านั้น
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
        >
          กลับไปหน้าค้นหาประกัน
        </Link>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setIsCopyMode(false);
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: PlanListItem) => {
    setIsCopyMode(false);
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleOpenCopy = (plan: PlanListItem) => {
    setIsCopyMode(true);
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleSubmitReview = async (plan: PlanListItem) => {
    if (!plan.activeVersionId) return;
    await submitForReview(
      plan.activeVersionId,
      `ส่งตรวจสอบแพ็กเกจ "${plan.name}" รุ่นที่ ${plan.latestVersionNo}`,
      userName
    );
    setStatusNotice(`ส่งแพ็กเกจ "${plan.name}" เข้าสู่คิวตรวจสอบเรียบร้อยแล้ว`);
    reloadData();
  };

  const handleDelete = (plan: PlanListItem) => {
    const promptMsg =
      plan.currentStatus === 'published'
        ? `แพ็กเกจ "${plan.name}" มีประวัติเผยแพร่แล้ว ระบบจะจัดเก็บเข้ากรุ (Archive) แทนการลบทิ้งตามกฎ Section 8.1 ต้องการดำเนินการหรือไม่?`
        : `คุณแน่ใจหรือไม่ว่าต้องการลบแพ็กเกจร่าง "${plan.name}"?`;

    if (confirm(promptMsg)) {
      const res = InsuranceStore.deletePlan(plan.id, userName);
      setStatusNotice(
        res.mode === 'archived'
          ? `จัดเก็บแพ็กเกจ "${plan.name}" เข้ากรุ (Archived) เรียบร้อยแล้ว`
          : `ลบแพ็กเกจร่าง "${plan.name}" เรียบร้อยแล้ว`
      );
      reloadData();
    }
  };

  const handleRestore = (plan: PlanListItem) => {
    InsuranceStore.restorePlan(plan.id, userName);
    setStatusNotice(`กู้คืนแพ็กเกจ "${plan.name}" กลับมาใช้งานเรียบร้อยแล้ว`);
    reloadData();
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-xl">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setIsLoading(true);
                setShowArchived(e.target.checked);
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>แสดงแพ็กเกจในกรุ (Archived)</span>
          </label>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างแพ็กเกจใหม่</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-blue-700 hover:underline font-bold cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Plan list table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">กำลังโหลดรายการแพ็กเกจ...</div>
        ) : plans.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">ไม่มีรายการแพ็กเกจในมุมมองนี้</div>
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
                  <tr
                    key={plan.id}
                    className={`hover:bg-slate-50/60 transition ${
                      plan.is_archived ? 'opacity-65 bg-slate-50/40' : ''
                    }`}
                  >
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
                      {plan.is_archived ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold bg-slate-200 text-slate-700">
                          <Archive className="w-3 h-3" />
                          จัดเก็บเข้ากรุ (Archived)
                        </span>
                      ) : plan.currentStatus === 'published' ? (
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
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      {!plan.is_archived && plan.currentStatus === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleSubmitReview(plan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold cursor-pointer"
                          title="ส่งให้ผู้ตรวจสอบอนุมัติ"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-700" />
                          <span>ส่งตรวจ</span>
                        </button>
                      )}

                      {!plan.is_archived && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(plan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                          title="แก้ไขข้อมูลแพ็กเกจ"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          <span>แก้ไข</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenCopy(plan)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 font-semibold cursor-pointer"
                        title="คัดลอกแพ็กเกจนี้เพื่อสร้างแพ็กเกจใหม่"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>คัดลอก</span>
                      </button>

                      <Link
                        href={`/plans/${plan.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 font-semibold"
                        title="ดูรายละเอียดฉบับเต็ม"
                      >
                        <span>เปิดดู</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      {plan.is_archived ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(plan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold cursor-pointer"
                          title="กู้คืนแพ็กเกจกลับมาใช้งาน"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>กู้คืน</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(plan)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 cursor-pointer"
                          title={
                            plan.currentStatus === 'published'
                              ? 'จัดเก็บแพ็กเกจเข้ากรุ (Archive)'
                              : 'ลบแพ็กเกจร่าง'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan Form Modal for Create, Edit & Copy */}
      <PlanFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsCopyMode(false);
        }}
        onSaved={() => {
          if (isCopyMode) {
            setStatusNotice('คัดลอกและสร้างแพ็กเกจประกันภัยใหม่เรียบร้อยแล้ว');
          }
          setIsCopyMode(false);
          reloadData();
        }}
        initialPlan={editingPlan}
        isCopyMode={isCopyMode}
      />
    </div>
  );
}
