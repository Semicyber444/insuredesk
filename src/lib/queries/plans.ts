import { Actor, InsuranceStore } from '@/lib/store/insuranceStore';
import {
  AuditLog,
  EligibilityRule,
  Insurer,
  Plan,
  PlanVersion,
  PriceOption,
  SourceDocument,
  VehicleModel,
  VersionCoverage,
  WorkflowStatus,
} from '@/types/database';
import { loadCoverageData } from './search';
import type { CoverageData } from './coverage';

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
  const [allPlans, insurers, versions] = await Promise.all([
    InsuranceStore.getPlans(),
    InsuranceStore.getInsurers(),
    InsuranceStore.getVersions(),
  ]);
  const plans = includeArchived ? allPlans : allPlans.filter((p) => !p.is_archived);

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
  const [plans, insurers, allVersions] = await Promise.all([
    InsuranceStore.getPlans(),
    InsuranceStore.getInsurers(),
    InsuranceStore.getVersions(),
  ]);
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;

  const insurer = insurers.find((i) => i.id === plan.insurer_id);
  const versions = allVersions
    .filter((v) => v.plan_id === plan.id)
    .sort((a, b) => b.version_no - a.version_no);

  return {
    ...plan,
    insurer,
    versions,
  };
}

/** Everything the plan page and the edit form need about one plan and its versions. */
export interface PlanBundle {
  plan: PlanDetailData;
  rules: EligibilityRule[];
  options: PriceOption[];
  documents: SourceDocument[];
  auditLogs: AuditLog[];
  vehicleModels: VehicleModel[];
  coverageData: CoverageData;
  versionCoverages: VersionCoverage[];
}

export async function getPlanBundle(
  planId: string,
  access: { publishedOnly: boolean; includeAudit: boolean }
): Promise<PlanBundle | null> {
  const plan = await getPlanById(planId);
  if (!plan) return null;

  // Sales viewers only ever see published data of non-archived plans.
  const versions = access.publishedOnly
    ? plan.is_archived
      ? []
      : plan.versions.filter((v) => v.workflow_status === 'published')
    : plan.versions;
  const versionIds = new Set(versions.map((v) => v.id));

  const [allRules, allOptions, allDocuments, allAudit, vehicleModels, coverageData] = await Promise.all([
    InsuranceStore.getEligibilityRules(),
    InsuranceStore.getPriceOptions(),
    InsuranceStore.getDocuments(),
    access.includeAudit ? InsuranceStore.getAuditLogs() : Promise.resolve<AuditLog[]>([]),
    InsuranceStore.getVehicleModels(),
    loadCoverageData(),
  ]);

  const rules = allRules.filter((r) => versionIds.has(r.plan_version_id));
  const ruleIds = new Set(rules.map((r) => r.id));
  const options = allOptions.filter((o) => ruleIds.has(o.eligibility_rule_id));
  const optionIds = new Set(options.map((o) => o.id));
  const versionCoverages = coverageData.versionCoverages.filter((c) => versionIds.has(c.plan_version_id));
  const allVersionIds = new Set(plan.versions.map((v) => v.id));

  return {
    plan: { ...plan, versions },
    rules,
    options,
    documents: allDocuments.filter((d) => versionIds.has(d.plan_version_id)),
    auditLogs: allAudit.filter((a) => allVersionIds.has(a.entity_id) || a.entity_id === plan.id),
    vehicleModels,
    versionCoverages,
    coverageData: {
      versionCoverages,
      overrides: coverageData.overrides.filter((o) => optionIds.has(o.price_option_id)),
      coverageTypes: coverageData.coverageTypes,
    },
  };
}

export async function getPendingReviews(): Promise<PendingReviewItem[]> {
  const [versions, plans, insurers, docs, rules, options] = await Promise.all([
    InsuranceStore.getVersions(),
    InsuranceStore.getPlans(),
    InsuranceStore.getInsurers(),
    InsuranceStore.getDocuments(),
    InsuranceStore.getEligibilityRules(),
    InsuranceStore.getPriceOptions(),
  ]);
  const inReviewVersions = versions.filter((v) => v.workflow_status === 'in_review');

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
  actor?: Actor
) {
  await InsuranceStore.submitForReview(versionId, reason, actor);
  return { success: true };
}

export async function publishPlanVersion(
  versionId: string,
  reason: string,
  actor?: Actor
) {
  await InsuranceStore.publishPlanVersion(versionId, reason, actor);
  return { success: true };
}

export async function rejectPlanVersion(
  versionId: string,
  reason: string,
  actor?: Actor
) {
  await InsuranceStore.rejectPlanVersion(versionId, reason, actor);
  return { success: true };
}
