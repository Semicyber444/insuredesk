'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { demoLoginAction, loginAction } from '@/lib/actions/auth';
import { AppRole } from '@/types/database';

export function LoginForm({ demoAuthEnabled }: { demoAuthEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    const result = await loginAction(email, password);
    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }
    router.push('/search');
  };

  const handleQuickLogin = async (role: AppRole) => {
    setIsLoading(true);
    setErrorMessage('');
    const result = await demoLoginAction(role);
    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }
    router.push('/search');
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
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">อีเมลสมาชิก</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="login-email"
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
            <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="login-password"
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
        {demoAuthEnabled && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block text-center">
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
