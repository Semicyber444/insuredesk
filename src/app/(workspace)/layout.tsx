import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/ui/Navbar';
import { getCurrentSession } from '@/lib/auth/session';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { AlertCircle } from 'lucide-react';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
  }

  const isRealSession = !session.user.id.startsWith('00000000-0000-0000-0000-00000000000');

  return (
    <AuthProvider
      initialRole={session.roles[0] ?? 'viewer'}
      initialUserName={session.profile.display_name}
      initialEmail={session.user.email}
      isRealSession={isRealSession}
      realRoles={session.roles}
    >
      <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
        {/* Top Navigation wrapped in Suspense for usePathname() */}
        <Suspense fallback={<div className="h-16 bg-white border-b border-slate-200" />}>
          <Navbar />
        </Suspense>

        {/* Main Content View */}
        <main className="flex-1">{children}</main>

        {/* Footer Disclaimer (Section 21) */}
        <footer className="bg-white border-t border-slate-200 mt-12 py-6 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">
                  ข้อจำกัดและข้อกำหนดการใช้งานภายในทีม:
                </span>
                <span>
                  ระบบ InsureDesk นี้เป็นเครื่องมืออ้างอิงข้อมูลภายในทีมเท่านั้น ไม่ใช่การยืนยันราคา การรับประกัน หรือความคุ้มครองสำหรับรถคันใดโดยอัตโนมัติ ก่อนนำข้อมูลไปใช้งานจริง ต้องตรวจสอบเอกสารและเงื่อนไขที่มีผลบังคับใช้กับบริษัทประกันภัยเสมอ
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 mt-4">
              <span>© 2026 InsureDesk — ระบบจัดการและค้นหาประกันภัยรถยนต์ภายในทีม</span>
              <span>Next.js + Supabase Architecture</span>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
