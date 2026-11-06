'use server';

import { z } from 'zod';
import { getPool, selectRows } from '@/lib/db/mysql';
import { hasPermission } from '@/lib/permissions/roles';
import { getComparisonData } from '@/lib/queries/compare';
import { getCoverageTypes, getInsurers, getVehicleModels } from '@/lib/queries/insurers';
import { getAllPlans, getPendingReviews, getPlanBundle } from '@/lib/queries/plans';
import { buildSearchResultItems, searchInsuranceOptions } from '@/lib/queries/search';
import { StoreError } from '@/lib/store/errors';
import { InsuranceStore, type CreateOrUpdatePlanPayload } from '@/lib/store/insuranceStore';
import {
  IdSchema,
  ReasonSchema,
  SavePlanSchema,
  SaveInsurerSchema,
  SearchQuerySchema,
} from '@/lib/validation/schemas';
import type { AppRole, AppUser, Insurer } from '@/types/database';
import type { SearchFilters } from '@/types/insurance';
import { actorOf, guarded, parseInput } from './guard';

// Read-only lookups compare these in JavaScript, so an unknown id just finds nothing.
const LookupIdSchema = z.string().max(64);

// Reads
export async function searchOptionsAction(filters: SearchFilters) {
  return guarded('canSearch', () =>
    searchInsuranceOptions(parseInput(SearchQuerySchema, filters) as SearchFilters)
  );
}

export async function getSearchReferenceDataAction() {
  return guarded('canSearch', async () => {
    const [insurers, vehicleModels, coverageTypes, pool] = await Promise.all([
      getInsurers(true),
      getVehicleModels(),
      getCoverageTypes(),
      buildSearchResultItems(),
    ]);
    return { insurers, vehicleModels, coverageTypes, pool };
  });
}

export async function getComparisonAction(optionIds: string[]) {
  return guarded('canCompare', () =>
    getComparisonData(parseInput(z.array(LookupIdSchema).max(4), optionIds))
  );
}

export async function getPlanBundleAction(planId: string) {
  return guarded('canViewPublished', (session) => {
    const canSeeUnpublished =
      hasPermission(session.roles, 'canEditDraft') || hasPermission(session.roles, 'canReview');
    return getPlanBundle(parseInput(LookupIdSchema, planId), {
      publishedOnly: !canSeeUnpublished,
      includeAudit: hasPermission(session.roles, 'canViewAudit'),
    });
  });
}

export async function getInsurersAction() {
  return guarded('canSearch', () => getInsurers());
}

export async function getPlanFormReferenceAction() {
  return guarded('canEditDraft', async () => {
    const [insurers, vehicleModels] = await Promise.all([getInsurers(), getVehicleModels()]);
    return { insurers, vehicleModels };
  });
}

export async function getAllPlansAction(includeArchived: boolean) {
  return guarded(['canEditDraft', 'canReview'], () => getAllPlans(includeArchived === true));
}

export async function getPendingReviewsAction() {
  return guarded('canReview', () => getPendingReviews());
}

export async function getAuditLogsAction() {
  return guarded('canViewAudit', () => InsuranceStore.getAuditLogs());
}

export async function getUsersAction() {
  return guarded('canManageUsers', async () => {
    const rows = await selectRows<Omit<AppUser, 'roles'> & { roles: string | null }>(
      getPool(),
      `SELECT u.id, u.email, u.display_name, u.is_active, GROUP_CONCAT(r.role) AS roles
       FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
       GROUP BY u.id, u.email, u.display_name, u.is_active
       ORDER BY u.created_at, u.id`
    );
    return rows.map((row): AppUser => ({
      ...row,
      roles: (row.roles ? row.roles.split(',') : []) as AppRole[],
    }));
  });
}

// Plan workflow
export async function savePlanAction(rawPayload: CreateOrUpdatePlanPayload) {
  return guarded('canEditDraft', async (session) => {
    const payload = parseInput(SavePlanSchema, rawPayload);
    const canPublish = hasPermission(session.roles, 'canPublish');
    const workflowStatus = payload.workflowStatus ?? (canPublish ? 'published' : 'draft');
    const db = getPool();

    if (!canPublish && workflowStatus !== 'draft' && workflowStatus !== 'in_review') {
      throw new StoreError('คุณไม่มีสิทธิ์เผยแพร่แพ็กเกจ');
    }

    // Section 8.4: nothing is published without a source document.
    if (workflowStatus === 'published') {
      const hasDocumentInPayload = Boolean(
        payload.documentTitle?.trim() || payload.documentStoragePath || payload.documentSourceUrl
      );
      const existing = payload.versionId
        ? await selectRows(db, 'SELECT id FROM source_documents WHERE plan_version_id = ? LIMIT 1', [payload.versionId])
        : [];
      if (!hasDocumentInPayload && existing.length === 0) {
        throw new StoreError('ไม่สามารถเผยแพร่ได้: ต้องแนบหรือระบุเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการ (Section 8.4)');
      }
    }

    return InsuranceStore.createOrUpdatePlan({ ...payload, workflowStatus }, actorOf(session), {
      unpublishedOnly: !canPublish,
    });
  });
}

export async function deletePlanAction(planId: string) {
  return guarded('canEditDraft', (session) =>
    InsuranceStore.deletePlan(parseInput(IdSchema, planId), actorOf(session))
  );
}

export async function restorePlanAction(planId: string) {
  return guarded('canEditDraft', (session) =>
    InsuranceStore.restorePlan(parseInput(IdSchema, planId), actorOf(session))
  );
}

export async function submitForReviewAction(versionId: string, reason: string) {
  return guarded('canSubmitReview', async (session) => {
    await InsuranceStore.submitForReview(parseInput(IdSchema, versionId), parseInput(ReasonSchema, reason), actorOf(session));
  });
}

export async function publishVersionAction(versionId: string, reason: string) {
  return guarded('canPublish', async (session) => {
    await InsuranceStore.publishPlanVersion(parseInput(IdSchema, versionId), parseInput(ReasonSchema, reason), actorOf(session));
  });
}

export async function rejectVersionAction(versionId: string, reason: string) {
  return guarded('canReview', async (session) => {
    await InsuranceStore.rejectPlanVersion(parseInput(IdSchema, versionId), parseInput(ReasonSchema, reason), actorOf(session));
  });
}

// Insurers
export async function saveInsurerAction(data: Partial<Insurer> & { name: string }) {
  return guarded('canEditDraft', (session) =>
    InsuranceStore.saveInsurer(parseInput(SaveInsurerSchema, data), actorOf(session))
  );
}

export async function deleteInsurerAction(id: string) {
  return guarded('canEditDraft', (session) =>
    InsuranceStore.deleteInsurer(parseInput(IdSchema, id), actorOf(session))
  );
}
