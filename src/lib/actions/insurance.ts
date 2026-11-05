'use server';

import { getPool, selectRows } from '@/lib/db/mysql';
import { hasPermission } from '@/lib/permissions/roles';
import { getAuditLogs } from '@/lib/queries/audit';
import { getComparisonData } from '@/lib/queries/compare';
import { getCoverageTypes, getInsurers, getVehicleModels } from '@/lib/queries/insurers';
import {
  getAllPlans,
  getPendingReviews,
  getPlanBundle,
  publishPlanVersion,
  rejectPlanVersion,
  submitForReview,
} from '@/lib/queries/plans';
import { buildSearchResultItems, searchInsuranceOptions } from '@/lib/queries/search';
import { StoreError } from '@/lib/store/errors';
import { InsuranceStore, type CreateOrUpdatePlanPayload } from '@/lib/store/insuranceStore';
import type { AppRole, AppUser, Insurer } from '@/types/database';
import type { SearchFilters } from '@/types/insurance';
import { actorOf, guarded } from './guard';

// Reads
export async function searchOptionsAction(filters: SearchFilters) {
  return guarded('canSearch', () => searchInsuranceOptions(filters));
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
  return guarded('canCompare', () => getComparisonData(optionIds));
}

export async function getPlanBundleAction(planId: string) {
  return guarded('canViewPublished', (session) => {
    const canSeeUnpublished =
      hasPermission(session.roles, 'canEditDraft') || hasPermission(session.roles, 'canReview');
    return getPlanBundle(planId, {
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
  return guarded(['canEditDraft', 'canReview'], () => getAllPlans(includeArchived));
}

export async function getPendingReviewsAction() {
  return guarded('canReview', () => getPendingReviews());
}

export async function getAuditLogsAction() {
  return guarded('canViewAudit', () => getAuditLogs());
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
export async function savePlanAction(payload: CreateOrUpdatePlanPayload) {
  return guarded('canEditDraft', async (session) => {
    const canPublish = hasPermission(session.roles, 'canPublish');
    const workflowStatus = payload.workflowStatus ?? (canPublish ? 'published' : 'draft');

    if (!canPublish) {
      if (workflowStatus !== 'draft' && workflowStatus !== 'in_review') {
        throw new StoreError('คุณไม่มีสิทธิ์เผยแพร่แพ็กเกจ');
      }
      if (payload.versionId) {
        const [version] = await selectRows<{ workflow_status: string }>(
          getPool(),
          'SELECT workflow_status FROM plan_versions WHERE id = ?',
          [payload.versionId]
        );
        if (version && version.workflow_status !== 'draft' && version.workflow_status !== 'in_review') {
          throw new StoreError('แก้ไขได้เฉพาะรุ่นที่ยังไม่เผยแพร่ กรุณาสร้างรุ่นใหม่แทน');
        }
      }
    }

    return InsuranceStore.createOrUpdatePlan({ ...payload, workflowStatus }, actorOf(session));
  });
}

export async function deletePlanAction(planId: string) {
  return guarded('canEditDraft', (session) => InsuranceStore.deletePlan(planId, actorOf(session)));
}

export async function restorePlanAction(planId: string) {
  return guarded('canEditDraft', (session) => InsuranceStore.restorePlan(planId, actorOf(session)));
}

export async function submitForReviewAction(versionId: string, reason: string) {
  return guarded('canSubmitReview', async (session) => {
    await submitForReview(versionId, reason, actorOf(session));
  });
}

export async function publishVersionAction(versionId: string, reason: string) {
  return guarded('canPublish', async (session) => {
    await publishPlanVersion(versionId, reason, actorOf(session));
  });
}

export async function rejectVersionAction(versionId: string, reason: string) {
  return guarded('canReview', async (session) => {
    await rejectPlanVersion(versionId, reason, actorOf(session));
  });
}

// Insurers
export async function saveInsurerAction(data: Partial<Insurer> & { name: string }) {
  return guarded('canEditDraft', (session) => InsuranceStore.saveInsurer(data, actorOf(session)));
}

export async function deleteInsurerAction(id: string) {
  return guarded('canEditDraft', (session) => InsuranceStore.deleteInsurer(id, actorOf(session)));
}
