import { InsuranceStore } from '@/lib/store/insuranceStore';
import { Insurer, Plan, PlanVersion, WorkflowStatus } from '@/types/database';

export interface PlanListItem extends Plan {
  insurerName: string;
  versionsCount: number;
  currentStatus: WorkflowStatus;
  latestVersionNo: number;
  activeVersionId?: string;
}

export interface PlanDetailData extends Plan {
  insurer?: Insurer;
  versions: PlanVersion[];
}

export interface PendingReviewItem {
  version: PlanVersion;
  plan?: Plan;
  insurer?: Insurer;
  documentsCount: number;
  priceOptionsCount: number;
}

export async function getAllPlans(includeArchived = false): Promise<PlanListItem[]> {
  const allPlans = InsuranceStore.getPlans();
  const plans = includeArchived ? allPlans : allPlans.filter((p) => !p.is_archived);
  const insurers = InsuranceStore.getInsurers();
  const versions = InsuranceStore.getVersions();

  return plans.map((plan) => {
    const insurer = insurers.find((i) => i.id === plan.insurer_id);
    const planVersions = versions
      .filter((v) => v.plan_id === plan.id)
      .sort((a, b) => b.version_no - a.version_no);
    const publishedVersions = planVersions.filter((v) => v.workflow_status === 'published');
    const activeVersion = publishedVersions[0] ?? planVersions[0];

    return {
      ...plan,
      insurerName: insurer?.name ?? 'ไม่ระบุ',
      versionsCount: planVersions.length,
      currentStatus: activeVersion?.workflow_status ?? 'draft',
      latestVersionNo: activeVersion?.version_no ?? (planVersions[0]?.version_no ?? 1),
      activeVersionId: activeVersion?.id,
    };
  });
}

export async function getPlanById(planId: string): Promise<PlanDetailData | null> {
  const plans = InsuranceStore.getPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;

  const insurers = InsuranceStore.getInsurers();
  const insurer = insurers.find((i) => i.id === plan.insurer_id);
  const versions = InsuranceStore.getVersions()
    .filter((v) => v.plan_id === plan.id)
    .sort((a, b) => b.version_no - a.version_no);

  return {
    ...plan,
    insurer,
    versions,
  };
}

export async function getPendingReviews(): Promise<PendingReviewItem[]> {
  const versions = InsuranceStore.getVersions();
  const inReviewVersions = versions.filter((v) => v.workflow_status === 'in_review');
  const plans = InsuranceStore.getPlans();
  const insurers = InsuranceStore.getInsurers();
  const docs = InsuranceStore.getDocuments();
  const rules = InsuranceStore.getEligibilityRules();
  const options = InsuranceStore.getPriceOptions();

  return inReviewVersions
    .map((version) => {
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
    })
    .filter((item) => !item.plan?.is_archived);
}

export async function submitForReview(
  versionId: string,
  reason: string,
  actorName = 'เจ้าหน้าที่กรอกข้อมูล'
) {
  InsuranceStore.submitForReview(versionId, reason, actorName);
  return { success: true };
}

export async function publishPlanVersion(
  versionId: string,
  reason: string,
  actorName = 'ผู้ตรวจสอบ'
) {
  InsuranceStore.publishPlanVersion(versionId, reason, actorName);
  return { success: true };
}

export async function rejectPlanVersion(
  versionId: string,
  reason: string,
  actorName = 'ผู้ตรวจสอบ'
) {
  InsuranceStore.rejectPlanVersion(versionId, reason, actorName);
  return { success: true };
}
