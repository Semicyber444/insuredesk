'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAuditLogs } from '@/lib/queries/audit';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuditLog } from '@/types/database';
import { History, Clock, Lock } from 'lucide-react';

export default function AuditPage() {
  const { can } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAuditLogs().then((res) => {
      if (!isMounted) return;
      setLogs(res);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!can('canViewAudit')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">ไม่มีสิทธิ์เข้าถึงประวัติระบบ (Audit Logs)</h2>
        <p className="text-xs text-slate-500">
          หน้านี้จำกัดเฉพาะผู้ตรวจสอบ (Reviewer) และผู้ดูแลระบบ (Admin) เท่านั้น
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" />
          <span>บันทึกประวัติการเปลี่ยนแปลง (Audit Logs)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          บันทึกการส่งตรวจ การเผยแพร่ การจัดเก็บเข้ากรุ และการแก้ไขทุกรายการเพื่อความโปร่งใสและตรวจสอบย้อนหลังได้
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">กำลังโหลดประวัติ...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">ยังไม่มีประวัติการเปลี่ยนแปลง</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-5 space-y-2 hover:bg-slate-50/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      {log.actor_name || 'ระบบอัตโนมัติ'}
                    </span>
                    <span>•</span>
                    <span className="text-[11px] font-mono text-slate-400">ID: {log.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(log.created_at).toLocaleString('th-TH')}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] uppercase ${
                      log.action === 'publish' || log.action === 'restore'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.action === 'reject' || log.action === 'delete'
                        ? 'bg-red-100 text-red-800'
                        : log.action === 'archive' || log.action === 'submit_review'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="font-semibold text-slate-700">
                    เป้าหมาย: {log.entity_type} ({log.entity_id.slice(0, 12)}...)
                  </span>
                </div>

                {log.reason && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <strong>เหตุผล:</strong> {log.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
