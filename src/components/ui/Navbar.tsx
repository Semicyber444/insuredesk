'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Search, Columns3, Settings, FileCheck, Users, History, FileText } from 'lucide-react';
import { AppRole } from '@/types/database';
import { getRoleBadgeClass, getRoleLabelThai } from '@/lib/permissions/roles';
import { useState } from 'react';

interface NavbarProps {
  currentRole?: AppRole;
  userName?: string;
}

export function Navbar({ currentRole = 'admin', userName = 'สมชาย ผู้ดูแลระบบ' }: NavbarProps) {
  const pathname = usePathname();
  const [activeRole, setActiveRole] = useState<AppRole>(currentRole);

  const navLinks = [
    { href: '/search', label: 'ค้นหาประกัน', icon: Search },
    { href: '/compare', label: 'เปรียบเทียบ', icon: Columns3 },
    { href: '/manage/plans', label: 'จัดการแพ็กเกจ', icon: FileText, roles: ['editor', 'admin'] },
    { href: '/manage/reviews', label: 'ตรวจสอบ (Review)', icon: FileCheck, roles: ['reviewer', 'admin'] },
    { href: '/manage/insurers', label: 'บริษัทประกัน', icon: Settings, roles: ['editor', 'admin'] },
    { href: '/manage/users', label: 'สมาชิก', icon: Users, roles: ['admin'] },
    { href: '/manage/audit', label: 'ประวัติ (Audit)', icon: History, roles: ['reviewer', 'admin'] },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/search" className="flex items-center gap-2.5 font-bold text-slate-900 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-blue-900">InsureDesk</span>
                <span className="text-[10px] text-slate-500 font-medium -mt-1">ระบบเปรียบเทียบประกันรถยนต์</span>
              </div>
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isAllowed = !link.roles || link.roles.includes(activeRole);
                if (!isAllowed) return null;

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

          {/* User Profile & Role Switcher for Pair Programming / Testing */}
          <div className="flex items-center gap-3">
            {/* Quick Role Simulator Switcher */}
            <div className="hidden lg:flex items-center bg-slate-100 rounded-lg p-1 text-xs">
              <span className="px-2 text-slate-500 font-medium">สิทธิ์ทดสอบ:</span>
              {(['admin', 'reviewer', 'editor', 'viewer'] as AppRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRole(r)}
                  className={`px-2.5 py-1 rounded-md transition font-medium capitalize ${
                    activeRole === r
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {userName.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800">{userName}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${getRoleBadgeClass(activeRole)}`}>
                  {getRoleLabelThai(activeRole)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
