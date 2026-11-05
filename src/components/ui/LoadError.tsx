import { AlertCircle } from 'lucide-react';

export function LoadError({ message }: { message: string }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-black text-slate-900">โหลดข้อมูลไม่สำเร็จ</h2>
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}
