<?php
declare(strict_types=1);

// Requests are untrusted: every action argument passes through here. Fields not listed are dropped.

const WEB_URL_MESSAGE = 'รูปแบบ URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)';
const DATE_MESSAGE = 'รูปแบบวันที่ไม่ถูกต้อง';
const INVALID_MESSAGE = 'ข้อมูลไม่ถูกต้อง';
const MAX_AMOUNT = 9999999999.99;
const INSURANCE_TYPES = ['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3'];

function fail(string $message = INVALID_MESSAGE): never
{
    throw new StoreError($message);
}

function text_rule(int $max, string $message = INVALID_MESSAGE): callable
{
    return function ($v) use ($max, $message) {
        if (!is_string($v)) fail();
        if (mb_strlen($v) > $max) fail($message);
        return $v;
    };
}

function short_text(): callable { return text_rule(255, 'ข้อความยาวเกิน 255 ตัวอักษร'); }
function long_text(): callable { return text_rule(5000, 'ข้อความยาวเกิน 5,000 ตัวอักษร'); }

function enum_rule(array $allowed): callable
{
    return function ($v) use ($allowed) {
        if (!in_array($v, $allowed, true)) fail();
        return $v;
    };
}

function amount_rule(): callable
{
    return function ($v) {
        if (!is_int($v) && !is_float($v)) fail();
        if ($v < 0) fail('จำนวนเงินต้องไม่ติดลบ');
        if ($v > MAX_AMOUNT) fail('จำนวนเงินเกินกำหนด');
        return $v;
    };
}

function date_rule(): callable
{
    return function ($v) {
        if (!is_string($v) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            fail(DATE_MESSAGE);
        }
        return $v;
    };
}

function car_age_rule(): callable
{
    return function ($v) {
        if (!is_int($v)) fail();
        if ($v < 0) fail('อายุรถต้องไม่ติดลบ');
        if ($v > 150) fail();
        return $v;
    };
}

function bool_rule(): callable
{
    return function ($v) {
        if (!is_bool($v)) fail();
        return $v;
    };
}

function nullable(callable $rule): callable
{
    return fn($v) => $v === null ? null : $rule($v);
}

function parse_id(mixed $v): string
{
    if (!is_string($v) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $v)) {
        fail('รหัสอ้างอิงไม่ถูกต้อง');
    }
    return $v;
}

function parse_reason(mixed $v): string
{
    if (!is_string($v)) fail();
    $reason = trim($v);
    if ($reason === '') fail('กรุณาระบุเหตุผลในการดำเนินการ');
    if (mb_strlen($reason) > 2000) fail('เหตุผลยาวเกิน 2,000 ตัวอักษร');
    return $reason;
}

function parse_lookup_id(mixed $v): string
{
    if (!is_string($v) || strlen($v) > 64) fail();
    return $v;
}

/** Applies each rule to the keys present in $input; a missing key stays missing. */
function parse_shape(mixed $input, array $rules, array $required = []): array
{
    if (!is_array($input)) fail();
    foreach ($required as $key) {
        if (!array_key_exists($key, $input)) fail();
    }
    $out = [];
    foreach ($rules as $key => $rule) {
        if (array_key_exists($key, $input)) $out[$key] = $rule($input[$key]);
    }
    return $out;
}

function parse_list(mixed $input, int $max, string $message, callable $item): array
{
    if (!is_array($input) || !array_is_list($input)) fail();
    if (count($input) > $max) fail($message);
    return array_map($item, $input);
}

function parse_insurer(mixed $input): array
{
    $data = parse_shape($input, [
        'id' => 'parse_id',
        'name' => short_text(),
        'contact_channels' => nullable(text_rule(1000, 'ข้อความยาวเกิน 1,000 ตัวอักษร')),
        'website' => nullable(function ($v) {
            if (!is_string($v)) fail();
            $v = trim($v);
            if ($v !== '' && (mb_strlen($v) > 2048 || !preg_match('/^https?:\/\/\S+$/iD', $v))) fail(WEB_URL_MESSAGE);
            return $v;
        }),
        'is_active' => bool_rule(),
    ], ['name']);
    $data['name'] = trim($data['name']);
    if ($data['name'] === '') fail('กรุณากรอกชื่อบริษัทประกันภัย');
    $data['is_active'] ??= true;
    return $data;
}

function parse_price_option(mixed $input): array
{
    $o = parse_shape($input, [
        // Client-side tier keys are allowed here: the store only honours ids already on this rule.
        'id' => text_rule(64),
        'label' => short_text(),
        'repairType' => enum_rule(['dealer', 'garage']),
        'priceType' => enum_rule(['starting', 'indicative', 'fixed_for_conditions', 'unknown']),
        'premiumTotal' => nullable(amount_rule()),
        'sumInsuredMin' => nullable(amount_rule()),
        'sumInsuredMax' => nullable(amount_rule()),
        'deductibleAmount' => amount_rule(),
        'deductibleTerms' => long_text(),
        'driverConditions' => long_text(),
        'compulsoryIncluded' => enum_rule(['included', 'excluded', 'unspecified']),
        'validFrom' => nullable(date_rule()),
        'validTo' => nullable(date_rule()),
    ], ['repairType']);
    if (isset($o['sumInsuredMin'], $o['sumInsuredMax']) && $o['sumInsuredMax'] < $o['sumInsuredMin']) {
        fail('ทุนประกันสูงสุดต้องไม่น้อยกว่าทุนประกันขั้นต่ำ');
    }
    if (!empty($o['validFrom']) && !empty($o['validTo']) && $o['validTo'] < $o['validFrom']) {
        fail('วันสิ้นสุดของราคาต้องไม่ก่อนวันเริ่มต้น');
    }
    return $o;
}

function parse_coverage(mixed $input): array
{
    return parse_shape($input, [
        'code' => text_rule(64),
        'status' => enum_rule(['covered', 'not_covered', 'optional', 'unknown']),
        'limitAmount' => nullable(amount_rule()),
        'limitBasis' => short_text(),
        'terms' => long_text(),
        'exclusions' => long_text(),
    ], ['code', 'status']);
}

function parse_save_plan(mixed $input): array
{
    $p = parse_shape($input, [
        'planId' => 'parse_id',
        'versionId' => 'parse_id',
        'insurerId' => 'parse_id',
        'name' => short_text(),
        'insuranceType' => enum_rule(INSURANCE_TYPES),
        'workflowStatus' => enum_rule(['draft', 'in_review', 'published', 'archived']),
        'effectiveFrom' => nullable(date_rule()),
        'effectiveTo' => nullable(date_rule()),
        'reviewDueAt' => nullable(date_rule()),
        'notes' => long_text(),
        'scopeType' => enum_rule(['specific_model', 'all_models', 'unknown']),
        'vehicleModelId' => nullable('parse_id'),
        'minCarAge' => nullable(car_age_rule()),
        'maxCarAge' => nullable(car_age_rule()),
        'ageBasis' => nullable(enum_rule(['registration_year', 'manufacture_year'])),
        'usageType' => nullable(enum_rule(['private', 'commercial', 'all'])),
        'registrationZone' => nullable(enum_rule(['all', 'bangkok_only', 'bangkok_metro', 'upcountry_only'])),
        'inspectionRequired' => bool_rule(),
        'priceOptions' => fn($v) => parse_list($v, 100, 'ตัวเลือกราคามากเกินไป', 'parse_price_option'),
        'coverages' => fn($v) => parse_list($v, 100, 'รายการความคุ้มครองมากเกินไป', 'parse_coverage'),
        'sourceType' => enum_rule(['policy_schedule', 'rate_sheet', 'brochure', 'endorsement', 'manual_note', 'other']),
        'documentTitle' => short_text(),
        'documentRef' => short_text(),
        'documentStoragePath' => nullable(function ($v) {
            if (!is_string($v) || strlen($v) > 1024 || !preg_match('/^(?!\/)(?!.*\.\.)[\w.\/-]+$/D', $v)) fail('ตำแหน่งไฟล์เอกสารไม่ถูกต้อง');
            return $v;
        }),
        // Rendered as a link on the plan page, so anything else (javascript:) must not get through.
        'documentSourceUrl' => nullable(function ($v) {
            if (!is_string($v) || mb_strlen($v) > 2048 || !preg_match('/^(https?:\/\/\S+|\/api\/documents\/[\w.-]+)$/iD', $v)) fail(WEB_URL_MESSAGE);
            return $v;
        }),
        'documentFileSize' => nullable(function ($v) {
            if (!is_int($v) || $v < 0) fail();
            return $v;
        }),
        'documentMimeType' => nullable(short_text()),
    ], ['insurerId', 'name', 'insuranceType']);

    $p['name'] = trim($p['name']);
    if ($p['name'] === '') fail('กรุณากรอกชื่อแพ็กเกจประกัน');
    if (!empty($p['effectiveFrom']) && !empty($p['effectiveTo']) && $p['effectiveTo'] < $p['effectiveFrom']) {
        fail('วันสิ้นสุดผลบังคับใช้ต้องไม่ก่อนวันเริ่มต้น');
    }
    if (isset($p['minCarAge'], $p['maxCarAge']) && $p['maxCarAge'] < $p['minCarAge']) {
        fail('อายุรถสูงสุดต้องไม่น้อยกว่าอายุรถขั้นต่ำ');
    }
    if (($p['scopeType'] ?? null) === 'specific_model' && empty($p['vehicleModelId'])) {
        fail('กรุณาเลือกรุ่นรถสำหรับเงื่อนไขระบุรุ่นเฉพาะ');
    }
    return $p;
}

/** Search filters arrive as query-string text, so bad values are ignored rather than rejected. */
function parse_search_filters(array $q): array
{
    $strings = fn($key) => array_values(array_filter((array) ($q[$key] ?? []), 'is_string'));
    $number = fn($key) => isset($q[$key]) && is_string($q[$key]) && is_numeric($q[$key]) && is_finite((float) $q[$key]) ? (float) $q[$key] : null;
    $text = fn($key) => isset($q[$key]) && is_string($q[$key]) && $q[$key] !== '' ? $q[$key] : null;
    $oneOf = fn($key, $allowed) => in_array($q[$key] ?? null, $allowed, true) ? $q[$key] : null;
    $carAge = $number('carAge');
    $filters = array_filter([
        'query' => $text('query'),
        'insurerIds' => $strings('insurerIds'),
        'insuranceTypes' => $strings('insuranceTypes'),
        'repairTypes' => $strings('repairTypes'),
        'vehicleBrand' => $text('vehicleBrand'),
        'vehicleModelId' => $text('vehicleModelId'),
        'carAge' => $carAge === null ? null : (int) $carAge,
        'usageType' => $text('usageType'),
        'registrationPlate' => $oneOf('registrationPlate', ['bangkok', 'metro', 'upcountry', 'bangkok_only_strict']),
        'minPremium' => $number('minPremium'),
        'maxPremium' => $number('maxPremium'),
        'minSumInsured' => $number('minSumInsured'),
        'maxSumInsured' => $number('maxSumInsured'),
        'includeUnknownPrice' => !empty($q['includeUnknownPrice']) ?: null,
        'requiredCoverageCodes' => $strings('requiredCoverageCodes'),
    ], fn($v) => $v !== null && $v !== []);
    $filters['sortBy'] = $oneOf('sortBy', ['premium_asc', 'premium_desc', 'sum_insured_desc', 'name_asc']) ?? 'premium_asc';
    $filters['page'] = max(1, (int) ($number('page') ?? 1));
    $filters['pageSize'] = 20;
    return $filters;
}
