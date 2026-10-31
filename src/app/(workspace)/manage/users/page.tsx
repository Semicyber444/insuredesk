'use client';

import Link from 'next/link';
import { Users, UserPlus, Mail, Lock } from 'lucide-react';
import { DEMO_USERS } from '@/lib/auth/demoUsers';
import { useAuth } from '@/lib/auth/AuthContext';
import { getRoleBadgeClass, getRoleLabelThai } from '@/lib/permissions/roles';

export default function UsersManagementPage() {
  const { can } = useAuth();
  const usersList = Object.values(DEMO_USERS);

  if (!can('canManageUsers')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">ไม่มีสิทธิ์เข้าถึงหน้าจัดการสมาชิก</h2>
        <p className="text-xs text-slate-500">
          หน้านี้จำกัดเฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>จัดการสมาชิกและบทบาท (Team Members)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            จำกัดการเข้าใช้งานเฉพาะผู้ที่ได้รับเชิญผ่าน Supabase Auth Invitation เท่านั้น
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            alert('สามารถเชิญสมาชิกจริงเพิ่มเติมได้ผ่านเมนู Authentication -> Users -> Invite user บน Supabase Dashboard')
          }
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>คำแนะนำการเชิญสมาชิก</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          บัญชีและบทบาทมาตรฐานในระบบ ({usersList.length} บัญชี)
        </div>
        <div className="divide-y divide-slate-100">
          {usersList.map((u) => (
            <div
              key={u.user.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                  {u.profile.display_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{u.profile.display_name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{u.user.email}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {u.roles.map((r) => (
                  <span
                    key={r}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${getRoleBadgeClass(
                      r
                    )}`}
                  >
                    {getRoleLabelThai(r)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
