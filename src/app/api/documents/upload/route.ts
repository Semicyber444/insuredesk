import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getCurrentSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/permissions/roles';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
};

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (
      !session ||
      (!hasPermission(session.roles, 'canEditDraft') &&
        !hasPermission(session.roles, 'canReview'))
    ) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์อัปโหลดเอกสารอ้างอิง' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');

    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์เอกสารที่ต้องการอัปโหลด' },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'ขนาดไฟล์เกินกำหนด (สูงสุดไม่เกิน 15 MB)' },
        { status: 400 }
      );
    }

    const rawExt = path.extname(fileEntry.name).toLowerCase().replace(/^\./, '');
    const resolvedMime = ALLOWED_EXTENSIONS[rawExt];
    if (!resolvedMime) {
      return NextResponse.json(
        {
          error:
            'รองรับเฉพาะไฟล์ PDF, รูปภาพ (PNG, JPG, WEBP) หรือตาราง Excel/CSV เท่านั้น',
        },
        { status: 400 }
      );
    }

    const safeFilename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${rawExt}`;
    const storageDir = path.join(process.cwd(), 'storage', 'documents');
    await mkdir(storageDir, { recursive: true });

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const fullPath = path.join(storageDir, safeFilename);
    await writeFile(fullPath, buffer);

    return NextResponse.json({
      storagePath: `storage/documents/${safeFilename}`,
      sourceUrl: `/api/documents/${safeFilename}`,
      originalName: fileEntry.name,
      fileSize: fileEntry.size,
      mimeType: resolvedMime,
    });
  } catch (err: unknown) {
    console.error('Document upload error:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดระหว่างบันทึกไฟล์เอกสารบนเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}
