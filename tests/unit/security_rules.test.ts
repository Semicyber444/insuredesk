import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { UserSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password.mjs';
import { getPool } from '@/lib/db/mysql';
import { InsuranceStore } from '@/lib/store/insuranceStore';
import type { AppRole } from '@/types/database';
import { resetDatabase } from '../support/resetDatabase';

const auth = vi.hoisted(() => ({
  session: null as unknown,
  started: [] as string[],
  demo: false,
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentSession: async () => auth.session,
  isDemoAuthEnabled: () => auth.demo,
  startSession: async (userId: string) => {
    auth.started.push(userId);
  },
  endSession: async () => {},
}));

import { demoLoginAction, loginAction } from '@/lib/actions/auth';
import {
  deletePlanAction,
  publishVersionAction,
  rejectVersionAction,
  saveInsurerAction,
  savePlanAction,
  submitForReviewAction,
} from '@/lib/actions/insurance';
import { GET } from '@/app/api/documents/[filename]/route';

const PUBLISHED_VERSION = '50000000-0000-0000-0000-000000000001';
const INSURER_ID = '20000000-0000-0000-0000-000000000001';
const planInput = { insurerId: INSURER_ID, name: 'แพ็กเกจทดสอบความปลอดภัย', insuranceType: 'ชั้น 1' as const };

function signInAs(...roles: AppRole[]) {
  const id = '00000000-0000-0000-0000-000000000001';
  const session: UserSession = {
    user: { id, email: 'test@insuredesk.team', name: 'ผู้ทดสอบ' },
    profile: { user_id: id, display_name: 'ผู้ทดสอบ', is_active: true, created_at: '', updated_at: '' },
    roles,
  };
  auth.session = session;
}

const statusOf = async (versionId: string) =>
  (await InsuranceStore.getVersions()).find((v) => v.id === versionId)?.workflow_status;

beforeEach(async () => {
  auth.session = null;
  auth.started = [];
  auth.demo = false;
  await resetDatabase();
});

afterAll(async () => {
  await getPool().end();
});

describe('Workflow status guards', () => {
  it('cannot pull a published version back through submit or reject', async () => {
    signInAs('admin');
    expect((await submitForReviewAction(PUBLISHED_VERSION, 'x')).ok).toBe(false);
    expect((await rejectVersionAction(PUBLISHED_VERSION, 'x')).ok).toBe(false);
    expect(await statusOf(PUBLISHED_VERSION)).toBe('published');
  });

  it('only publishes a version that is in review', async () => {
    signInAs('admin');
    const saved = await savePlanAction({ ...planInput, workflowStatus: 'draft', documentTitle: 'เอกสาร' });
    if (!saved.ok) throw new Error(saved.error);
    const versionId = saved.data.version.id;

    expect((await publishVersionAction(versionId, 'x')).ok).toBe(false);
    expect(await statusOf(versionId)).toBe('draft');

    expect((await submitForReviewAction(versionId, 'x')).ok).toBe(true);
    expect((await publishVersionAction(versionId, 'x')).ok).toBe(true);
    expect(await statusOf(versionId)).toBe('published');
  });

  it('refuses to publish through the form without a source document', async () => {
    signInAs('admin');
    const result = await savePlanAction({ ...planInput, workflowStatus: 'published' });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Section 8.4') });
  });
});

describe('Server-side input validation', () => {
  it('rejects a javascript: document link and insurer website', async () => {
    signInAs('admin');
    const plan = await savePlanAction({
      ...planInput,
      workflowStatus: 'draft',
      documentSourceUrl: 'javascript:alert(1)',
    });
    expect(plan.ok).toBe(false);
    expect((await saveInsurerAction({ name: 'x', website: 'javascript:alert(1)' })).ok).toBe(false);
  });

  it('rejects bad ranges and negative amounts', async () => {
    signInAs('admin');
    const cases = [
      { effectiveFrom: '2026-12-31', effectiveTo: '2026-01-01' },
      { minCarAge: 5, maxCarAge: 1 },
      { priceOptions: [{ repairType: 'garage' as const, premiumTotal: -1 }] },
      { scopeType: 'specific_model' as const },
    ];
    for (const extra of cases) {
      expect((await savePlanAction({ ...planInput, workflowStatus: 'draft', ...extra })).ok).toBe(false);
    }
  });

  it('treats object arguments as invalid rather than as SQL', async () => {
    signInAs('admin');
    const before = (await InsuranceStore.getPlans()).length;
    const injected = { id: 1 } as unknown as string;

    expect((await deletePlanAction(injected)).ok).toBe(false);
    await expect(InsuranceStore.deletePlan(injected)).resolves.toEqual({ mode: 'deleted' });
    expect((await InsuranceStore.getPlans()).length).toBe(before);
  });
});

describe('Document access', () => {
  const dir = path.join(process.cwd(), 'storage', 'documents');
  const open = (filename: string) =>
    GET(new NextRequest(`http://localhost/api/documents/${filename}`), {
      params: Promise.resolve({ filename }),
    });

  it('hides draft documents from viewers but not from editors', async () => {
    const draftFile = 'test-draft-doc.pdf';
    const publishedFile = 'test-published-doc.pdf';
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, draftFile), 'draft');
    await writeFile(path.join(dir, publishedFile), 'published');
    try {
      await InsuranceStore.createOrUpdatePlan({
        ...planInput,
        workflowStatus: 'draft',
        documentStoragePath: `storage/documents/${draftFile}`,
      });
      await InsuranceStore.createOrUpdatePlan({
        ...planInput,
        workflowStatus: 'published',
        documentStoragePath: `storage/documents/${publishedFile}`,
      });

      expect((await open(draftFile)).status).toBe(401);

      signInAs('viewer');
      expect((await open(draftFile)).status).toBe(404);
      expect((await open(publishedFile)).status).toBe(200);

      signInAs('editor');
      expect((await open(draftFile)).status).toBe(200);
    } finally {
      await rm(path.join(dir, draftFile), { force: true });
      await rm(path.join(dir, publishedFile), { force: true });
    }
  });
});

describe('Login', () => {
  const email = 'locked.user@example.com';
  const password = 'correct-password-1';

  async function createUser() {
    await getPool().query('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)', [
      '0b000000-0000-0000-0000-000000000001',
      email,
      await hashPassword(password),
      'ผู้ทดสอบ',
    ]);
  }

  it('locks after repeated failures, even for the right password', async () => {
    await createUser();
    for (let i = 0; i < 10; i++) {
      expect((await loginAction(email, 'wrong')).ok).toBe(false);
    }
    const locked = await loginAction(email, password);
    expect(locked).toEqual({ ok: false, error: expect.stringContaining('หลายครั้งเกินไป') });
    expect(auth.started).toEqual([]);
  });

  it('locks unknown emails the same way', async () => {
    for (let i = 0; i < 10; i++) await loginAction('nobody@example.com', 'wrong');
    expect(await loginAction('nobody@example.com', 'wrong')).toEqual({
      ok: false,
      error: expect.stringContaining('หลายครั้งเกินไป'),
    });
  });

  it('clears the count after a successful login', async () => {
    await createUser();
    for (let i = 0; i < 9; i++) await loginAction(email, 'wrong');
    expect((await loginAction(email, password)).ok).toBe(true);
    for (let i = 0; i < 9; i++) await loginAction(email, 'wrong');
    expect((await loginAction(email, password)).ok).toBe(true);
  });

  it('ignores failures older than the window', async () => {
    await createUser();
    for (let i = 0; i < 10; i++) await loginAction(email, 'wrong');
    await getPool().query('UPDATE login_attempts SET attempted_at = UTC_TIMESTAMP(3) - INTERVAL 16 MINUTE');
    expect((await loginAction(email, password)).ok).toBe(true);
  });

  it('rejects non-string credentials and unknown demo roles', async () => {
    auth.demo = true;
    expect((await loginAction({} as unknown as string, 'x')).ok).toBe(false);
    expect((await demoLoginAction('constructor' as AppRole)).ok).toBe(false);
    expect(auth.started).toEqual([]);
  });
});
