<?php
declare(strict_types=1);

const SYSTEM_ACTOR = ['id' => null, 'name' => 'ระบบ'];
const AUDIT_PAGE_SIZE = 200;
const ABANDONED_UPLOAD_SECONDS = 7 * 86400;
const UPLOADED_FILE = '/^storage\/documents\/([a-zA-Z0-9._-]+)$/D';
const NO_DOCUMENT_MESSAGE = 'ไม่สามารถเผยแพร่ได้: ต้องแนบหรือระบุเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการ (Section 8.4)';

/**
 * Deletes uploaded files no source document points at any more. Runs after the commit, so a rollback
 * never loses a file. Paths outside storage/documents are never touched.
 */
function remove_unreferenced_files(array $storagePaths): void
{
    foreach (array_unique(array_filter($storagePaths)) as $path) {
        if (!preg_match(UPLOADED_FILE, $path, $m) || str_contains($m[1], '..')) continue;
        if (select('SELECT id FROM source_documents WHERE storage_path = ? LIMIT 1', [$path])) continue;
        $file = DOCUMENTS_DIR . '/' . $m[1];
        // A missing file is already the goal; anything else is logged, never failing the save.
        if (is_file($file) && !unlink($file)) error_log("Could not remove document file: $file");
    }
}

function add_audit_log(array $actor, array $entry): void
{
    insert_row('audit_logs', ['id' => uuid(), 'actor_id' => $actor['id'], 'actor_name' => $actor['name'], 'created_at' => now_iso()] + $entry);
}

/** Locks the plan so concurrent publishes and version numbering stay consistent. */
function lock_plan(string $planId): ?array
{
    return select('SELECT * FROM plans WHERE id = ? FOR UPDATE', [$planId])[0] ?? null;
}

function find_version(string $versionId): array
{
    return select('SELECT * FROM plan_versions WHERE id = ?', [$versionId])[0] ?? fail('ไม่พบรุ่นแพ็กเกจที่ระบุ');
}

/** Locks the version's plan, so concurrent workflow changes can't both pass the status check. */
function lock_version_in_status(string $versionId, string $allowed, string $message): array
{
    lock_plan(find_version($versionId)['plan_id']);
    $version = find_version($versionId);
    if ($version['workflow_status'] !== $allowed) fail($message);
    return $version;
}

/** Section 12.3: at most one published version per plan. */
function archive_other_published(string $planId, string $keepVersionId, string $now): void
{
    execute(
        "UPDATE plan_versions SET workflow_status = 'archived', updated_at = ? WHERE plan_id = ? AND id <> ? AND workflow_status = 'published'",
        [column_value('updated_at', $now), $planId, $keepVersionId]
    );
}

function default_coverage(string $code, string $insuranceType): array
{
    $isType1 = $insuranceType === 'ชั้น 1';
    $is2Plus = str_contains($insuranceType, '2+');
    $status = 'covered';
    $limitAmount = null;
    $limitBasis = null;

    switch ($code) {
        case 'flood': case 'theft_fire': case 'own_damage':
            $status = $isType1 || $is2Plus ? 'covered' : 'not_covered';
            if ($status === 'covered') $limitBasis = 'ตามทุนประกัน';
            break;
        case 'rollover_offroad': case 'windshield':
            $status = $isType1 ? 'covered' : 'not_covered';
            if ($status === 'covered') $limitBasis = 'ตามทุนประกัน';
            break;
        case 'theft_personal_prop':
            $status = $isType1 ? 'optional' : 'not_covered';
            if ($status === 'optional') [$limitAmount, $limitBasis] = [20000, 'ต่อครั้ง'];
            break;
        case 'tp_life_person': [$limitAmount, $limitBasis] = [1000000, 'ต่อคน']; break;
        case 'tp_life_event': [$limitAmount, $limitBasis] = [10000000, 'ต่อครั้ง']; break;
        case 'tp_property': [$limitAmount, $limitBasis] = [2500000, 'ต่อครั้ง']; break;
        case 'pa_driver_passenger': case 'medical_expenses': [$limitAmount, $limitBasis] = [200000, 'ต่อคน']; break;
        case 'bail_bond': [$limitAmount, $limitBasis] = [300000, 'ต่อครั้ง']; break;
        case 'roadside_assist': $status = $isType1 ? 'covered' : 'optional'; $limitBasis = '24 ชม.'; break;
        case 'towing': $status = $isType1 ? 'covered' : 'optional'; $limitBasis = 'ตามเงื่อนไขบริษัท'; break;
        case 'loss_of_use': $status = 'optional'; $limitBasis = 'ซื้อความคุ้มครองเสริม'; break;
        case 'accessories':
            $status = $isType1 || $is2Plus ? 'covered' : 'optional';
            [$limitAmount, $limitBasis] = [20000, 'ต่อครั้ง (ตามที่แจ้งไว้)'];
            break;
    }
    return compact('status', 'limitAmount', 'limitBasis');
}

function auto_option_label(string $repairType, mixed $sumMax, string $suffix): string
{
    $prefix = $repairType === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่';
    return "$prefix - " . ($sumMax ? 'ทุน ' . money($sumMax) . $suffix : 'ยังไม่ระบุทุน');
}

final class Store
{
    // 1. Reads
    public static function insurers(): array { return select('SELECT * FROM insurers ORDER BY created_at DESC, id'); }
    public static function plans(): array { return select('SELECT * FROM plans ORDER BY created_at DESC, id'); }
    public static function versions(): array { return select('SELECT * FROM plan_versions ORDER BY created_at DESC, id'); }
    public static function rules(): array { return select('SELECT * FROM eligibility_rules ORDER BY created_at, id'); }
    public static function priceOptions(): array { return select('SELECT * FROM price_options ORDER BY eligibility_rule_id, sort_order, id'); }
    public static function versionCoverages(): array { return select('SELECT * FROM version_coverages'); }
    public static function documents(): array { return select('SELECT * FROM source_documents ORDER BY created_at DESC, id'); }
    public static function vehicleModels(): array { return select('SELECT * FROM vehicle_models ORDER BY created_at, id'); }
    public static function coverageTypes(): array { return select('SELECT * FROM coverage_types ORDER BY sort_order, id'); }

    /** The newest entries only: the log grows forever, so the full table is never loaded. */
    public static function auditLogs(int $limit = AUDIT_PAGE_SIZE, int $offset = 0): array
    {
        return select("SELECT * FROM audit_logs ORDER BY created_at DESC, id LIMIT $limit OFFSET $offset");
    }

    public static function auditLogsFor(array $entityIds): array
    {
        if (!$entityIds) return [];
        return select('SELECT * FROM audit_logs WHERE entity_id IN (' . placeholders($entityIds) . ') ORDER BY created_at DESC, id', $entityIds);
    }

    /** True when the stored file belongs to a published version of a plan that isn't archived. */
    public static function isPublishedDocument(string $storagePath): bool
    {
        return (bool) select(
            "SELECT d.id FROM source_documents d
             JOIN plan_versions v ON v.id = d.plan_version_id
             JOIN plans p ON p.id = v.plan_id
             WHERE d.storage_path = ? AND v.workflow_status = 'published' AND p.is_archived = FALSE LIMIT 1",
            [$storagePath]
        );
    }

    /**
     * The upload writes its file before the form is saved, so a cancelled form leaves it behind.
     * shortcut: a form left open longer than 7 days and then saved points at a deleted file; widen
     * ABANDONED_UPLOAD_SECONDS if editors keep forms open that long.
     */
    public static function removeAbandonedUploads(): void
    {
        $old = [];
        foreach (glob(DOCUMENTS_DIR . '/*') ?: [] as $file) {
            if (is_file($file) && filemtime($file) < time() - ABANDONED_UPLOAD_SECONDS) $old[] = 'storage/documents/' . basename($file);
        }
        // remove_unreferenced_files checks each path again, so a save landing in between keeps its file.
        remove_unreferenced_files($old);
    }

    // 2. Insurers
    public static function saveInsurer(array $data, array $actor = SYSTEM_ACTOR): array
    {
        $now = now_iso();
        $name = trim($data['name']);
        $contact = blank($data['contact_channels'] ?? null);
        $website = blank($data['website'] ?? null);

        return with_transaction(function () use ($data, $actor, $now, $name, $contact, $website) {
            if (!empty($data['id'])) {
                $before = select('SELECT * FROM insurers WHERE id = ? FOR UPDATE', [$data['id']])[0] ?? fail('ไม่พบบริษัทประกันภัยที่ระบุ');
                $isActive = $data['is_active'] ?? $before['is_active'];
                $changes = ['name' => $name, 'contact_channels' => $contact, 'website' => $website, 'is_active' => $isActive, 'updated_at' => $now, 'updated_by' => $actor['id']];
                update_row('insurers', $before['id'], $changes);
                add_audit_log($actor, [
                    'action' => 'update', 'entity_type' => 'insurer', 'entity_id' => $before['id'],
                    'before_data' => ['name' => $before['name'], 'is_active' => $before['is_active']],
                    'after_data' => ['name' => $name, 'is_active' => $isActive],
                    'reason' => "แก้ไขข้อมูลบริษัทประกันภัย \"$name\"",
                ]);
                return $changes + $before;
            }

            $insurer = ['id' => uuid(), 'name' => $name, 'contact_channels' => $contact, 'website' => $website, 'is_active' => $data['is_active'] ?? true,
                'created_at' => $now, 'updated_at' => $now, 'created_by' => $actor['id'], 'updated_by' => $actor['id']];
            insert_row('insurers', $insurer);
            add_audit_log($actor, [
                'action' => 'create', 'entity_type' => 'insurer', 'entity_id' => $insurer['id'],
                'before_data' => null, 'after_data' => ['name' => $name], 'reason' => "เพิ่มบริษัทประกันภัย \"$name\"",
            ]);
            return $insurer;
        });
    }

    /** Section 8.1: never hard-delete an insurer referenced by plans; deactivate instead. */
    public static function deleteInsurer(string $id, array $actor = SYSTEM_ACTOR): array
    {
        return with_transaction(function () use ($id, $actor) {
            $target = select('SELECT * FROM insurers WHERE id = ? FOR UPDATE', [$id])[0] ?? null;
            if (!$target) return ['mode' => 'deleted'];

            if (select('SELECT id FROM plans WHERE insurer_id = ? LIMIT 1', [$id])) {
                update_row('insurers', $id, ['is_active' => false, 'updated_at' => now_iso(), 'updated_by' => $actor['id']]);
                add_audit_log($actor, [
                    'action' => 'archive', 'entity_type' => 'insurer', 'entity_id' => $id,
                    'before_data' => ['is_active' => true], 'after_data' => ['is_active' => false],
                    'reason' => "ปิดการใช้งานบริษัท \"{$target['name']}\" แทนการลบ เนื่องจากมีแพ็กเกจผูกอยู่",
                ]);
                return ['mode' => 'deactivated'];
            }

            execute('DELETE FROM insurers WHERE id = ?', [$id]);
            add_audit_log($actor, [
                'action' => 'delete', 'entity_type' => 'insurer', 'entity_id' => $id,
                'before_data' => ['name' => $target['name']], 'after_data' => null,
                'reason' => "ลบบริษัทประกันภัย \"{$target['name']}\" ที่ยังไม่มีแพ็กเกจผูกอยู่",
            ]);
            return ['mode' => 'deleted'];
        });
    }

    // 3. Workflow transitions (Section 12.2 & 12.3)
    public static function submitForReview(string $versionId, string $reason, array $actor = SYSTEM_ACTOR): void
    {
        with_transaction(function () use ($versionId, $reason, $actor) {
            $version = lock_version_in_status($versionId, 'draft', 'ส่งตรวจได้เฉพาะรุ่นที่เป็นฉบับร่างเท่านั้น');
            update_row('plan_versions', $versionId, ['workflow_status' => 'in_review', 'updated_at' => now_iso(), 'updated_by' => $actor['id']]);
            add_audit_log($actor, [
                'action' => 'submit_review', 'entity_type' => 'plan_version', 'entity_id' => $versionId,
                'before_data' => ['workflow_status' => $version['workflow_status']], 'after_data' => ['workflow_status' => 'in_review'], 'reason' => $reason,
            ]);
        });
    }

    public static function publishVersion(string $versionId, string $reason, array $actor = SYSTEM_ACTOR): void
    {
        with_transaction(function () use ($versionId, $reason, $actor) {
            $version = lock_version_in_status($versionId, 'in_review', 'เผยแพร่ได้เฉพาะรุ่นที่อยู่ระหว่างตรวจสอบเท่านั้น');
            if (!select('SELECT id FROM source_documents WHERE plan_version_id = ? LIMIT 1', [$versionId])) fail(NO_DOCUMENT_MESSAGE);

            $now = now_iso();
            update_row('plan_versions', $versionId, ['workflow_status' => 'published', 'verified_at' => $now, 'verified_by' => $actor['id'], 'updated_at' => $now, 'updated_by' => $actor['id']]);
            archive_other_published($version['plan_id'], $versionId, $now);
            add_audit_log($actor, [
                'action' => 'publish', 'entity_type' => 'plan_version', 'entity_id' => $versionId,
                'before_data' => ['workflow_status' => $version['workflow_status']],
                'after_data' => ['workflow_status' => 'published', 'verified_at' => $now], 'reason' => $reason, 'created_at' => $now,
            ]);
        });
    }

    public static function rejectVersion(string $versionId, string $reason, array $actor = SYSTEM_ACTOR): void
    {
        with_transaction(function () use ($versionId, $reason, $actor) {
            $version = lock_version_in_status($versionId, 'in_review', 'ตีกลับได้เฉพาะรุ่นที่อยู่ระหว่างตรวจสอบเท่านั้น');
            update_row('plan_versions', $versionId, ['workflow_status' => 'draft', 'updated_at' => now_iso(), 'updated_by' => $actor['id']]);
            add_audit_log($actor, [
                'action' => 'reject', 'entity_type' => 'plan_version', 'entity_id' => $versionId,
                'before_data' => ['workflow_status' => $version['workflow_status']], 'after_data' => ['workflow_status' => 'draft'], 'reason' => $reason,
            ]);
        });
    }

    // 4. Create or edit a plan. $unpublishedOnly is for users who can't publish: only drafts may be
    // edited, and a published plan keeps its name, insurer and type.
    public static function createOrUpdatePlan(array $p, array $actor = SYSTEM_ACTOR, bool $unpublishedOnly = false): array
    {
        $replacedFile = null;
        $saved = with_transaction(function () use ($p, $actor, $unpublishedOnly, &$replacedFile) {
            $now = now_iso();
            $today = bangkok_date(0);
            $nextYear = bangkok_date(365);
            $name = trim($p['name']);
            $targetStatus = ($p['workflowStatus'] ?? '') ?: 'published';
            $isEdit = !empty($p['planId']);
            $has = fn(string $key) => array_key_exists($key, $p);

            // 1. Plan
            if ($isEdit) {
                $existing = lock_plan($p['planId']) ?? fail('ไม่พบแพ็กเกจที่ระบุ');
                // These fields live on the plan, so changing them changes the published version too.
                $changesLive = $existing['name'] !== $name || $existing['insurer_id'] !== $p['insurerId'] || $existing['insurance_type'] !== $p['insuranceType'];
                if ($unpublishedOnly && $changesLive && select("SELECT id FROM plan_versions WHERE plan_id = ? AND workflow_status = 'published' LIMIT 1", [$existing['id']])) {
                    fail('ชื่อแพ็กเกจ บริษัทประกัน และชั้นประกันของแพ็กเกจที่เผยแพร่แล้ว เปลี่ยนได้เฉพาะผู้มีสิทธิ์เผยแพร่');
                }
                $changes = ['insurer_id' => $p['insurerId'], 'name' => $name, 'insurance_type' => $p['insuranceType'], 'updated_at' => $now, 'updated_by' => $actor['id']];
                update_row('plans', $existing['id'], $changes);
                $plan = $changes + $existing;
            } else {
                $plan = ['id' => uuid(), 'insurer_id' => $p['insurerId'], 'name' => $name, 'insurance_type' => $p['insuranceType'], 'is_archived' => false,
                    'created_at' => $now, 'updated_at' => $now, 'created_by' => $actor['id'], 'updated_by' => $actor['id']];
                insert_row('plans', $plan);
            }
            $planId = $plan['id'];

            // 2. Version
            if (!empty($p['versionId'])) {
                $existing = select('SELECT * FROM plan_versions WHERE id = ? AND plan_id = ?', [$p['versionId'], $planId])[0] ?? fail('ไม่พบรุ่นแพ็กเกจที่ระบุ');
                // Checked under the plan lock, so a publish landing mid-save can't be overwritten.
                // Drafts only: editing an in-review version would let a reviewer publish changes they never saw.
                if ($unpublishedOnly && $existing['workflow_status'] !== 'draft') {
                    fail('แก้ไขได้เฉพาะรุ่นฉบับร่าง รุ่นที่ส่งตรวจแล้วต้องให้ผู้ตรวจสอบตีกลับก่อน หรือสร้างรุ่นใหม่แทน');
                }
                $changes = [
                    'workflow_status' => $targetStatus,
                    'effective_from' => $has('effectiveFrom') ? $p['effectiveFrom'] : $existing['effective_from'],
                    'effective_to' => $has('effectiveTo') ? $p['effectiveTo'] : $existing['effective_to'],
                    'review_due_at' => $has('reviewDueAt') ? $p['reviewDueAt'] : $existing['review_due_at'],
                    'verified_at' => $targetStatus === 'published' ? ($existing['verified_at'] ?: $now) : $existing['verified_at'],
                    'verified_by' => $targetStatus === 'published' ? ($existing['verified_by'] ?: $actor['id']) : $existing['verified_by'],
                    'notes' => $has('notes') ? $p['notes'] : $existing['notes'],
                    'updated_at' => $now, 'updated_by' => $actor['id'],
                ];
                update_row('plan_versions', $existing['id'], $changes);
                $version = $changes + $existing;
            } else {
                $max = select('SELECT COALESCE(MAX(version_no), 0) AS maxVersionNo FROM plan_versions WHERE plan_id = ?', [$planId])[0]['maxVersionNo'];
                $version = [
                    'id' => uuid(), 'plan_id' => $planId, 'version_no' => $max + 1, 'workflow_status' => $targetStatus,
                    'effective_from' => $p['effectiveFrom'] ?? $today, 'effective_to' => $p['effectiveTo'] ?? $nextYear,
                    'verified_at' => $targetStatus === 'published' ? $now : null, 'verified_by' => $targetStatus === 'published' ? $actor['id'] : null,
                    'review_due_at' => $p['reviewDueAt'] ?? bangkok_date(335),
                    'notes' => ($p['notes'] ?? '') !== '' ? $p['notes'] : 'บันทึกข้อมูลแพ็กเกจใหม่',
                    'created_at' => $now, 'updated_at' => $now, 'created_by' => $actor['id'], 'updated_by' => $actor['id'],
                ];
                insert_row('plan_versions', $version);
            }
            $versionId = $version['id'];
            if ($targetStatus === 'published') archive_other_published($planId, $versionId, $now);

            // 3. Eligibility rule (a version keeps a single rule; extras would be unreachable from the form)
            $existingRules = select('SELECT * FROM eligibility_rules WHERE plan_version_id = ? ORDER BY created_at, id', [$versionId]);
            $existingRule = $existingRules[0] ?? null;
            $ruleId = $existingRule['id'] ?? uuid();
            $scope = ($p['scopeType'] ?? '') ?: 'all_models';
            $ruleFields = [
                'scope_type' => $scope,
                'vehicle_model_id' => $scope === 'specific_model' ? (($p['vehicleModelId'] ?? '') ?: null) : null,
                // null means "no limit"; only a missing value falls back to the default.
                'min_age' => $has('minCarAge') ? $p['minCarAge'] : 1,
                'max_age' => $has('maxCarAge') ? $p['maxCarAge'] : 10,
                'age_basis' => $has('ageBasis') ? $p['ageBasis'] : ($existingRule['age_basis'] ?? 'registration_year'),
                'usage_type' => ($p['usageType'] ?? '') ?: 'private',
                'registration_zone' => $has('registrationZone') ? ($p['registrationZone'] ?? 'all') : ($existingRule['registration_zone'] ?? 'all'),
                'inspection_required' => $p['inspectionRequired'] ?? false,
                'notes' => match ($scope) {
                    'specific_model' => 'เงื่อนไขเฉพาะรุ่นรถที่ระบุ',
                    'unknown' => 'ยังไม่ทราบขอบเขตรุ่นรถ ต้องตรวจสอบเอกสารเพิ่มเติม',
                    default => 'รถยนต์ทั่วไปตามเงื่อนไขอายุรถ',
                },
                'updated_at' => $now, 'updated_by' => $actor['id'],
            ];
            if ($existingRule) {
                update_row('eligibility_rules', $ruleId, $ruleFields);
                foreach (array_slice($existingRules, 1) as $extra) execute('DELETE FROM eligibility_rules WHERE id = ?', [$extra['id']]);
            } else {
                insert_row('eligibility_rules', ['id' => $ruleId, 'plan_version_id' => $versionId] + $ruleFields + ['created_at' => $now, 'created_by' => $actor['id']]);
            }

            // 4. Price options
            $from = $version['effective_from'] ?: $today;
            $to = $version['effective_to'] ?: $nextYear;
            $existingOptions = select('SELECT * FROM price_options WHERE eligibility_rule_id = ?', [$ruleId]);
            $existingIds = array_column($existingOptions, 'id');
            $deductibleText = fn($amount) => $amount ? 'มีค่าเสียหายส่วนแรก ฿' . money($amount) . ' กรณีเป็นฝ่ายผิด' : null;
            $inputs = [];
            if (!empty($p['priceOptions'])) {
                foreach ($p['priceOptions'] as $i => $po) {
                    $sumMax = $po['sumInsuredMax'] ?? null;
                    $sumMin = array_key_exists('sumInsuredMin', $po) ? $po['sumInsuredMin'] : $sumMax;
                    $premium = $po['premiumTotal'] ?? null;
                    $deductible = $po['deductibleAmount'] ?? 0;
                    $inputs[] = ['id' => $po['id'] ?? null, 'fields' => [
                        'label' => blank($po['label'] ?? null) ?? auto_option_label($po['repairType'], $sumMax, ' บาท'),
                        'sort_order' => $i,
                        'repair_type' => $po['repairType'],
                        'price_type' => ($po['priceType'] ?? '') ?: ($premium !== null ? 'fixed_for_conditions' : 'unknown'),
                        'premium_total' => $premium,
                        'sum_insured_min' => $sumMin,
                        'sum_insured_max' => $sumMax,
                        'deductible_amount' => $deductible,
                        'deductible_terms' => blank($po['deductibleTerms'] ?? null) ?? $deductibleText($deductible),
                        'driver_conditions' => blank($po['driverConditions'] ?? null) ?? 'ไม่จำกัดชื่อผู้ขับขี่',
                        'compulsory_included' => ($po['compulsoryIncluded'] ?? '') ?: 'excluded',
                        'valid_from' => $po['validFrom'] ?? $from,
                        'valid_to' => $po['validTo'] ?? $to,
                    ]];
                }
            } else {
                $inputs[] = ['id' => null, 'fields' => [
                    'label' => auto_option_label('garage', 500000, ''),
                    'sort_order' => 0, 'repair_type' => 'garage', 'price_type' => 'fixed_for_conditions', 'premium_total' => null,
                    'sum_insured_min' => 500000, 'sum_insured_max' => 500000, 'deductible_amount' => 0, 'deductible_terms' => null,
                    'driver_conditions' => 'ไม่จำกัดชื่อผู้ขับขี่', 'compulsory_included' => 'excluded', 'valid_from' => $from, 'valid_to' => $to,
                ]];
            }

            // Update tiers in place so their ids survive an edit (compare baskets and links point at them).
            // An id is only honoured when it already belongs to this rule, so a request can't pull in another plan's option.
            $kept = [];
            foreach ($inputs as ['id' => $id, 'fields' => $fields]) {
                if ($id !== null && in_array($id, $existingIds, true)) {
                    update_row('price_options', $id, $fields + ['updated_at' => $now, 'updated_by' => $actor['id']]);
                    $kept[] = $id;
                } else {
                    insert_row('price_options', ['id' => uuid(), 'eligibility_rule_id' => $ruleId] + $fields + ['created_at' => $now, 'updated_at' => $now, 'created_by' => $actor['id'], 'updated_by' => $actor['id']]);
                }
            }
            foreach (array_diff($existingIds, $kept) as $id) execute('DELETE FROM price_options WHERE id = ?', [$id]);

            // 5. Coverages (Section 9.4: a null limit basis stays null, never 'ตามทุนประกัน')
            $types = select('SELECT * FROM coverage_types ORDER BY sort_order, id');
            $previous = array_column(select('SELECT * FROM version_coverages WHERE plan_version_id = ?', [$versionId]), null, 'coverage_type_id');
            execute('DELETE FROM version_coverages WHERE plan_version_id = ?', [$versionId]);
            if (!empty($p['coverages'])) {
                $typeByCode = array_column($types, null, 'code');
                foreach ($p['coverages'] as $cov) {
                    $type = $typeByCode[$cov['code']] ?? null;
                    if (!$type) continue;
                    $prev = $previous[$type['id']] ?? null;
                    insert_row('version_coverages', [
                        'id' => $prev['id'] ?? uuid(), 'plan_version_id' => $versionId, 'coverage_type_id' => $type['id'], 'status' => $cov['status'],
                        'limit_amount' => $cov['limitAmount'] ?? null, 'limit_basis' => blank($cov['limitBasis'] ?? null),
                        'deductible_amount' => $prev['deductible_amount'] ?? 0, 'terms' => blank($cov['terms'] ?? null),
                        'exclusions' => array_key_exists('exclusions', $cov) ? blank($cov['exclusions']) : ($prev['exclusions'] ?? null),
                        'created_at' => ($prev['created_at'] ?? '') ?: $now, 'updated_at' => $now,
                    ]);
                }
            } else {
                foreach ($types as $type) {
                    $default = default_coverage($type['code'], $p['insuranceType']);
                    insert_row('version_coverages', [
                        'id' => uuid(), 'plan_version_id' => $versionId, 'coverage_type_id' => $type['id'], 'status' => $default['status'],
                        'limit_amount' => $default['limitAmount'], 'limit_basis' => $default['limitBasis'], 'deductible_amount' => 0,
                        'terms' => null, 'exclusions' => null, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
            }

            // 6. Source document (update this version's document rather than duplicating it)
            $title = blank($p['documentTitle'] ?? null);
            $path = $p['documentStoragePath'] ?? null;
            $link = blank($p['documentSourceUrl'] ?? null);
            if ($title !== null || $path || $link !== null) {
                $doc = select('SELECT * FROM source_documents WHERE plan_version_id = ? ORDER BY created_at DESC, id LIMIT 1', [$versionId])[0] ?? null;
                $effectiveTitle = $title ?? "{$plan['name']} (เอกสารอ้างอิง)";
                $placeholder = "documents/$planId/$versionId.pdf";
                if ($doc) {
                    if ($has('documentStoragePath') && $path !== $doc['storage_path']) $replacedFile = $doc['storage_path'];
                    update_row('source_documents', $doc['id'], [
                        'source_type' => ($p['sourceType'] ?? '') ?: ($doc['source_type'] ?: 'rate_sheet'),
                        'title' => $effectiveTitle,
                        'page_reference' => $has('documentRef') ? blank($p['documentRef']) : $doc['page_reference'],
                        'storage_path' => $has('documentStoragePath') ? ($path ?: $placeholder) : $doc['storage_path'],
                        'source_url' => $has('documentSourceUrl') ? $link : $doc['source_url'],
                        'file_size' => $has('documentFileSize') ? $p['documentFileSize'] : $doc['file_size'],
                        'mime_type' => $has('documentMimeType') ? $p['documentMimeType'] : $doc['mime_type'],
                    ]);
                } else {
                    insert_row('source_documents', [
                        'id' => uuid(), 'plan_version_id' => $versionId, 'source_type' => ($p['sourceType'] ?? '') ?: 'rate_sheet',
                        'storage_path' => $path ?: $placeholder, 'source_url' => $link, 'title' => $effectiveTitle,
                        'file_size' => $p['documentFileSize'] ?? null, 'mime_type' => $p['documentMimeType'] ?? null,
                        'page_reference' => blank($p['documentRef'] ?? null), 'received_at' => $today, 'created_at' => $now, 'created_by' => $actor['id'],
                    ]);
                }
            }

            // 7. Audit log
            add_audit_log($actor, [
                'action' => $isEdit ? 'update' : 'create', 'entity_type' => 'plan_version', 'entity_id' => $versionId,
                'before_data' => $isEdit ? ['plan_id' => $planId] : null,
                'after_data' => ['plan_name' => $plan['name'], 'version_no' => $version['version_no'], 'status' => $targetStatus],
                'reason' => $isEdit ? "บันทึกการแก้ไขข้อมูลแพ็กเกจ \"{$plan['name']}\" (รุ่นที่ {$version['version_no']})" : "สร้างแพ็กเกจใหม่ \"{$plan['name']}\" (สถานะ: $targetStatus)",
                'created_at' => $now,
            ]);
            return ['plan' => $plan, 'version' => $version];
        });
        remove_unreferenced_files([$replacedFile]);
        return $saved;
    }

    /** Section 8.1: published plans are archived; draft-only plans are deleted with all child records. */
    public static function deletePlan(string $planId, array $actor = SYSTEM_ACTOR): array
    {
        $files = [];
        $result = with_transaction(function () use ($planId, $actor, &$files) {
            $target = lock_plan($planId);
            if (!$target) return ['mode' => 'deleted'];

            if (select("SELECT id FROM plan_versions WHERE plan_id = ? AND workflow_status IN ('published', 'archived') LIMIT 1", [$planId])) {
                update_row('plans', $planId, ['is_archived' => true, 'updated_at' => now_iso(), 'updated_by' => $actor['id']]);
                add_audit_log($actor, [
                    'action' => 'archive', 'entity_type' => 'plan', 'entity_id' => $planId,
                    'before_data' => ['is_archived' => false], 'after_data' => ['is_archived' => true],
                    'reason' => "จัดเก็บแพ็กเกจ \"{$target['name']}\" เข้ากรุ (Archive) เพื่อรักษาประวัติรุ่นที่เคยเผยแพร่",
                ]);
                return ['mode' => 'archived'];
            }

            // Foreign keys cascade to versions, rules, options, coverages and documents.
            $files = array_column(select('SELECT d.storage_path FROM source_documents d JOIN plan_versions v ON v.id = d.plan_version_id WHERE v.plan_id = ?', [$planId]), 'storage_path');
            execute('DELETE FROM plans WHERE id = ?', [$planId]);
            add_audit_log($actor, [
                'action' => 'delete', 'entity_type' => 'plan', 'entity_id' => $planId,
                'before_data' => ['name' => $target['name']], 'after_data' => null,
                'reason' => "ลบแพ็กเกจร่าง \"{$target['name']}\" ที่ยังไม่เคยเผยแพร่",
            ]);
            return ['mode' => 'deleted'];
        });
        remove_unreferenced_files($files);
        return $result;
    }

    public static function restorePlan(string $planId, array $actor = SYSTEM_ACTOR): void
    {
        with_transaction(function () use ($planId, $actor) {
            $target = lock_plan($planId);
            if (!$target) return;
            update_row('plans', $planId, ['is_archived' => false, 'updated_at' => now_iso(), 'updated_by' => $actor['id']]);
            add_audit_log($actor, [
                'action' => 'restore', 'entity_type' => 'plan', 'entity_id' => $planId,
                'before_data' => ['is_archived' => true], 'after_data' => ['is_archived' => false],
                'reason' => "กู้คืนแพ็กเกจ \"{$target['name']}\" กลับมาใช้งาน",
            ]);
        });
    }
}
