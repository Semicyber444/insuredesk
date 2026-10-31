'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  Search,
  Columns3,
  Settings,
  FileCheck,
  Users,
  History,
  FileText,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { AppRole } from '@/types/database';
import { getRoleBadgeClass, getRoleLabelThai } from '@/lib/permissions/roles';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeRole, userName, isRealSession, setActiveRole, can } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/search', label: 'ค้นหาประกัน', icon: Search, show: true },
    { href: '/compare', label: 'เปรียบเทียบ', icon: Columns3, show: true },
    { href: '/manage/plans', label: 'จัดการแพ็กเกจ', icon: FileText, show: can('canEditDraft') },
    { href: '/manage/reviews', label: 'ตรวจสอบ (Review)', icon: FileCheck, show: can('canReview') },
    { href: '/manage/insurers', label: 'บริษัทประกัน', icon: Settings, show: can('canEditDraft') },
    { href: '/manage/users', label: 'สมาชิก', icon: Users, show: can('canManageUsers') },
    { href: '/manage/audit', label: 'ประวัติ (Audit)', icon: History, show: can('canViewAudit') },
  ];

  const handleLogout = async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && !supabaseUrl.includes('example')) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch {
      // Ignore sign-out errors in demo mode
    }
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/search" className="flex items-center gap-2.5 font-bold text-slate-900 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-blue-900">InsureDesk</span>
                <span className="text-[10px] text-slate-500 font-medium -mt-1">ระบบเปรียบเทียบประกันรถยนต์</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                if (!link.show) return null;
                const Icon = link.icon;
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Role Switcher */}
          <div className="flex items-center gap-2.5">
            {!isRealSession && (
              <div className="hidden xl:flex items-center bg-slate-100 rounded-lg p-1 text-xs">
                <span className="px-2 text-slate-500 font-medium">สิทธิ์ทดสอบ:</span>
                {(['admin', 'reviewer', 'editor', 'viewer'] as AppRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setActiveRole(r)}
                    className={`px-2.5 py-1 rounded-md transition font-medium capitalize cursor-pointer ${
                      activeRole === r
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800">{userName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${getRoleBadgeClass(activeRole)}`}
                >
                  {getRoleLabelThai(activeRole)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="ออกจากระบบ / สลับบัญชี"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="เปิดเมนูนำทาง"
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-lg">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              if (!link.show) return null;
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {!isRealSession && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-semibold block mb-1.5">
                สลับสิทธิ์ทดสอบ (Demo Role):
              </span>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                {(['admin', 'reviewer', 'editor', 'viewer'] as AppRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setActiveRole(r);
                      setMobileMenuOpen(false);
                    }}
                    className={`py-1.5 rounded-lg font-semibold capitalize transition cursor-pointer ${
                      activeRole === r ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
