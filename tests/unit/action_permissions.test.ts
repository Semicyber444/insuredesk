import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSession } from '@/lib/auth/session';
import type { AppRole } from '@/types/database';
import { getPool, selectRows } from '@/lib/db/mysql';
import { resetDatabase } from '../support/resetDatabase';

const currentSession = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@/lib/auth/session', () => ({
  getCurrentSession: async () => currentSession.value,
}));

import {
  deletePlanAction,
  getAuditLogsAction,
  getPlanBundleAction,
  publishVersionAction,
  savePlanAction,
  searchOptionsAction,
  submitForReviewAction,
} from '@/lib/actions/insurance';

const PLAN_ID = '40000000-0000-0000-0000-000000000001';
const VERSION_ID = '50000000-0000-0000-0000-000000000001';
const INSURER_ID = '20000000-0000-0000-0000-000000000001';

function signInAs(...roles: AppRole[]) {
  const id = '00000000-0000-0000-0000-000000000002';
  const session: UserSession = {
    user: { id, email: 'test@insuredesk.team', name: 'ผู้ทดสอบ' },
    profile: { user_id: id, display_name: 'ผู้ทดสอบ', is_active: true, created_at: '', updated_at: '' },
    roles,
  };
  currentSession.value = session;
}

const draftPayload = {
  insurerId: INSURER_ID,
  name: 'แพ็กเกจทดสอบสิทธิ์',
  insuranceType: 'ชั้น 1' as const,
};

beforeEach(async () => {
  currentSession.value = null;
  await resetDatabase();
});

afterAll(async () => {
  await getPool().end();
});

describe('Server Action authorization (replaces Postgres RLS)', () => {
  it('rejects every action when there is no session', async () => {
    expect((await searchOptionsAction({})).ok).toBe(false);
    expect((await getPlanBundleAction(PLAN_ID)).ok).toBe(false);
    expect((await savePlanAction(draftPayload)).ok).toBe(false);
  });

  it('rejects writes and audit reads from a viewer', async () => {
    signInAs('viewer');
    expect((await searchOptionsAction({})).ok).toBe(true);
    expect((await savePlanAction(draftPayload)).ok).toBe(false);
    expect((await deletePlanAction(PLAN_ID)).ok).toBe(false);
    expect((await publishVersionAction(VERSION_ID, 'x')).ok).toBe(false);
    expect((await getAuditLogsAction()).ok).toBe(false);
  });

  it('stops an editor from publishing or changing a published version', async () => {
    signInAs('editor');
    expect((await savePlanAction({ ...draftPayload, workflowStatus: 'published' })).ok).toBe(false);
    expect((await publishVersionAction(VERSION_ID, 'x')).ok).toBe(false);
    expect(
      (await savePlanAction({ ...draftPayload, planId: PLAN_ID, versionId: VERSION_ID, workflowStatus: 'draft' })).ok
    ).toBe(false);
    expect((await savePlanAction({ ...draftPayload, workflowStatus: 'draft' })).ok).toBe(true);
  });

  it('stops an editor from renaming a published plan or editing a version under review', async () => {
    const [live] = await selectRows<{ name: string; insurer_id: string; insurance_type: 'ชั้น 1' }>(
      getPool(),
      'SELECT name, insurer_id, insurance_type FROM plans WHERE id = ?',
      [PLAN_ID]
    );
    const sameFields = { planId: PLAN_ID, insurerId: live.insurer_id, name: live.name, insuranceType: live.insurance_type };
    signInAs('editor');

    // A new version of a published plan must not rename the version that is live.
    expect((await savePlanAction({ ...sameFields, name: `${live.name} (แก้)`, workflowStatus: 'draft' })).ok).toBe(false);
    const [{ name }] = await selectRows<{ name: string }>(getPool(), 'SELECT name FROM plans WHERE id = ?', [PLAN_ID]);
    expect(name).toBe(live.name);

    const draft = await savePlanAction({ ...sameFields, workflowStatus: 'draft' });
    if (!draft.ok) throw new Error(draft.error);
    const versionId = draft.data.version.id;
    expect((await savePlanAction({ ...sameFields, versionId, workflowStatus: 'draft' })).ok).toBe(true);

    // Once submitted, the reviewer must see what gets published, so the editor can't change it.
    expect((await submitForReviewAction(versionId, 'x')).ok).toBe(true);
    expect((await savePlanAction({ ...sameFields, versionId, workflowStatus: 'in_review' })).ok).toBe(false);
  });

  it('hides drafts and audit history from a viewer but not from an admin', async () => {
    signInAs('admin');
    const saved = await savePlanAction({ ...draftPayload, workflowStatus: 'draft' });
    if (!saved.ok) throw new Error(saved.error);
    const planId = saved.data.plan.id;

    const asAdmin = await getPlanBundleAction(planId);
    expect(asAdmin.ok && asAdmin.data?.plan.versions.length).toBe(1);
    expect(asAdmin.ok && asAdmin.data?.auditLogs.length).toBeGreaterThan(0);

    signInAs('viewer');
    const asViewer = await getPlanBundleAction(planId);
    if (!asViewer.ok || !asViewer.data) throw new Error('expected a bundle');
    expect(asViewer.data.plan.versions).toEqual([]);
    expect(asViewer.data.rules).toEqual([]);
    expect(asViewer.data.options).toEqual([]);
    expect(asViewer.data.documents).toEqual([]);
    expect(asViewer.data.auditLogs).toEqual([]);
  });

  it('returns the domain message rather than throwing when publish is blocked', async () => {
    signInAs('admin');
    const saved = await savePlanAction({ ...draftPayload, workflowStatus: 'draft' });
    if (!saved.ok) throw new Error(saved.error);

    expect((await submitForReviewAction(saved.data.version.id, 'x')).ok).toBe(true);
    const result = await publishVersionAction(saved.data.version.id, 'x');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Section 8.4') });
  });
});
