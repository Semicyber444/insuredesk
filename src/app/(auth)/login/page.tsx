'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { DEMO_USERS } from '@/lib/auth/demoUsers';
import { setStoredDemoRole } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { AppRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email matches one of the internal demo accounts (when demo auth is enabled)
    const allowDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH !== 'false';
    if (allowDemo) {
      const matchedEntry = Object.entries(DEMO_USERS).find(
        ([, u]) => u.user.email.toLowerCase() === normalizedEmail
      );
      if (matchedEntry) {
        const [roleKey] = matchedEntry;
        setStoredDemoRole(roleKey as AppRole);
        router.push('/search');
        return;
      }
    }

    // Attempt real Supabase Auth sign-in
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('example')) {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          setErrorMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับเชิญเข้าสู่ระบบ');
          setIsLoading(false);
          return;
        }
        router.refresh();
        router.push('/search');
        return;
      } catch {
        setErrorMessage('ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง');
        setIsLoading(false);
        return;
      }
    }

    setErrorMessage('ไม่พบบัญชีที่ระบุ กรุณาใช้อีเมลสมาชิกที่ได้รับเชิญ หรือเลือกบัญชีจำลองด้านล่าง');
    setIsLoading(false);
  };

  const handleQuickLogin = (role: AppRole) => {
    const user = DEMO_USERS[role];
    if (user) {
      setEmail(user.user.email);
      setPassword('password123');
      setStoredDemoRole(role);
      router.push('/search');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">InsureDesk</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            ระบบค้นหาและเปรียบเทียบประกันรถยนต์ภายในทีม (สำหรับสมาชิกที่ได้รับเชิญเท่านั้น)
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">อีเมลสมาชิก</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@insuredesk.team"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Accounts Selection */}
        {process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH !== 'false' && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block text-center">
              เลือกเข้าสู่ระบบด่วนด้วยบัญชีจำลอง (สำหรับทดสอบ)
            </span>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2 rounded-xl border border-slate-200 text-center hover:bg-purple-50 hover:border-purple-300 transition text-[11px] font-semibold text-purple-900 cursor-pointer"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('reviewer')}
                className="p-2 rounded-xl border border-slate-200 text-center hover:bg-amber-50 hover:border-amber-300 transition text-[11px] font-semibold text-amber-900 cursor-pointer"
              >
                Reviewer
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('editor')}
                className="p-2 rounded-xl border border-slate-200 text-center hover:bg-blue-50 hover:border-blue-300 transition text-[11px] font-semibold text-blue-900 cursor-pointer"
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('viewer')}
                className="p-2 rounded-xl border border-slate-200 text-center hover:bg-emerald-50 hover:border-emerald-300 transition text-[11px] font-semibold text-emerald-900 cursor-pointer"
              >
                Viewer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
