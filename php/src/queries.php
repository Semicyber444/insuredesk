<?php
declare(strict_types=1);

function group_by(array $rows, string $key): array
{
    $groups = [];
    foreach ($rows as $row) $groups[$row[$key]][] = $row;
    return $groups;
}

function load_coverage_data(): array
{
    return ['versionCoverages' => Store::versionCoverages(), 'coverageTypes' => Store::coverageTypes()];
}

/** Every coverage type for a version, 'unknown' where the version doesn't set it. */
function resolve_coverages(array $versionCoverages, array $coverageTypes): array
{
    $byType = array_column($versionCoverages, null, 'coverage_type_id');
    return array_map(function ($type) use ($byType) {
        $base = $byType[$type['id']] ?? null;
        return [
            'coverageTypeId' => $type['id'], 'code' => $type['code'], 'name' => $type['name'], 'category' => $type['category'],
            'status' => $base['status'] ?? 'unknown', 'limitAmount' => $base['limit_amount'] ?? null, 'limitBasis' => $base['limit_basis'] ?? null,
            'deductibleAmount' => $base['deductible_amount'] ?? null, 'terms' => $base['terms'] ?? null, 'exclusions' => $base['exclusions'] ?? null,
        ];
    }, $coverageTypes);
}

/** All price options of the latest published version of each live plan, as full result rows. */
function build_search_items(): array
{
    $rules = array_column(Store::rules(), null, 'id');
    $versions = Store::versions();
    $versionById = array_column($versions, null, 'id');
    $plans = array_column(Store::plans(), null, 'id');
    $insurers = array_column(Store::insurers(), null, 'id');
    $vehicles = array_column(Store::vehicleModels(), null, 'id');
    $documents = group_by(Store::documents(), 'plan_version_id');
    $coverageData = load_coverage_data();
    $coverageByVersion = group_by($coverageData['versionCoverages'], 'plan_version_id');

    // The latest published version of each plan (Section 12.3)
    $latest = [];
    foreach ($versions as $version) {
        if ($version['workflow_status'] !== 'published') continue;
        $current = $latest[$version['plan_id']] ?? null;
        if (!$current || $version['version_no'] > $current['version_no']) $latest[$version['plan_id']] = $version;
    }

    $results = [];
    foreach (Store::priceOptions() as $option) {
        $rule = $rules[$option['eligibility_rule_id']] ?? null;
        $version = $rule ? ($versionById[$rule['plan_version_id']] ?? null) : null;
        if (!$version || $version['workflow_status'] !== 'published') continue;
        $plan = $plans[$version['plan_id']] ?? null;
        if (!$plan || $plan['is_archived'] || ($latest[$plan['id']]['id'] ?? null) !== $version['id']) continue;
        $insurer = $insurers[$plan['insurer_id']] ?? null;
        if (!$insurer || !$insurer['is_active']) continue;
        $vehicle = $rule['vehicle_model_id'] ? ($vehicles[$rule['vehicle_model_id']] ?? null) : null;

        $results[] = [
            'id' => $option['id'], 'priceOptionLabel' => $option['label'], 'repairType' => $option['repair_type'], 'priceType' => $option['price_type'],
            'premiumTotal' => $option['premium_total'], 'netPremium' => $option['net_premium'], 'taxStamp' => $option['tax_stamp'],
            'compulsoryIncluded' => $option['compulsory_included'], 'sumInsuredMin' => $option['sum_insured_min'], 'sumInsuredMax' => $option['sum_insured_max'],
            'deductibleAmount' => $option['deductible_amount'], 'deductibleTerms' => $option['deductible_terms'], 'driverConditions' => $option['driver_conditions'],
            'priceValidFrom' => $option['valid_from'], 'priceValidTo' => $option['valid_to'],
            'planId' => $plan['id'], 'planName' => $plan['name'], 'insuranceType' => $plan['insurance_type'],
            'insurerId' => $insurer['id'], 'insurerName' => $insurer['name'], 'insurerWebsite' => $insurer['website'],
            'planVersionId' => $version['id'], 'versionNo' => $version['version_no'], 'workflowStatus' => $version['workflow_status'],
            'versionEffectiveFrom' => $version['effective_from'], 'versionEffectiveTo' => $version['effective_to'],
            'verifiedAt' => $version['verified_at'], 'reviewDueAt' => $version['review_due_at'],
            'eligibilityRuleId' => $rule['id'], 'scopeType' => $rule['scope_type'], 'vehicleModelId' => $rule['vehicle_model_id'],
            'vehicleBrand' => $vehicle['brand'] ?? null, 'vehicleModel' => $vehicle['model'] ?? null, 'vehicleVariant' => $vehicle['variant'] ?? null,
            'minCarAge' => $rule['min_age'], 'maxCarAge' => $rule['max_age'], 'ageBasis' => $rule['age_basis'], 'usageType' => $rule['usage_type'],
            'registrationZone' => $rule['registration_zone'] ?? 'all', 'inspectionRequired' => $rule['inspection_required'],
            'coverages' => resolve_coverages($coverageByVersion[$version['id']] ?? [], $coverageData['coverageTypes']),
            'documents' => $documents[$version['id']] ?? [],
        ];
    }
    return $results;
}

function matches_filters(array $item, array $f, string $today): bool
{
    // 1. Text search
    if (trim($f['query'] ?? '') !== '') {
        $q = mb_strtolower(trim($f['query']));
        $haystacks = [$item['insurerName'], $item['planName'], $item['priceOptionLabel'],
            implode(' ', array_filter([$item['vehicleBrand'], $item['vehicleModel'], $item['vehicleVariant'], format_zone_label($item['registrationZone'])]))];
        $found = false;
        foreach ($haystacks as $text) $found = $found || str_contains(mb_strtolower($text), $q);
        if (!$found) return false;
    }

    // 2-4. Multi-selects (OR within each)
    foreach (['insurerIds' => 'insurerId', 'insuranceTypes' => 'insuranceType', 'repairTypes' => 'repairType'] as $filter => $field) {
        if (!empty($f[$filter]) && !in_array($item[$field], $f[$filter], true)) return false;
    }

    // 5. Vehicle scope & car age (Section 10.2: scope_type 'unknown' must NOT match as all_models)
    foreach (['vehicleBrand' => 'vehicleBrand', 'vehicleModelId' => 'vehicleModelId'] as $filter => $field) {
        if (empty($f[$filter])) continue;
        if ($item['scopeType'] === 'unknown') return false;
        if ($item['scopeType'] === 'specific_model' && $item[$field] !== $f[$filter]) return false;
    }
    if (isset($f['carAge']) && ($f['carAge'] < ($item['minCarAge'] ?? 0) || $f['carAge'] > ($item['maxCarAge'] ?? 999))) return false;

    // 6. Usage & plate zone
    if (!empty($f['usageType']) && $f['usageType'] !== 'all' && $item['usageType'] && $item['usageType'] !== 'all' && $item['usageType'] !== $f['usageType']) return false;
    if (!empty($f['registrationPlate'])) {
        $zone = $item['registrationZone'] ?? 'all';
        $ok = match ($f['registrationPlate']) {
            'bangkok_only_strict' => $zone === 'bangkok_only',
            'bangkok' => $zone !== 'upcountry_only',
            'metro' => $zone !== 'bangkok_only' && $zone !== 'upcountry_only',
            'upcountry' => $zone !== 'bangkok_only' && $zone !== 'bangkok_metro',
            default => true,
        };
        if (!$ok) return false;
    }

    // 7. Premium (Section 10.2: unknown price excluded unless requested)
    if ($item['premiumTotal'] === null) {
        if (empty($f['includeUnknownPrice']) && (isset($f['minPremium']) || isset($f['maxPremium']))) return false;
    } else {
        if (isset($f['minPremium']) && $item['premiumTotal'] < $f['minPremium']) return false;
        if (isset($f['maxPremium']) && $item['premiumTotal'] > $f['maxPremium']) return false;
    }

    // 8. Sum insured (never treat null as 0)
    if (isset($f['minSumInsured']) || isset($f['maxSumInsured'])) {
        if ($item['sumInsuredMax'] === null && $item['sumInsuredMin'] === null) return false;
        $sumMax = $item['sumInsuredMax'] ?? $item['sumInsuredMin'];
        $sumMin = $item['sumInsuredMin'] ?? $item['sumInsuredMax'];
        if (isset($f['minSumInsured']) && $sumMax < $f['minSumInsured']) return false;
        if (isset($f['maxSumInsured']) && $sumMin > $f['maxSumInsured']) return false;
    }

    // 9. Required coverages (Section 10.2: all must be 'covered', not optional)
    if (!empty($f['requiredCoverageCodes'])) {
        $statuses = array_column($item['coverages'], 'status', 'code');
        foreach ($f['requiredCoverageCodes'] as $code) {
            if (($statuses[$code] ?? null) !== 'covered') return false;
        }
    }

    // 10. Active date window (Asia/Bangkok, Section 8.1 & 10.2)
    if ($item['priceValidTo'] && $item['priceValidTo'] < $today) return false;
    if ($item['versionEffectiveTo'] && $item['versionEffectiveTo'] < $today) return false;
    if ($item['priceValidFrom'] && $item['priceValidFrom'] > $today) return false;
    if ($item['versionEffectiveFrom'] && $item['versionEffectiveFrom'] > $today) return false;
    return true;
}

/** shortcut: moves a leading Thai vowel behind its consonant instead of full ICU collation; use ext-intl if names need finer ordering. */
function thai_sort_key(string $name): string
{
    return preg_replace('/(^|\s)([เแโใไ])(\S)/u', '$1$3$2', $name);
}

function search_options(array $filters, ?array $items = null): array
{
    $today = bangkok_date(0);
    $filtered = array_values(array_filter($items ?? build_search_items(), fn($item) => matches_filters($item, $filters, $today)));

    usort($filtered, fn($a, $b) => match ($filters['sortBy'] ?? null) {
        'premium_asc' => ($a['premiumTotal'] ?? 999999999) <=> ($b['premiumTotal'] ?? 999999999),
        'premium_desc' => ($b['premiumTotal'] ?? 0) <=> ($a['premiumTotal'] ?? 0),
        'sum_insured_desc' => ($b['sumInsuredMax'] ?? 0) <=> ($a['sumInsuredMax'] ?? 0),
        default => strcmp(thai_sort_key($a['insurerName']), thai_sort_key($b['insurerName'])),
    });

    $page = $filters['page'] ?? 1;
    $pageSize = $filters['pageSize'] ?? 20;
    $total = count($filtered);
    return ['items' => array_slice($filtered, ($page - 1) * $pageSize, $pageSize), 'totalCount' => $total, 'page' => $page,
        'totalPages' => (int) ceil($total / $pageSize) ?: 1, 'pageSize' => $pageSize];
}

function comparison_warnings(array $options): array
{
    if (count($options) < 2) return [];
    $warnings = [];
    $warn = function (string $type, string $title, string $message, string $severity) use (&$warnings) {
        $warnings[] = compact('type', 'title', 'message', 'severity');
    };
    $distinct = fn(array $values) => count(array_unique($values, SORT_REGULAR));
    $today = bangkok_date(0);
    $missingSum = 'มีทั้งตัวเลือกที่ระบุทุนประกันชัดเจนและตัวเลือกที่ยังไม่ระบุทุนประกัน กรุณาตรวจสอบตารางกรมธรรม์ก่อนตัดสินใจ';

    // 1. Sum insured (never map null to 0)
    $known = array_values(array_filter(array_map(fn($o) => $o['sumInsuredMax'] ?? $o['sumInsuredMin'], $options), fn($v) => $v !== null));
    $hasNullSum = count($known) < count($options);
    if (count($known) >= 2) {
        [$min, $max] = [min($known), max($known)];
        if ($min != $max) {
            $warn('sum_insured_diff', 'ทุนประกันภัยไม่เท่ากัน', 'ตัวเลือกที่เปรียบเทียบมีทุนประกันต่างกัน (ต่ำสุด ฿' . money($min) . ' ถึง สูงสุด ฿' . money($max) . ')'
                . ($hasNullSum ? ' และมีบางรายการที่ยังไม่ระบุทุนประกัน' : '') . ' กรุณาคำนึงถึงมูลค่ารถยนต์ขณะเปรียบเทียบเบี้ย', 'warning');
        } elseif ($hasNullSum) {
            $warn('sum_insured_diff', 'บางรายการยังไม่ระบุทุนประกันภัย', $missingSum, 'warning');
        }
    } elseif ($hasNullSum && count($known) === 1) {
        $warn('sum_insured_diff', 'บางรายการยังไม่ระบุทุนประกันภัย', $missingSum, 'warning');
    }

    // 2. Repair type
    if ($distinct(array_column($options, 'repairType')) > 1) {
        $warn('repair_type_diff', 'เงื่อนไขการซ่อมต่างกัน (ซ่อมห้าง / ซ่อมอู่)', 'มีทั้งตัวเลือกซ่อมห้างและซ่อมอู่ผสมกัน เบี้ยซ่อมห้างตามมาตรฐานจะสูงกว่าซ่อมอู่', 'warning');
    }
    // 3. Deductibles
    if ($distinct(array_column($options, 'deductibleAmount')) > 1) {
        $warn('deductible_diff', 'ค่าเสียหายส่วนแรก (Deductible) ไม่เท่ากัน', 'บางตัวเลือกมีเงื่อนไขให้ผู้เอาประกันร่วมจ่ายค่าเสียหายส่วนแรกเมื่อเกิดเหตุที่เป็นฝ่ายผิด ทำให้เบี้ยประกันถูกลง', 'caution');
    }
    // 4. Price type
    if ($distinct(array_column($options, 'priceType')) > 1) {
        $warn('price_type_diff', 'ชนิดของราคาไม่เหมือนกัน', 'ตัวเลือกบางรายการเป็นราคาเริ่มต้นหรือราคาประมาณการ ไม่ใช่ราคาตายตัว', 'info');
    }

    // 5. Driver / vehicle eligibility
    $drivers = array_map(fn($o) => trim(blank($o['driverConditions']) ?? 'ไม่จำกัดชื่อผู้ขับขี่'), $options);
    $scopes = array_map(fn($o) => "{$o['scopeType']}:{$o['vehicleModelId']}:{$o['minCarAge']}-{$o['maxCarAge']}:{$o['usageType']}", $options);
    $specificDriver = (bool) array_filter($options, fn($o) => str_contains((string) $o['driverConditions'], 'ระบุผู้ขับขี่'));
    if ($specificDriver || $distinct($drivers) > 1 || $distinct($scopes) > 1) {
        $warn('driver_diff',
            $specificDriver ? 'มีเงื่อนไขระบุผู้ขับขี่เฉพาะเจาะจง' : 'เงื่อนไขผู้ขับขี่หรือคุณสมบัติรถที่รับประกันต่างกัน',
            $specificDriver ? 'บางแพ็กเกจกำหนดอายุหรือชื่อผู้ขับขี่ หากผู้อื่นนำรถไปเกิดเหตุอาจมีเงื่อนไขค่าเสียหายส่วนแรกเพิ่ม'
                : 'ตัวเลือกที่นำมาเทียบมีเงื่อนไขอายุรถ รุ่นรถ หรือเงื่อนไขผู้ขับขี่แตกต่างกัน กรุณาตรวจสอบว่ารถลูกค้าเข้าเกณฑ์ทุกตัวเลือก',
            'warning');
    }

    // 5b. Plate zone
    $zones = array_values(array_unique(array_map(fn($o) => $o['registrationZone'] ?? 'all', $options)));
    if (count($zones) > 1 || $zones[0] !== 'all') {
        $description = implode(' / ', array_map('format_zone_label', $zones));
        $warn('registration_zone_diff', 'มีเงื่อนไขจำกัดเขตป้ายทะเบียนรถยนต์', "แพ็กเกจที่เปรียบเทียบมีเงื่อนไขป้ายทะเบียน: $description กรุณาตรวจสอบป้ายทะเบียนรถของลูกค้าก่อนเสนอขาย", 'warning');
    }

    // 6. Expired (Section 11)
    if (array_filter($options, fn($o) => ($o['priceValidTo'] && $o['priceValidTo'] < $today) || ($o['versionEffectiveTo'] && $o['versionEffectiveTo'] < $today))) {
        $warn('expired_price', 'พบตัวเลือกราคาที่หมดอายุการบังคับใช้', 'มีตัวเลือกที่พ้นกำหนดวันสิ้นสุดอัตราเบี้ยแล้ว กรุณาตรวจสอบอัตราเบี้ยรุ่นล่าสุดกับบริษัทประกันภัยก่อนเสนอราคาจริง', 'warning');
    }

    // 7. Unknown data (Section 9.3, 9.4, 9.5)
    $unknownPrice = (bool) array_filter($options, fn($o) => $o['premiumTotal'] === null);
    $unknownCoverage = (bool) array_filter($options, fn($o) => in_array('unknown', array_column($o['coverages'], 'status'), true));
    if ($unknownPrice || $hasNullSum || $unknownCoverage) {
        $warn('unknown_data', 'มีข้อมูลสำคัญที่ยังไม่ทราบครบถ้วน',
            $unknownPrice ? 'บางรายการไม่มีข้อมูลราคาที่แน่นอนในเอกสารต้นทาง ระบบแสดง "ยังไม่มีข้อมูลราคา" และไม่สามารถตัดสินความคุ้มค่าได้ทันที'
                : 'บางรายการยังไม่ระบุทุนประกันหรือมีหมวดความคุ้มครองที่ "ยังไม่ระบุ" ในเอกสารต้นทาง กรุณาตรวจสอบเอกสารแนบเพิ่มเติม',
            'caution');
    }
    return $warnings;
}

function coverage_compare_value(?array $cov): array
{
    if (!$cov) return ['status' => 'unknown', 'text' => 'ยังไม่ระบุ'];
    $text = match ($cov['status']) {
        'not_covered' => 'ไม่คุ้มครอง',
        // Section 9.4: never guess unlimited or sum insured when the limit is omitted
        'covered' => $cov['limitAmount'] ? '฿' . money($cov['limitAmount']) . ($cov['limitBasis'] ? " ({$cov['limitBasis']})" : '')
            : ($cov['limitBasis'] ?: 'คุ้มครอง (ยังไม่ระบุวงเงิน)'),
        'optional' => 'ซื้อเพิ่มได้' . ($cov['terms'] ? " ({$cov['terms']})" : ''),
        default => 'ยังไม่ระบุ',
    };
    return ['status' => $cov['status'], 'text' => $text];
}

function comparison_data(array $optionIds): array
{
    $all = array_column(build_search_items(), null, 'id');
    $selected = [];
    foreach ($optionIds as $id) {
        if (isset($all[$id]) && !isset($selected[$id])) $selected[$id] = $all[$id];
    }
    $selected = array_values($selected);

    $catalog = [];
    foreach ($selected as $option) {
        foreach ($option['coverages'] as $cov) $catalog[$cov['category']][$cov['code']] = $cov['name'];
    }

    $categories = [];
    foreach ($catalog as $category => $names) {
        $items = [];
        foreach ($names as $code => $name) {
            $values = [];
            foreach ($selected as $option) {
                $cov = array_column($option['coverages'], null, 'code')[$code] ?? null;
                $values[$option['id']] = coverage_compare_value($cov);
            }
            $items[] = ['code' => $code, 'name' => $name, 'values' => $values, 'hasDifference' => count(array_unique(array_column($values, 'text'))) > 1];
        }
        $categories[] = ['name' => $category, 'items' => $items];
    }
    return ['options' => $selected, 'warnings' => comparison_warnings($selected), 'categories' => $categories];
}

function all_plans(bool $includeArchived = false): array
{
    $insurers = array_column(Store::insurers(), null, 'id');
    $versions = group_by(Store::versions(), 'plan_id');
    $list = [];
    foreach (Store::plans() as $plan) {
        if ($plan['is_archived'] && !$includeArchived) continue;
        $planVersions = $versions[$plan['id']] ?? [];
        usort($planVersions, fn($a, $b) => $b['version_no'] <=> $a['version_no']);
        $published = array_values(array_filter($planVersions, fn($v) => $v['workflow_status'] === 'published'));
        $active = $published[0] ?? $planVersions[0] ?? null;
        $list[] = $plan + [
            'insurerName' => $insurers[$plan['insurer_id']]['name'] ?? 'ไม่ระบุ',
            'versionsCount' => count($planVersions),
            'currentStatus' => $active['workflow_status'] ?? 'draft',
            'latestVersionNo' => $active['version_no'] ?? 1,
            'activeVersionId' => $active['id'] ?? null,
        ];
    }
    return $list;
}

/** Everything the plan page and the edit form need about one plan and its versions. */
function plan_bundle(string $planId, bool $publishedOnly, bool $includeAudit): ?array
{
    $plan = select('SELECT * FROM plans WHERE id = ?', [$planId])[0] ?? null;
    if (!$plan) return null;
    $plan['insurer'] = select('SELECT * FROM insurers WHERE id = ?', [$plan['insurer_id']])[0] ?? null;
    $allVersions = select('SELECT * FROM plan_versions WHERE plan_id = ? ORDER BY version_no DESC', [$planId]);

    // Sales viewers only ever see published data of non-archived plans.
    $versions = !$publishedOnly ? $allVersions
        : ($plan['is_archived'] ? [] : array_values(array_filter($allVersions, fn($v) => $v['workflow_status'] === 'published')));
    $versionIds = array_column($versions, 'id');
    $plan['versions'] = $versions;

    $inVersions = fn(array $rows, string $key) => array_values(array_filter($rows, fn($r) => in_array($r[$key], $versionIds, true)));
    $rules = $inVersions(Store::rules(), 'plan_version_id');
    $ruleIds = array_column($rules, 'id');
    $coverageData = load_coverage_data();
    $versionCoverages = $inVersions($coverageData['versionCoverages'], 'plan_version_id');

    return [
        'plan' => $plan,
        'rules' => $rules,
        'options' => array_values(array_filter(Store::priceOptions(), fn($o) => in_array($o['eligibility_rule_id'], $ruleIds, true))),
        'documents' => $inVersions(Store::documents(), 'plan_version_id'),
        'auditLogs' => $includeAudit ? Store::auditLogsFor([$planId, ...array_column($allVersions, 'id')]) : [],
        'vehicleModels' => Store::vehicleModels(),
        'versionCoverages' => $versionCoverages,
        'coverageTypes' => $coverageData['coverageTypes'],
    ];
}

function pending_reviews(): array
{
    $plans = array_column(Store::plans(), null, 'id');
    $insurers = array_column(Store::insurers(), null, 'id');
    $documents = group_by(Store::documents(), 'plan_version_id');
    $options = group_by(Store::priceOptions(), 'eligibility_rule_id');
    $rules = group_by(Store::rules(), 'plan_version_id');
    $list = [];
    foreach (Store::versions() as $version) {
        if ($version['workflow_status'] !== 'in_review') continue;
        $plan = $plans[$version['plan_id']] ?? null;
        if ($plan && $plan['is_archived']) continue;
        $optionCount = 0;
        foreach ($rules[$version['id']] ?? [] as $rule) $optionCount += count($options[$rule['id']] ?? []);
        $list[] = ['version' => $version, 'plan' => $plan, 'insurer' => $plan ? ($insurers[$plan['insurer_id']] ?? null) : null,
            'documentsCount' => count($documents[$version['id']] ?? []), 'priceOptionsCount' => $optionCount];
    }
    return $list;
}

function all_users(): array
{
    $rows = select(
        'SELECT u.id, u.email, u.display_name, u.is_active, GROUP_CONCAT(r.role) AS roles
         FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
         GROUP BY u.id, u.email, u.display_name, u.is_active
         ORDER BY u.created_at, u.id'
    );
    return array_map(fn($row) => ['roles' => $row['roles'] ? explode(',', $row['roles']) : []] + $row, $rows);
}
