import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCurrentSession } from '@/lib/auth/session';

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv; charset=utf-8',
};

const INLINE_SAFE_EXTS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนเปิดเอกสาร' }, { status: 401 });
  }

  const { filename } = await params;

  // Strict path traversal prevention
  if (
    !filename ||
    !/^[a-zA-Z0-9._-]+$/.test(filename) ||
    path.basename(filename) !== filename ||
    filename.includes('..')
  ) {
    return NextResponse.json({ error: 'ชื่อไฟล์ไม่ถูกต้อง' }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
  const filePath = path.join(process.cwd(), 'storage', 'documents', filename);

  try {
    const fileBuffer = await readFile(filePath);
    const forceDownload = request.nextUrl.searchParams.get('download') === '1';
    const disposition =
      forceDownload || !INLINE_SAFE_EXTS.has(ext) ? 'attachment' : 'inline';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.byteLength),
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'ไม่พบไฟล์เอกสารบนเซิร์ฟเวอร์' },
      { status: 404 }
    );
  }
}
