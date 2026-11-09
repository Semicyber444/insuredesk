<?php
declare(strict_types=1);

final class StoreError extends RuntimeException {}

function uuid(): string
{
    $hex = bin2hex(random_bytes(16));
    return sprintf('%s-%s-4%s-%x%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 13, 3),
        hexdec($hex[16]) & 3 | 8, substr($hex, 17, 3), substr($hex, 20));
}

/** The current instant as the ISO UTC string the rows carry. */
function now_iso(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function bangkok_tz(): DateTimeZone
{
    static $tz = null;
    return $tz ??= new DateTimeZone('Asia/Bangkok');
}

/** Returns Y-m-d in Asia/Bangkok (Section 8.1). */
function bangkok_date(int $offsetDays = 0): string
{
    return (new DateTimeImmutable('now', bangkok_tz()))->modify("$offsetDays days")->format('Y-m-d');
}

/**
 * A quote is good for $quoteDays from $today, but never past the earliest end date given
 * (end dates are inclusive, Y-m-d). 'days' is negative once an end date has passed.
 */
function quote_validity(string $today, array $endDates, int $quoteDays = 30): array
{
    $start = new DateTimeImmutable($today, bangkok_tz());
    $quoteEnd = $start->modify("+$quoteDays days");
    $dates = array_filter($endDates);
    $earliest = $dates ? new DateTimeImmutable(min($dates), bangkok_tz()) : null;
    $capped = $earliest !== null && $earliest < $quoteEnd;
    $until = $capped ? $earliest : $quoteEnd;
    return ['until' => $until->format('Y-m-d'), 'days' => (int) $start->diff($until)->format('%r%a'), 'capped' => $capped];
}

function blank(?string $value): ?string
{
    $trimmed = trim((string) $value);
    return $trimmed === '' ? null : $trimmed;
}

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function base_path(): string
{
    if (PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli') return '';
    return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
}

function url(string $path): string
{
    return base_path() . $path;
}

/** Stored links to uploads are root-relative; external ones are left alone. */
function document_url(string $sourceUrl): string
{
    return str_starts_with($sourceUrl, '/api/documents/') ? url($sourceUrl) : $sourceUrl;
}

function money(int|float $amount): string
{
    return rtrim(rtrim(number_format((float) $amount, 2), '0'), '.');
}

function to_bangkok(string $iso): DateTimeImmutable
{
    return (new DateTimeImmutable($iso))->setTimezone(bangkok_tz());
}

function thai_year(DateTimeImmutable $date): int
{
    return (int) $date->format('Y') + 543;
}

function thai_date(string $iso): string
{
    $date = to_bangkok($iso);
    return $date->format('j/n/') . thai_year($date);
}

function thai_datetime(string $iso): string
{
    $date = to_bangkok($iso);
    return $date->format('j/n/') . thai_year($date) . ' ' . $date->format('H:i:s');
}

function thai_long_date(string $ymd): string
{
    $months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    $date = new DateTimeImmutable($ymd, bangkok_tz());
    return $date->format('j') . ' ' . $months[(int) $date->format('n') - 1] . ' ' . thai_year($date);
}

function format_car_age_range(?int $min, ?int $max): string
{
    if ($min !== null && $max !== null) return "$min-$max ปี";
    if ($min !== null) return "$min ปีขึ้นไป";
    if ($max !== null) return "ไม่เกิน $max ปี";
    return 'ไม่จำกัด';
}

function format_zone_label(?string $zone, bool $short = false): string
{
    return match ($zone) {
        'bangkok_only' => $short ? 'เฉพาะป้าย กทม.' : 'เฉพาะรถป้าย กทม. เท่านั้น',
        'bangkok_metro' => $short ? 'เฉพาะป้าย กทม./ปริมณฑล' : 'เฉพาะรถป้าย กทม. และปริมณฑล',
        'upcountry_only' => $short ? 'เฉพาะป้าย ตจว.' : 'เฉพาะรถป้ายต่างจังหวัด (ตจว.)',
        default => $short ? 'ทุกป้ายทะเบียน' : 'รับทุกป้ายทะเบียน (ทั่วประเทศ)',
    };
}

const ROLE_PERMISSIONS = [
    'viewer' => ['canSearch', 'canCompare', 'canViewPublished'],
    'editor' => ['canSearch', 'canCompare', 'canViewPublished', 'canEditDraft', 'canSubmitReview'],
    'reviewer' => ['canSearch', 'canCompare', 'canViewPublished', 'canReview', 'canPublish', 'canViewAudit'],
    'admin' => ['canSearch', 'canCompare', 'canViewPublished', 'canEditDraft', 'canSubmitReview', 'canReview', 'canPublish', 'canManageUsers', 'canViewAudit'],
];

function has_permission(array $roles, string $permission): bool
{
    foreach ($roles as $role) {
        if (in_array($permission, ROLE_PERMISSIONS[$role] ?? [], true)) return true;
    }
    return false;
}

function role_badge_class(string $role): string
{
    return match ($role) {
        'admin' => 'bg-purple-100 text-purple-800 border-purple-200',
        'reviewer' => 'bg-amber-100 text-amber-800 border-amber-200',
        'editor' => 'bg-blue-100 text-blue-800 border-blue-200',
        default => 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
}

function role_label(string $role): string
{
    return match ($role) {
        'admin' => 'ผู้ดูแลระบบ (Admin)',
        'reviewer' => 'ผู้ตรวจสอบ (Reviewer)',
        'editor' => 'ผู้กรอกข้อมูล (Editor)',
        'viewer' => 'สมาชิกทั่วไป (Viewer)',
        default => $role,
    };
}
