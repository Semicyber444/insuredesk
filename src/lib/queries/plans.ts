import { InsuranceStore } from '@/lib/store/insuranceStore';
import { Plan, PlanVersion } from '@/types/database';

export async function getAllPlans() {
  const plans = InsuranceStore.getPlans();
  const insurers = InsuranceStore.getInsurers();
  const versions = InsuranceStore.getVersions();

  return plans.map((plan) => {
    const insurer = insurers.find((i) => i.id === plan.insurer_id);
    const planVersions = versions.filter((v) => v.plan_id === plan.id);
    const activeVersion = planVersions.find((v) => v.workflow_status === 'published') ?? planVersions[0];

    return {
      ...plan,
      insurerName: insurer?.name ?? 'ไม่ระบุ',
      versionsCount: planVersions.length,
      currentStatus: activeVersion?.workflow_status ?? 'draft',
      latestVersionNo: Math.max(...planVersions.map((v) => v.version_no), 1),
    };
  });
}

export async function getPlanById(planId: string) {
  const plans = InsuranceStore.getPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;

  const insurers = InsuranceStore.getInsurers();
  const insurer = insurers.find((i) => i.id === plan.insurer_id);
  const versions = InsuranceStore.getVersions().filter((v) => v.plan_id === plan.id);

  return {
    ...plan,
    insurer,
    versions,
  };
}

export async function getPendingReviews() {
  const versions = InsuranceStore.getVersions();
  const inReviewVersions = versions.filter((v) => v.workflow_status === 'in_review');
  const plans = InsuranceStore.getPlans();
  const insurers = InsuranceStore.getInsurers();
  const docs = InsuranceStore.getDocuments();
  const rules = InsuranceStore.getEligibilityRules();
  const options = InsuranceStore.getPriceOptions();

  return inReviewVersions.map((version) => {
    const plan = plans.find((p) => p.id === version.plan_id);
    const insurer = insurers.find((i) => i.id === plan?.insurer_id);
    const versionDocs = docs.filter((d) => d.plan_version_id === version.id);
    const versionRules = rules.filter((r) => r.plan_version_id === version.id);
    const ruleIds = versionRules.map((r) => r.id);
    const versionOptions = options.filter((o) => ruleIds.includes(o.eligibility_rule_id));

    return {
      version,
      plan,
      insurer,
      documentsCount: versionDocs.length,
      priceOptionsCount: versionOptions.length,
    };
  });
}

export async function submitForReview(versionId: string, reason: string, actorName = 'เจ้าหน้าที่กรอกข้อมูล') {
  const versions = InsuranceStore.getVersions();
  const version = versions.find((v) => v.id === versionId);
  if (!version) throw new Error('ไม่พบเวอร์ชันที่ระบุ');

  version.workflow_status = 'in_review';
  version.updated_at = new Date().toISOString();

  // Save audit
  const auditLogs = InsuranceStore.getAuditLogs();
  auditLogs.unshift({
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
  const versions = InsuranceStore.getVersions();
  const version = versions.find((v) => v.id === versionId);
  if (!version) throw new Error('ไม่พบเวอร์ชันที่ระบุ');

  const beforeStatus = version.workflow_status;
  version.workflow_status = 'published';
  version.verified_at = new Date().toISOString();
  version.updated_at = new Date().toISOString();

  const auditLogs = InsuranceStore.getAuditLogs();
  auditLogs.unshift({
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
  const versions = InsuranceStore.getVersions();
  const version = versions.find((v) => v.id === versionId);
  if (!version) throw new Error('ไม่พบเวอร์ชันที่ระบุ');

  version.workflow_status = 'draft';
  version.updated_at = new Date().toISOString();

  const auditLogs = InsuranceStore.getAuditLogs();
  auditLogs.unshift({
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
