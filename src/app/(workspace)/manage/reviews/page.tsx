'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getPendingReviews,
  PendingReviewItem,
  publishPlanVersion,
  rejectPlanVersion,
} from '@/lib/queries/plans';
import { useAuth } from '@/lib/auth/AuthContext';
import { FileCheck, Check, X, Clock, ExternalLink, AlertCircle, Lock } from 'lucide-react';

export default function ReviewManagementPage() {
  const { userName, can } = useAuth();
  const [reviews, setReviews] = useState<PendingReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeActionModal, setActiveActionModal] = useState<{
    versionId: string;
    action: 'publish' | 'reject';
    planName: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reloadData = useCallback(() => {
    setIsLoading(true);
    getPendingReviews().then((res) => {
      setReviews(res);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    getPendingReviews().then((res) => {
      if (!isMounted) return;
      setReviews(res);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!can('canReview')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">ไม่มีสิทธิ์เข้าถึงคิวตรวจสอบข้อมูล</h2>
        <p className="text-xs text-slate-500">
          หน้านี้จำกัดเฉพาะบทบาทผู้ตรวจสอบ (Reviewer) และผู้ดูแลระบบ (Admin) เท่านั้น
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

  const handleConfirmAction = async () => {
    if (!activeActionModal || !reason.trim()) return;

    setIsSubmitting(true);
    setActionError('');
    try {
      if (activeActionModal.action === 'publish') {
        await publishPlanVersion(activeActionModal.versionId, reason.trim(), userName);
      } else {
        await rejectPlanVersion(activeActionModal.versionId, reason.trim(), userName);
      }
      setActiveActionModal(null);
      setReason('');
      reloadData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการดำเนินการ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-blue-600" />
          <span>คิวตรวจสอบและเผยแพร่ข้อมูล (Review Queue)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          สำหรับบทบาทผู้ตรวจสอบ (Reviewer / Admin) ในการตรวจเทียบข้อมูลกับเอกสารต้นทางก่อนเผยแพร่ให้ทีมใช้งาน
        </p>
      </div>

      {/* Review List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">กำลังโหลดรายการรอตรวจ...</div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">ไม่มีรายการค้างตรวจในระบบ</h3>
            <p className="text-xs text-slate-500 mt-1">
              ข้อมูลแพ็กเกจทั้งหมดได้รับการตรวจสอบและเผยแพร่เรียบร้อยแล้ว
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map(({ version, plan, insurer, documentsCount, priceOptionsCount }) => (
              <div
                key={version.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {insurer?.name || 'ไม่ระบุบริษัท'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {plan?.insurance_type}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      รอตรวจสอบ (In Review)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <h3 className="text-base font-bold text-slate-900">{plan?.name}</h3>
                    {plan && (
                      <Link
                        href={`/plans/${plan.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        <span>ตรวจดูรายละเอียด</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span>
                      รุ่นที่: <strong>{version.version_no}</strong>
                    </span>
                    <span>
                      ตัวเลือกราคา: <strong>{priceOptionsCount} รายการ</strong>
                    </span>
                    <span className={documentsCount === 0 ? 'text-red-600 font-semibold' : ''}>
                      เอกสารแนบ: <strong>{documentsCount} ฉบับ</strong>
                    </span>
                    {version.notes && (
                      <span className="text-slate-600 italic">&quot;{version.notes}&quot;</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError('');
                      setActiveActionModal({
                        versionId: version.id,
                        action: 'reject',
                        planName: plan?.name ?? '',
                      });
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ส่งกลับแก้ไข</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionError('');
                      setActiveActionModal({
                        versionId: version.id,
                        action: 'publish',
                        planName: plan?.name ?? '',
                      });
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>อนุมัติและเผยแพร่</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2">
              {activeActionModal.action === 'publish' ? (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900">
                {activeActionModal.action === 'publish'
                  ? 'ยืนยันการเผยแพร่ข้อมูล'
                  : 'ส่งกลับให้ผู้กรอกแก้ไข'}
              </h3>
            </div>

            {actionError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600">
              แพ็กเกจ: <strong>{activeActionModal.planName}</strong>
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                เหตุผลและบันทึกการตรวจสอบ (จะถูกบันทึกลงใน Audit Log):
              </label>
              <textarea
                rows={3}
                placeholder={
                  activeActionModal.action === 'publish'
                    ? 'เช่น ตรวจสอบตารางเบี้ยและเงื่อนไขตรงตามเอกสารต้นทางครบถ้วน'
                    : 'เช่น ข้อมูลทุนประกันไม่ตรงกับหน้า 3 ของเอกสาร กรุณาแก้ไข'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveActionModal(null);
                  setReason('');
                  setActionError('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!reason.trim() || isSubmitting}
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                  activeActionModal.action === 'publish'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
