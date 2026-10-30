import {
  MOCK_PLANS,
  MOCK_PLAN_VERSIONS,
  MOCK_INSURERS,
  MOCK_AUDIT_LOGS,
  MOCK_SOURCE_DOCUMENTS,
  MOCK_PRICE_OPTIONS,
  MOCK_ELIGIBILITY_RULES
} from './mockData';
import { Plan, PlanVersion } from '@/types/database';

export async function getAllPlans() {
  return MOCK_PLANS.map((plan) => {
    const insurer = MOCK_INSURERS.find((i) => i.id === plan.insurer_id);
    const versions = MOCK_PLAN_VERSIONS.filter((v) => v.plan_id === plan.id);
    const activeVersion = versions.find((v) => v.workflow_status === 'published') ?? versions[0];

    return {
      ...plan,
      insurerName: insurer?.name ?? 'ไม่ระบุ',
      versionsCount: versions.length,
      currentStatus: activeVersion?.workflow_status ?? 'draft',
      latestVersionNo: Math.max(...versions.map((v) => v.version_no), 1),
    };
  });
}

export async function getPlanById(planId: string) {
  const plan = MOCK_PLANS.find((p) => p.id === planId);
  if (!plan) return null;

  const insurer = MOCK_INSURERS.find((i) => i.id === plan.insurer_id);
  const versions = MOCK_PLAN_VERSIONS.filter((v) => v.plan_id === plan.id);

  return {
    ...plan,
    insurer,
    versions,
  };
}

export async function getPendingReviews() {
  const inReviewVersions = MOCK_PLAN_VERSIONS.filter((v) => v.workflow_status === 'in_review');

  return inReviewVersions.map((version) => {
    const plan = MOCK_PLANS.find((p) => p.id === version.plan_id);
    const insurer = MOCK_INSURERS.find((i) => i.id === plan?.insurer_id);
    const docs = MOCK_SOURCE_DOCUMENTS.filter((d) => d.plan_version_id === version.id);
    const rules = MOCK_ELIGIBILITY_RULES.filter((r) => r.plan_version_id === version.id);
    const ruleIds = rules.map((r) => r.id);
    const options = MOCK_PRICE_OPTIONS.filter((o) => ruleIds.includes(o.eligibility_rule_id));

    return {
      version,
      plan,
      insurer,
      documentsCount: docs.length,
      priceOptionsCount: options.length,
    };
  });
}

export async function submitForReview(versionId: string, reason: string, actorName = 'เจ้าหน้าที่กรอกข้อมูล') {
  const version = MOCK_PLAN_VERSIONS.find((v) => v.id === versionId);
  if (!version) throw new Error('ไม่พบเวอร์ชันที่ระบุ');

  version.workflow_status = 'in_review';
  version.updated_at = new Date().toISOString();

  MOCK_AUDIT_LOGS.unshift({
    id: `audit-${Date.now()}`,
    actor_name: actorName,
    action: 'submit_review',
    entity_type: 'plan_version',
    entity_id: versionId,
    before_data: { workflow_status: 'draft' },
    after_data: { workflow_status: 'in_review' },
    reason,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}

export async function publishPlanVersion(versionId: string, reason: string, actorName = 'ผู้ตรวจสอบ') {
  const version = MOCK_PLAN_VERSIONS.find((v) => v.id === versionId);
  if (!version) throw new Error('ไม่พบเวอร์ชันที่ระบุ');

  const beforeStatus = version.workflow_status;
  version.workflow_status = 'published';
  version.verified_at = new Date().toISOString();
  version.updated_at = new Date().toISOString();

  // Archive older published versions of this plan
  const otherVersions = MOCK_PLAN_VERSIONS.filter(
    (v) => v.plan_id === version.plan_id && v.id !== version.id && v.workflow_status === 'published'
  );
  for (const oldVer of otherVersions) {
    oldVer.workflow_status = 'archived';
  }

  MOCK_AUDIT_LOGS.unshift({
    id: `audit-${Date.now()}`,
    actor_name: actorName,
    action: 'publish',
    entity_type: 'plan_version',
    entity_id: versionId,
    before_data: { workflow_status: beforeStatus },
    after_data: { workflow_status: 'published' },
    reason,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}

export async function rejectPlanVersion(versionId: string, reason: string, actorName = 'ผู้ตรวจสอบ') {
  const version = MOCK_PLAN_VERSIONS.find((v) => v.id === versionId);
  if (!version) throw new Error('ไม่พบเวอร์ชันที่ระบุ');

  version.workflow_status = 'draft';
  version.updated_at = new Date().toISOString();

  MOCK_AUDIT_LOGS.unshift({
    id: `audit-${Date.now()}`,
    actor_name: actorName,
    action: 'reject',
    entity_type: 'plan_version',
    entity_id: versionId,
    before_data: { workflow_status: 'in_review' },
    after_data: { workflow_status: 'draft' },
    reason,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}
