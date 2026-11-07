import { randomUUID } from 'node:crypto';
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { PoolConnection } from 'mysql2/promise';
import {
  AuditLog,
  CoverageStatus,
  CoverageType,
  CompulsoryInclusion,
  EligibilityRule,
  InsuranceType,
  Insurer,
  Json,
  Plan,
  PlanVersion,
  PriceOption,
  PriceType,
  RegistrationZone,
  RepairType,
  ScopeType,
  SourceDocument,
  SourceType,
  VehicleModel,
  VersionCoverage,
  WorkflowStatus,
} from '@/types/database';
import { execute, getPool, insertRow, selectRows, updateRow, withTransaction, type Db } from '@/lib/db/mysql';
import { getBangkokDateString } from '@/lib/date';
import { StoreError } from './errors';

export interface Actor {
  id: string | null;
  name: string;
}

const SYSTEM_ACTOR: Actor = { id: null, name: 'ระบบ' };

const UPLOADED_FILE = /^storage\/documents\/([a-zA-Z0-9._-]+)$/;

/**
 * Deletes uploaded files that no source document points at any more. Runs after the
 * transaction commits, so a rollback never loses a file. Paths outside storage/documents
 * (title-only placeholders, external links) are never touched, and a file another version
 * still uses (a new version keeps the same file) stays.
 */
async function removeUnreferencedFiles(storagePaths: (string | null | undefined)[]): Promise<void> {
  for (const storagePath of new Set(storagePaths)) {
    const match = storagePath ? UPLOADED_FILE.exec(storagePath) : null;
    if (!match || match[1].includes('..')) continue;
    const stillUsed = await selectRows(getPool(), 'SELECT id FROM source_documents WHERE storage_path = ? LIMIT 1', [
      storagePath,
    ]);
    if (stillUsed.length > 0) continue;
    try {
      await unlink(path.join(process.cwd(), 'storage', 'documents', match[1]));
    } catch (err) {
      // A missing file is already the goal; anything else is logged, never failing the save.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Could not remove document file:', err);
    }
  }
}
/** How long an uploaded file may sit unused before it counts as left behind by a cancelled form. */
const ABANDONED_UPLOAD_MS = 7 * 86_400_000;

export const AUDIT_PAGE_SIZE = 200;

export interface CreateOrUpdatePlanPayload {
  planId?: string;
  versionId?: string;
  insurerId: string;
  name: string;
  insuranceType: InsuranceType;
  workflowStatus?: WorkflowStatus;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reviewDueAt?: string | null;
  notes?: string;
  // Eligibility
  scopeType?: ScopeType;
  vehicleModelId?: string | null;
  minCarAge?: number | null;
  maxCarAge?: number | null;
  ageBasis?: 'registration_year' | 'manufacture_year' | null;
  usageType?: 'private' | 'commercial' | 'all' | null;
  registrationZone?: RegistrationZone | null;
  inspectionRequired?: boolean;
  // Price Options (supports multiple tiers for same plan)
  priceOptions?: {
    id?: string;
    label?: string;
    repairType: RepairType;
    priceType?: PriceType;
    premiumTotal?: number | null;
    sumInsuredMin?: number | null;
    sumInsuredMax?: number | null;
    deductibleAmount?: number;
    deductibleTerms?: string;
    driverConditions?: string;
    compulsoryIncluded?: CompulsoryInclusion;
    validFrom?: string | null;
    validTo?: string | null;
  }[];
  priceOptionLabel?: string;
  repairType?: RepairType;
  priceType?: PriceType;
  premiumTotal?: number | null;
  sumInsuredMin?: number | null;
  sumInsuredMax?: number | null;
  deductibleAmount?: number;
  deductibleTerms?: string;
  driverConditions?: string;
  compulsoryIncluded?: CompulsoryInclusion;
  // Coverages
  coverages?: {
    code: string;
    status: CoverageStatus;
    limitAmount?: number | null;
    limitBasis?: string;
    terms?: string;
    exclusions?: string;
  }[];
  // Document
  sourceType?: SourceType;
  documentTitle?: string;
  documentRef?: string;
  documentStoragePath?: string | null;
  documentSourceUrl?: string | null;
  documentFileSize?: number | null;
  documentMimeType?: string | null;
}

async function addAuditLog(
  db: Db,
  actor: Actor,
  entry: Pick<AuditLog, 'action' | 'entity_type' | 'entity_id' | 'reason'> & {
    before_data: Json | null;
    after_data: Json | null;
    created_at?: string;
  }
): Promise<void> {
  await insertRow(db, 'audit_logs', {
    id: randomUUID(),
    actor_id: actor.id,
    actor_name: actor.name,
    created_at: new Date().toISOString(),
    ...entry,
  });
}

/** Locks the plan so concurrent publishes and version numbering stay consistent. */
async function lockPlan(tx: PoolConnection, planId: string): Promise<Plan | undefined> {
  const [plan] = await selectRows<Plan>(tx, 'SELECT * FROM plans WHERE id = ? FOR UPDATE', [planId]);
  return plan;
}

async function findVersion(db: Db, versionId: string): Promise<PlanVersion> {
  const [version] = await selectRows<PlanVersion>(db, 'SELECT * FROM plan_versions WHERE id = ?', [versionId]);
  if (!version) throw new StoreError('ไม่พบรุ่นแพ็กเกจที่ระบุ');
  return version;
}

/** Locks the version's plan, so concurrent workflow changes can't both pass the status check. */
async function lockVersionInStatus(
  tx: PoolConnection,
  versionId: string,
  allowed: WorkflowStatus,
  message: string
): Promise<PlanVersion> {
  const { plan_id } = await findVersion(tx, versionId);
  await lockPlan(tx, plan_id);
  const version = await findVersion(tx, versionId);
  if (version.workflow_status !== allowed) throw new StoreError(message);
  return version;
}

/** Section 12.3: at most one published version per plan. */
async function archiveOtherPublishedVersions(
  tx: PoolConnection,
  planId: string,
  keepVersionId: string,
  now: string
): Promise<void> {
  await execute(
    tx,
    `UPDATE plan_versions SET workflow_status = 'archived', updated_at = ?
     WHERE plan_id = ? AND id <> ? AND workflow_status = 'published'`,
    [new Date(now), planId, keepVersionId]
  );
}

function defaultCoverage(code: string, insuranceType: InsuranceType) {
  const isType1 = insuranceType === 'ชั้น 1';
  let status: CoverageStatus = 'covered';
  let limitAmount: number | null = null;
  let limitBasis: string | null = null;

  if (code === 'flood' || code === 'theft_fire' || code === 'own_damage') {
    status = isType1 || insuranceType.includes('2+') ? 'covered' : 'not_covered';
    if (status === 'covered') limitBasis = 'ตามทุนประกัน';
  } else if (code === 'rollover_offroad') {
    status = isType1 ? 'covered' : 'not_covered';
    if (status === 'covered') limitBasis = 'ตามทุนประกัน';
  } else if (code === 'windshield') {
    status = isType1 ? 'covered' : 'not_covered';
    if (status === 'covered') limitBasis = 'ตามทุนประกัน';
  } else if (code === 'theft_personal_prop') {
    status = isType1 ? 'optional' : 'not_covered';
    if (status === 'optional') {
      limitAmount = 20000;
      limitBasis = 'ต่อครั้ง';
    }
  } else if (code === 'tp_life_person') {
    limitAmount = 1000000;
    limitBasis = 'ต่อคน';
  } else if (code === 'tp_life_event') {
    limitAmount = 10000000;
    limitBasis = 'ต่อครั้ง';
  } else if (code === 'tp_property') {
    limitAmount = 2500000;
    limitBasis = 'ต่อครั้ง';
  } else if (code === 'pa_driver_passenger' || code === 'medical_expenses') {
    limitAmount = 200000;
    limitBasis = 'ต่อคน';
  } else if (code === 'bail_bond') {
    limitAmount = 300000;
    limitBasis = 'ต่อครั้ง';
  } else if (code === 'roadside_assist') {
    status = isType1 ? 'covered' : 'optional';
    limitBasis = '24 ชม.';
  } else if (code === 'towing') {
    status = isType1 ? 'covered' : 'optional';
    limitBasis = 'ตามเงื่อนไขบริษัท';
  } else if (code === 'loss_of_use') {
    status = 'optional';
    limitBasis = 'ซื้อความคุ้มครองเสริม';
  } else if (code === 'accessories') {
    status = isType1 || insuranceType.includes('2+') ? 'covered' : 'optional';
    limitAmount = 20000;
    limitBasis = 'ต่อครั้ง (ตามที่แจ้งไว้)';
  }

  return { status, limitAmount, limitBasis };
}

export class InsuranceStore {
  // 1. Insurers
  static getInsurers(): Promise<Insurer[]> {
    return selectRows<Insurer>(getPool(), 'SELECT * FROM insurers ORDER BY created_at DESC, id');
  }

  static async saveInsurer(
    data: Partial<Insurer> & { name: string },
    actor: Actor = SYSTEM_ACTOR
  ): Promise<Insurer> {
    const now = new Date().toISOString();
    const name = data.name.trim();
    const contact_channels = data.contact_channels?.trim() || null;
    const website = data.website?.trim() || null;

    return withTransaction(async (tx) => {
      if (data.id) {
        const [before] = await selectRows<Insurer>(tx, 'SELECT * FROM insurers WHERE id = ? FOR UPDATE', [data.id]);
        if (!before) throw new StoreError('ไม่พบบริษัทประกันภัยที่ระบุ');

        const is_active = data.is_active ?? before.is_active;
        await updateRow(tx, 'insurers', before.id, {
          name,
          contact_channels,
          website,
          is_active,
          updated_at: now,
          updated_by: actor.id,
        });
        await addAuditLog(tx, actor, {
          action: 'update',
          entity_type: 'insurer',
          entity_id: before.id,
          before_data: { name: before.name, is_active: before.is_active },
          after_data: { name, is_active },
          reason: `แก้ไขข้อมูลบริษัทประกันภัย "${name}"`,
        });
        return { ...before, name, contact_channels, website, is_active, updated_at: now, updated_by: actor.id };
      }

      const insurer: Insurer = {
        id: randomUUID(),
        name,
        contact_channels,
        website,
        is_active: data.is_active ?? true,
        created_at: now,
        updated_at: now,
        created_by: actor.id,
        updated_by: actor.id,
      };
      await insertRow(tx, 'insurers', insurer);
      await addAuditLog(tx, actor, {
        action: 'create',
        entity_type: 'insurer',
        entity_id: insurer.id,
        before_data: null,
        after_data: { name },
        reason: `เพิ่มบริษัทประกันภัย "${name}"`,
      });
      return insurer;
    });
  }

  /**
   * Section 8.1: Never hard-delete an insurer referenced by existing plans; deactivate instead.
   */
  static deleteInsurer(id: string, actor: Actor = SYSTEM_ACTOR): Promise<{ mode: 'deactivated' | 'deleted' }> {
    return withTransaction(async (tx) => {
      const [target] = await selectRows<Insurer>(tx, 'SELECT * FROM insurers WHERE id = ? FOR UPDATE', [id]);
      if (!target) return { mode: 'deleted' as const };

      const linked = await selectRows(tx, 'SELECT id FROM plans WHERE insurer_id = ? LIMIT 1', [id]);
      if (linked.length > 0) {
        await updateRow(tx, 'insurers', id, {
          is_active: false,
          updated_at: new Date().toISOString(),
          updated_by: actor.id,
        });
        await addAuditLog(tx, actor, {
          action: 'archive',
          entity_type: 'insurer',
          entity_id: id,
          before_data: { is_active: true },
          after_data: { is_active: false },
          reason: `ปิดการใช้งานบริษัท "${target.name}" แทนการลบ เนื่องจากมีแพ็กเกจผูกอยู่`,
        });
        return { mode: 'deactivated' as const };
      }

      await execute(tx, 'DELETE FROM insurers WHERE id = ?', [id]);
      await addAuditLog(tx, actor, {
        action: 'delete',
        entity_type: 'insurer',
        entity_id: id,
        before_data: { name: target.name },
        after_data: null,
        reason: `ลบบริษัทประกันภัย "${target.name}" ที่ยังไม่มีแพ็กเกจผูกอยู่`,
      });
      return { mode: 'deleted' as const };
    });
  }

  // 2. Plans & Versions
  static getPlans(): Promise<Plan[]> {
    return selectRows<Plan>(getPool(), 'SELECT * FROM plans ORDER BY created_at DESC, id');
  }

  static getVersions(): Promise<PlanVersion[]> {
    return selectRows<PlanVersion>(getPool(), 'SELECT * FROM plan_versions ORDER BY created_at DESC, id');
  }

  static getEligibilityRules(): Promise<EligibilityRule[]> {
    return selectRows<EligibilityRule>(getPool(), 'SELECT * FROM eligibility_rules ORDER BY created_at, id');
  }

  static getPriceOptions(): Promise<PriceOption[]> {
    return selectRows<PriceOption>(
      getPool(),
      'SELECT * FROM price_options ORDER BY eligibility_rule_id, sort_order, id'
    );
  }

  static getVersionCoverages(): Promise<VersionCoverage[]> {
    return selectRows<VersionCoverage>(getPool(), 'SELECT * FROM version_coverages');
  }

  static getDocuments(): Promise<SourceDocument[]> {
    return selectRows<SourceDocument>(getPool(), 'SELECT * FROM source_documents ORDER BY created_at DESC, id');
  }

  /** True when the stored file belongs to a published version of a plan that isn't archived. */
  static async isPublishedDocument(storagePath: string): Promise<boolean> {
    const rows = await selectRows(
      getPool(),
      `SELECT d.id FROM source_documents d
       JOIN plan_versions v ON v.id = d.plan_version_id
       JOIN plans p ON p.id = v.plan_id
       WHERE d.storage_path = ? AND v.workflow_status = 'published' AND p.is_archived = FALSE
       LIMIT 1`,
      [storagePath]
    );
    return rows.length > 0;
  }

  /** The newest entries only: the log grows forever, so the full table is never loaded. */
  static getAuditLogs(limit = AUDIT_PAGE_SIZE, offset = 0): Promise<AuditLog[]> {
    return selectRows<AuditLog>(
      getPool(),
      'SELECT * FROM audit_logs ORDER BY created_at DESC, id LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }

  /**
   * The upload writes its file before the form is saved, so a cancelled or abandoned form leaves
   * the file behind. Deletes such files once they are older than `olderThan` and no source
   * document points at them.
   * shortcut: a form left open longer than 7 days and then saved points at a deleted file; widen
   * ABANDONED_UPLOAD_MS if editors keep forms open that long.
   */
  static async removeAbandonedUploads(olderThan = new Date(Date.now() - ABANDONED_UPLOAD_MS)): Promise<void> {
    const dir = path.join(process.cwd(), 'storage', 'documents');
    const names = await readdir(dir).catch(() => [] as string[]);
    const old: string[] = [];
    for (const name of names) {
      const info = await stat(path.join(dir, name)).catch(() => null);
      if (info?.isFile() && info.mtime < olderThan) old.push(`storage/documents/${name}`);
    }
    if (old.length === 0) return;
    const used = await selectRows<{ storage_path: string }>(
      getPool(),
      'SELECT DISTINCT storage_path FROM source_documents WHERE storage_path IN (?)',
      [old]
    );
    const usedPaths = new Set(used.map((r) => r.storage_path));
    // removeUnreferencedFiles checks each path again, so a save landing in between keeps its file.
    await removeUnreferencedFiles(old.filter((p) => !usedPaths.has(p)));
  }

  static getAuditLogsFor(entityIds: string[]): Promise<AuditLog[]> {
    if (entityIds.length === 0) return Promise.resolve([]);
    return selectRows<AuditLog>(
      getPool(),
      'SELECT * FROM audit_logs WHERE entity_id IN (?) ORDER BY created_at DESC, id',
      [entityIds]
    );
  }

  static getVehicleModels(): Promise<VehicleModel[]> {
    return selectRows<VehicleModel>(getPool(), 'SELECT * FROM vehicle_models ORDER BY created_at, id');
  }

  static getCoverageTypes(): Promise<CoverageType[]> {
    return selectRows<CoverageType>(getPool(), 'SELECT * FROM coverage_types ORDER BY sort_order, id');
  }

  // Workflow Status Transitions with Full Persistence & Audit Logging (Section 12.2 & 12.3)
  static async submitForReview(versionId: string, reason: string, actor: Actor = SYSTEM_ACTOR): Promise<void> {
    await withTransaction(async (tx) => {
      const version = await lockVersionInStatus(tx, versionId, 'draft', 'ส่งตรวจได้เฉพาะรุ่นที่เป็นฉบับร่างเท่านั้น');
      await updateRow(tx, 'plan_versions', versionId, {
        workflow_status: 'in_review',
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      });
      await addAuditLog(tx, actor, {
        action: 'submit_review',
        entity_type: 'plan_version',
        entity_id: versionId,
        before_data: { workflow_status: version.workflow_status },
        after_data: { workflow_status: 'in_review' },
        reason,
      });
    });
  }

  static async publishPlanVersion(versionId: string, reason: string, actor: Actor = SYSTEM_ACTOR): Promise<void> {
    await withTransaction(async (tx) => {
      const version = await lockVersionInStatus(tx, versionId, 'in_review', 'เผยแพร่ได้เฉพาะรุ่นที่อยู่ระหว่างตรวจสอบเท่านั้น');

      const docs = await selectRows(tx, 'SELECT id FROM source_documents WHERE plan_version_id = ? LIMIT 1', [versionId]);
      if (docs.length === 0) {
        throw new StoreError('ไม่สามารถเผยแพร่ได้: ต้องแนบหรือระบุเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการ (Section 8.4)');
      }

      const now = new Date().toISOString();
      await updateRow(tx, 'plan_versions', versionId, {
        workflow_status: 'published',
        verified_at: now,
        verified_by: actor.id,
        updated_at: now,
        updated_by: actor.id,
      });
      await archiveOtherPublishedVersions(tx, version.plan_id, versionId, now);
      await addAuditLog(tx, actor, {
        action: 'publish',
        entity_type: 'plan_version',
        entity_id: versionId,
        before_data: { workflow_status: version.workflow_status },
        after_data: { workflow_status: 'published', verified_at: now },
        reason,
        created_at: now,
      });
    });
  }

  static async rejectPlanVersion(versionId: string, reason: string, actor: Actor = SYSTEM_ACTOR): Promise<void> {
    await withTransaction(async (tx) => {
      const version = await lockVersionInStatus(tx, versionId, 'in_review', 'ตีกลับได้เฉพาะรุ่นที่อยู่ระหว่างตรวจสอบเท่านั้น');
      await updateRow(tx, 'plan_versions', versionId, {
        workflow_status: 'draft',
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      });
      await addAuditLog(tx, actor, {
        action: 'reject',
        entity_type: 'plan_version',
        entity_id: versionId,
        before_data: { workflow_status: version.workflow_status },
        after_data: { workflow_status: 'draft' },
        reason,
      });
    });
  }

  // Comprehensive Create or Edit Plan
  static async createOrUpdatePlan(
    payload: CreateOrUpdatePlanPayload,
    actor: Actor = SYSTEM_ACTOR,
    // For users who can't publish: only drafts may be edited, and a published plan keeps its name, insurer and type.
    { unpublishedOnly = false }: { unpublishedOnly?: boolean } = {}
  ): Promise<{ plan: Plan; version: PlanVersion }> {
    let replacedFile: string | null = null;
    const saved = await withTransaction(async (tx) => {
      const now = new Date().toISOString();
      const todayStr = getBangkokDateString(0);
      const nextYearStr = getBangkokDateString(365);
      const name = payload.name.trim();
      const targetStatus: WorkflowStatus = payload.workflowStatus || 'published';
      const isEdit = Boolean(payload.planId);

      // 1. Update or Create Plan
      let plan: Plan;
      if (payload.planId) {
        const existing = await lockPlan(tx, payload.planId);
        if (!existing) throw new StoreError('ไม่พบแพ็กเกจที่ระบุ');
        // These fields live on the plan, so changing them changes the published version too.
        const changesLiveFields =
          existing.name !== name ||
          existing.insurer_id !== payload.insurerId ||
          existing.insurance_type !== payload.insuranceType;
        if (unpublishedOnly && changesLiveFields) {
          const live = await selectRows(
            tx,
            `SELECT id FROM plan_versions WHERE plan_id = ? AND workflow_status = 'published' LIMIT 1`,
            [existing.id]
          );
          if (live.length > 0) {
            throw new StoreError('ชื่อแพ็กเกจ บริษัทประกัน และชั้นประกันของแพ็กเกจที่เผยแพร่แล้ว เปลี่ยนได้เฉพาะผู้มีสิทธิ์เผยแพร่');
          }
        }
        const changes = {
          insurer_id: payload.insurerId,
          name,
          insurance_type: payload.insuranceType,
          updated_at: now,
          updated_by: actor.id,
        };
        await updateRow(tx, 'plans', existing.id, changes);
        plan = { ...existing, ...changes };
      } else {
        plan = {
          id: randomUUID(),
          insurer_id: payload.insurerId,
          name,
          insurance_type: payload.insuranceType,
          is_archived: false,
          created_at: now,
          updated_at: now,
          created_by: actor.id,
          updated_by: actor.id,
        };
        await insertRow(tx, 'plans', plan);
      }
      const planId = plan.id;

      // 2. Update or Create Version
      let version: PlanVersion;
      if (payload.versionId) {
        const [existing] = await selectRows<PlanVersion>(
          tx,
          'SELECT * FROM plan_versions WHERE id = ? AND plan_id = ?',
          [payload.versionId, planId]
        );
        if (!existing) throw new StoreError('ไม่พบรุ่นแพ็กเกจที่ระบุ');
        // Checked here, under the plan lock, so a publish that lands mid-save can't be overwritten.
        // Drafts only: editing an in-review version would let a reviewer publish changes they never saw.
        if (unpublishedOnly && existing.workflow_status !== 'draft') {
          throw new StoreError('แก้ไขได้เฉพาะรุ่นฉบับร่าง รุ่นที่ส่งตรวจแล้วต้องให้ผู้ตรวจสอบตีกลับก่อน หรือสร้างรุ่นใหม่แทน');
        }
        const changes = {
          workflow_status: targetStatus,
          effective_from: payload.effectiveFrom !== undefined ? payload.effectiveFrom : existing.effective_from,
          effective_to: payload.effectiveTo !== undefined ? payload.effectiveTo : existing.effective_to,
          review_due_at: payload.reviewDueAt !== undefined ? payload.reviewDueAt : existing.review_due_at,
          verified_at: targetStatus === 'published' ? existing.verified_at || now : existing.verified_at,
          verified_by: targetStatus === 'published' ? existing.verified_by || actor.id : existing.verified_by,
          notes: payload.notes !== undefined ? payload.notes : existing.notes,
          updated_at: now,
          updated_by: actor.id,
        };
        await updateRow(tx, 'plan_versions', existing.id, changes);
        version = { ...existing, ...changes };
      } else {
        const [{ maxVersionNo }] = await selectRows<{ maxVersionNo: number }>(
          tx,
          'SELECT COALESCE(MAX(version_no), 0) AS maxVersionNo FROM plan_versions WHERE plan_id = ?',
          [planId]
        );
        version = {
          id: randomUUID(),
          plan_id: planId,
          version_no: maxVersionNo + 1,
          workflow_status: targetStatus,
          effective_from: payload.effectiveFrom ?? todayStr,
          effective_to: payload.effectiveTo ?? nextYearStr,
          verified_at: targetStatus === 'published' ? now : null,
          verified_by: targetStatus === 'published' ? actor.id : null,
          review_due_at: payload.reviewDueAt ?? getBangkokDateString(335),
          notes: payload.notes || 'บันทึกข้อมูลแพ็กเกจใหม่',
          created_at: now,
          updated_at: now,
          created_by: actor.id,
          updated_by: actor.id,
        };
        await insertRow(tx, 'plan_versions', version);
      }
      const versionId = version.id;

      // Versioning rule: If this version is published, archive any other published versions of this plan
      if (targetStatus === 'published') {
        await archiveOtherPublishedVersions(tx, planId, versionId, now);
      }

      // 3. Eligibility Rule (a version keeps a single rule; extras would be unreachable from the form)
      const existingRules = await selectRows<EligibilityRule>(
        tx,
        'SELECT * FROM eligibility_rules WHERE plan_version_id = ? ORDER BY created_at, id',
        [versionId]
      );
      const existingRule = existingRules[0];
      const ruleId = existingRule?.id ?? randomUUID();
      const resolvedScope: ScopeType = payload.scopeType || 'all_models';
      const ruleFields = {
        scope_type: resolvedScope,
        vehicle_model_id: resolvedScope === 'specific_model' ? payload.vehicleModelId || null : null,
        // null means "no limit"; only a missing value falls back to the default.
        min_age: payload.minCarAge !== undefined ? payload.minCarAge : 1,
        max_age: payload.maxCarAge !== undefined ? payload.maxCarAge : 10,
        age_basis: payload.ageBasis !== undefined ? payload.ageBasis : existingRule?.age_basis ?? 'registration_year',
        usage_type: payload.usageType || 'private',
        registration_zone:
          payload.registrationZone !== undefined
            ? payload.registrationZone ?? 'all'
            : existingRule?.registration_zone ?? 'all',
        inspection_required: payload.inspectionRequired ?? false,
        notes:
          resolvedScope === 'specific_model'
            ? 'เงื่อนไขเฉพาะรุ่นรถที่ระบุ'
            : resolvedScope === 'unknown'
            ? 'ยังไม่ทราบขอบเขตรุ่นรถ ต้องตรวจสอบเอกสารเพิ่มเติม'
            : 'รถยนต์ทั่วไปตามเงื่อนไขอายุรถ',
        updated_at: now,
        updated_by: actor.id,
      };
      if (existingRule) {
        await updateRow(tx, 'eligibility_rules', ruleId, ruleFields);
        for (const extra of existingRules.slice(1)) {
          await execute(tx, 'DELETE FROM eligibility_rules WHERE id = ?', [extra.id]);
        }
      } else {
        await insertRow(tx, 'eligibility_rules', {
          id: ruleId,
          plan_version_id: versionId,
          ...ruleFields,
          created_at: now,
          created_by: actor.id,
        });
      }

      // 4. Price Options
      const effectiveFromDate = version.effective_from || todayStr;
      const effectiveToDate = version.effective_to || nextYearStr;
      const existingOptions = await selectRows<PriceOption>(
        tx,
        'SELECT * FROM price_options WHERE eligibility_rule_id = ?',
        [ruleId]
      );
      const existingOptionIds = new Set(existingOptions.map((o) => o.id));

      const optionInputs: { id?: string; fields: Omit<PriceOption, 'id' | 'eligibility_rule_id' | 'created_at' | 'updated_at'> }[] = [];

      if (payload.priceOptions && payload.priceOptions.length > 0) {
        payload.priceOptions.forEach((po, i) => {
          const sumMax = po.sumInsuredMax !== undefined ? po.sumInsuredMax : null;
          const sumMin = po.sumInsuredMin !== undefined ? po.sumInsuredMin : sumMax;
          optionInputs.push({
            id: po.id,
            fields: {
              label:
                po.label?.trim() ||
                `${po.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ${
                  sumMax ? `ทุน ${sumMax.toLocaleString()} บาท` : 'ยังไม่ระบุทุน'
                }`,
              sort_order: i,
              repair_type: po.repairType,
              price_type: po.priceType || (po.premiumTotal != null ? 'fixed_for_conditions' : 'unknown'),
              premium_total: po.premiumTotal ?? null,
              sum_insured_min: sumMin,
              sum_insured_max: sumMax,
              deductible_amount: po.deductibleAmount ?? 0,
              deductible_terms:
                po.deductibleTerms?.trim() ||
                (po.deductibleAmount ? `มีค่าเสียหายส่วนแรก ฿${po.deductibleAmount.toLocaleString()} กรณีเป็นฝ่ายผิด` : null),
              driver_conditions: po.driverConditions?.trim() || 'ไม่จำกัดชื่อผู้ขับขี่',
              compulsory_included: po.compulsoryIncluded || 'excluded',
              valid_from: po.validFrom ?? effectiveFromDate,
              valid_to: po.validTo ?? effectiveToDate,
            },
          });
        });
      } else {
        const sumMax = payload.sumInsuredMax !== undefined ? payload.sumInsuredMax : 500000;
        const sumMin = payload.sumInsuredMin !== undefined ? payload.sumInsuredMin : sumMax;
        optionInputs.push({
          fields: {
            label:
              payload.priceOptionLabel?.trim() ||
              `${payload.repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่'} - ${
                sumMax ? `ทุน ${sumMax.toLocaleString()}` : 'ยังไม่ระบุทุน'
              }`,
            sort_order: 0,
            repair_type: payload.repairType || 'garage',
            price_type: payload.priceType || 'fixed_for_conditions',
            premium_total: payload.premiumTotal ?? null,
            sum_insured_min: sumMin,
            sum_insured_max: sumMax,
            deductible_amount: payload.deductibleAmount ?? 0,
            deductible_terms:
              payload.deductibleTerms ||
              (payload.deductibleAmount ? `มีค่าเสียหายส่วนแรก ฿${payload.deductibleAmount.toLocaleString()} กรณีเป็นฝ่ายผิด` : null),
            driver_conditions: payload.driverConditions || 'ไม่จำกัดชื่อผู้ขับขี่',
            compulsory_included: payload.compulsoryIncluded || 'excluded',
            valid_from: effectiveFromDate,
            valid_to: effectiveToDate,
          },
        });
      }

      // Update tiers in place so their ids survive an edit (compare baskets and links point at them). An id is only honoured
      // when it already belongs to this rule, so a request can't pull in another plan's option.
      const keptOptionIds = new Set<string>();
      for (const { id, fields } of optionInputs) {
        if (id && existingOptionIds.has(id)) {
          await updateRow(tx, 'price_options', id, { ...fields, updated_at: now, updated_by: actor.id });
          keptOptionIds.add(id);
        } else {
          await insertRow(tx, 'price_options', {
            id: randomUUID(),
            eligibility_rule_id: ruleId,
            ...fields,
            created_at: now,
            updated_at: now,
            created_by: actor.id,
            updated_by: actor.id,
          });
        }
      }
      for (const option of existingOptions) {
        if (!keptOptionIds.has(option.id)) {
          await execute(tx, 'DELETE FROM price_options WHERE id = ?', [option.id]);
        }
      }

      // 5. Version Coverages (Section 9.4: Null limit Basis must stay null, never default to 'ตามทุนประกัน')
      const coverageTypes = await selectRows<CoverageType>(tx, 'SELECT * FROM coverage_types ORDER BY sort_order, id');
      const prevCoverages = await selectRows<VersionCoverage>(
        tx,
        'SELECT * FROM version_coverages WHERE plan_version_id = ?',
        [versionId]
      );
      await execute(tx, 'DELETE FROM version_coverages WHERE plan_version_id = ?', [versionId]);

      if (payload.coverages && payload.coverages.length > 0) {
        for (const cov of payload.coverages) {
          const type = coverageTypes.find((t) => t.code === cov.code);
          if (!type) continue;
          const prevCov = prevCoverages.find((pc) => pc.coverage_type_id === type.id);
          await insertRow(tx, 'version_coverages', {
            id: prevCov?.id || randomUUID(),
            plan_version_id: versionId,
            coverage_type_id: type.id,
            status: cov.status,
            limit_amount: cov.limitAmount ?? null,
            limit_basis: cov.limitBasis?.trim() ? cov.limitBasis.trim() : null,
            deductible_amount: prevCov?.deductible_amount ?? 0,
            terms: cov.terms?.trim() ? cov.terms.trim() : null,
            exclusions:
              cov.exclusions !== undefined ? cov.exclusions.trim() || null : prevCov?.exclusions ?? null,
            created_at: prevCov?.created_at || now,
            updated_at: now,
          });
        }
      } else {
        for (const type of coverageTypes) {
          const { status, limitAmount, limitBasis } = defaultCoverage(type.code, payload.insuranceType);
          await insertRow(tx, 'version_coverages', {
            id: randomUUID(),
            plan_version_id: versionId,
            coverage_type_id: type.id,
            status,
            limit_amount: limitAmount,
            limit_basis: limitBasis,
            deductible_amount: 0,
            terms: null,
            exclusions: null,
            created_at: now,
            updated_at: now,
          });
        }
      }

      // 6. Source Document (Update existing document for this version rather than duplicating)
      const trimmedDocTitle = payload.documentTitle?.trim() || '';
      const hasDocPayload =
        trimmedDocTitle !== '' ||
        Boolean(payload.documentStoragePath) ||
        Boolean(payload.documentSourceUrl?.trim());

      if (hasDocPayload) {
        const [prevDoc] = await selectRows<SourceDocument>(
          tx,
          'SELECT * FROM source_documents WHERE plan_version_id = ? ORDER BY created_at DESC, id LIMIT 1',
          [versionId]
        );
        const effectiveTitle = trimmedDocTitle || `${plan.name} (เอกสารอ้างอิง)`;
        if (prevDoc) {
          if (payload.documentStoragePath !== undefined && payload.documentStoragePath !== prevDoc.storage_path) {
            replacedFile = prevDoc.storage_path;
          }
          await updateRow(tx, 'source_documents', prevDoc.id, {
            source_type: payload.sourceType || prevDoc.source_type || 'rate_sheet',
            title: effectiveTitle,
            page_reference:
              payload.documentRef !== undefined ? payload.documentRef.trim() || null : prevDoc.page_reference,
            storage_path:
              payload.documentStoragePath !== undefined
                ? payload.documentStoragePath || `documents/${planId}/${versionId}.pdf`
                : prevDoc.storage_path,
            source_url:
              payload.documentSourceUrl !== undefined
                ? payload.documentSourceUrl?.trim() || null
                : prevDoc.source_url,
            file_size: payload.documentFileSize !== undefined ? payload.documentFileSize : prevDoc.file_size,
            mime_type: payload.documentMimeType !== undefined ? payload.documentMimeType : prevDoc.mime_type,
          });
        } else {
          await insertRow(tx, 'source_documents', {
            id: randomUUID(),
            plan_version_id: versionId,
            source_type: payload.sourceType || 'rate_sheet',
            storage_path: payload.documentStoragePath || `documents/${planId}/${versionId}.pdf`,
            source_url: payload.documentSourceUrl?.trim() || null,
            title: effectiveTitle,
            file_size: payload.documentFileSize ?? null,
            mime_type: payload.documentMimeType ?? null,
            page_reference: payload.documentRef?.trim() || null,
            received_at: todayStr,
            created_at: now,
            created_by: actor.id,
          });
        }
      }

      // 7. Audit Log
      await addAuditLog(tx, actor, {
        action: isEdit ? 'update' : 'create',
        entity_type: 'plan_version',
        entity_id: versionId,
        before_data: isEdit ? { plan_id: planId } : null,
        after_data: { plan_name: plan.name, version_no: version.version_no, status: targetStatus },
        reason: isEdit
          ? `บันทึกการแก้ไขข้อมูลแพ็กเกจ "${plan.name}" (รุ่นที่ ${version.version_no})`
          : `สร้างแพ็กเกจใหม่ "${plan.name}" (สถานะ: ${targetStatus})`,
        created_at: now,
      });

      return { plan, version };
    });
    await removeUnreferencedFiles([replacedFile]);
    return saved;
  }

  /**
   * Section 8.1: Published plans must be archived rather than hard-deleted.
   * Unpublished draft-only plans can be deleted along with all child records.
   */
  static async deletePlan(planId: string, actor: Actor = SYSTEM_ACTOR): Promise<{ mode: 'archived' | 'deleted' }> {
    let deletedFiles: string[] = [];
    const result = await withTransaction(async (tx) => {
      const target = await lockPlan(tx, planId);
      if (!target) return { mode: 'deleted' as const };

      const history = await selectRows(
        tx,
        `SELECT id FROM plan_versions WHERE plan_id = ? AND workflow_status IN ('published', 'archived') LIMIT 1`,
        [planId]
      );

      if (history.length > 0) {
        await updateRow(tx, 'plans', planId, {
          is_archived: true,
          updated_at: new Date().toISOString(),
          updated_by: actor.id,
        });
        await addAuditLog(tx, actor, {
          action: 'archive',
          entity_type: 'plan',
          entity_id: planId,
          before_data: { is_archived: false },
          after_data: { is_archived: true },
          reason: `จัดเก็บแพ็กเกจ "${target.name}" เข้ากรุ (Archive) เพื่อรักษาประวัติรุ่นที่เคยเผยแพร่`,
        });
        return { mode: 'archived' as const };
      }

      // Draft-only plan: foreign keys cascade to versions, rules, options, coverages and documents
      const docs = await selectRows<{ storage_path: string | null }>(
        tx,
        `SELECT d.storage_path FROM source_documents d
         JOIN plan_versions v ON v.id = d.plan_version_id WHERE v.plan_id = ?`,
        [planId]
      );
      deletedFiles = docs.map((d) => d.storage_path).filter((p): p is string => Boolean(p));
      await execute(tx, 'DELETE FROM plans WHERE id = ?', [planId]);
      await addAuditLog(tx, actor, {
        action: 'delete',
        entity_type: 'plan',
        entity_id: planId,
        before_data: { name: target.name },
        after_data: null,
        reason: `ลบแพ็กเกจร่าง "${target.name}" ที่ยังไม่เคยเผยแพร่`,
      });
      return { mode: 'deleted' as const };
    });
    await removeUnreferencedFiles(deletedFiles);
    return result;
  }

  static async restorePlan(planId: string, actor: Actor = SYSTEM_ACTOR): Promise<void> {
    await withTransaction(async (tx) => {
      const target = await lockPlan(tx, planId);
      if (!target) return;

      await updateRow(tx, 'plans', planId, {
        is_archived: false,
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      });
      await addAuditLog(tx, actor, {
        action: 'restore',
        entity_type: 'plan',
        entity_id: planId,
        before_data: { is_archived: true },
        after_data: { is_archived: false },
        reason: `กู้คืนแพ็กเกจ "${target.name}" กลับมาใช้งาน`,
      });
    });
  }
}
