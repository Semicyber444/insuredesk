'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getInsurers } from '@/lib/queries/insurers';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import { useAuth } from '@/lib/auth/AuthContext';
import { InsurerSchema } from '@/lib/validation/schemas';
import { Insurer } from '@/types/database';
import {
  Building2,
  Plus,
  Globe,
  Phone,
  ExternalLink,
  Edit3,
  Trash2,
  Lock,
  AlertCircle,
} from 'lucide-react';

export default function InsurersPage() {
  const { userName, can } = useAuth();
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const loadData = () => {
    getInsurers().then(setInsurers);
  };

  useEffect(() => {
    let isMounted = true;
    getInsurers().then((res) => {
      if (isMounted) setInsurers(res);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!can('canEditDraft')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">ไม่มีสิทธิ์เข้าถึงหน้าจัดการบริษัทประกัน</h2>
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
    setEditingId(null);
    setName('');
    setContact('');
    setWebsite('');
    setIsActive(true);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (ins: Insurer) => {
    setEditingId(ins.id);
    setName(ins.name);
    setContact(ins.contact_channels || '');
    setWebsite(ins.website || '');
    setIsActive(ins.is_active);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleDelete = (id: string, insurerName: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหรือปิดการใช้งานบริษัท "${insurerName}"?`)) {
      const res = InsuranceStore.deleteInsurer(id, userName);
      setStatusNotice(
        res.mode === 'deactivated'
          ? `บริษัท "${insurerName}" มีแพ็กเกจผูกอยู่ ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" แทนการลบเพื่อรักษาข้อมูลอ้างอิง`
          : `ลบบริษัท "${insurerName}" เรียบร้อยแล้ว`
      );
      loadData();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsed = InsurerSchema.safeParse({
      name,
      contact_channels: contact || null,
      website: website || '',
      is_active: isActive,
    });

    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง');
      return;
    }

    InsuranceStore.saveInsurer(
      {
        id: editingId || undefined,
        name: parsed.data.name,
        contact_channels: parsed.data.contact_channels,
        website: parsed.data.website || null,
        is_active: parsed.data.is_active,
      },
      userName
    );

    setShowModal(false);
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <span>จัดการบริษัทประกันภัย (Insurers)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            ข้อมูลบริษัทและช่องทางติดต่อเพื่อประสานงานเช็คเบี้ย
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มบริษัทประกัน</span>
        </button>
      </div>

      {statusNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-amber-800 hover:underline font-bold cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insurers.map((ins) => (
          <div
            key={ins.id}
            className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between ${
              !ins.is_active ? 'opacity-65 bg-slate-50/60' : ''
            }`}
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-base font-bold text-slate-900">{ins.name}</h3>
                {ins.is_active ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    เปิดใช้งาน
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                    ปิดใช้งาน
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{ins.contact_channels || 'ไม่มีข้อมูลติดต่อ'}</span>
                </div>
                {ins.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a
                      href={ins.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 truncate"
                    >
                      <span>{ins.website}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleOpenEdit(ins)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>แก้ไข</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(ins.id, ins.name)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 cursor-pointer"
                title="ลบหรือปิดการใช้งาน"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95"
          >
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? 'แก้ไขข้อมูลบริษัทประกันภัย' : 'เพิ่มบริษัทประกันภัยใหม่'}
            </h3>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">ชื่อบริษัทประกัน *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น สินมั่นคงประกันภัย"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">ช่องทางติดต่อ / Call Center</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="เช่น โทร 1596 หรือ 0-2xxx-xxxx"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">เว็บไซต์ทางการ</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.example.com"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {editingId && (
              <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>เปิดใช้งานบริษัทประกันนี้ในระบบค้นหา</span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                บันทึก
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
