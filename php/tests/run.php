<?php
// Self-check against a real MySQL. Needs TEST_DATABASE_URL (name ending in _test); that database is rebuilt on every run.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/../src/bootstrap.php';

$raw = getenv('TEST_DATABASE_URL');
$config = $raw ? database_config($raw) : null;
if (!$config || !str_ends_with($config['database'], '_test')) {
    fwrite(STDERR, "TEST_DATABASE_URL must point at a database whose name ends in _test\n");
    exit(1);
}
putenv("DATABASE_URL=$raw");
putenv('APP_ENV=test');
putenv('ENABLE_DEMO_AUTH=true');

$server = pdo_connect($config, false);
$server->exec("DROP DATABASE IF EXISTS `{$config['database']}`");
$server->exec("CREATE DATABASE `{$config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../bin/db.php') . ' migrate > /dev/null', $code);
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../bin/db.php') . ' seed > /dev/null', $code2);
if ($code || $code2) exit(1);

$failed = 0;
function check(string $name, bool $passed): void
{
    global $failed;
    if (!$passed) $failed++;
    echo($passed ? "  ok  " : "FAIL  ") . "$name\n";
}
function rejects(string $name, string $message, callable $fn): void
{
    try {
        $fn();
        check("$name (expected an error)", false);
    } catch (StoreError $e) {
        check($name, $e->getMessage() === $message);
    }
}
const NODE_HASH = 'scrypt$16bc252188626d3d37aec4342f65a185$db9daa40f320c1f829d6568a6ad7e3dad8a84b60a938ab5d1af2a8cc74dcfcfe5cf39576b5cd8a27adbc25b20c0f6fc7e436adcac6e5901515aba21b947d9bc5';
const ADMIN = ['id' => DEMO_USER_IDS['admin'], 'name' => 'admin'];
const BASE_PLAN = ['insurerId' => '20000000-0000-0000-0000-000000000001', 'name' => 'ทดสอบ', 'insuranceType' => 'ชั้น 1'];

// Passwords: this hash was produced by the Next.js app's hashPassword('correct horse battery').
check('reads a hash made by Node scrypt', verify_password('correct horse battery', NODE_HASH));
check('rejects the wrong password', !verify_password('wrong', NODE_HASH));
check('round-trips its own hash', verify_password('abc', hash_password('abc')));
check('rejects a malformed hash', !verify_password('x', 'scrypt$zz'));

// Row typing
$option = select("SELECT * FROM price_options WHERE id = '70000000-0000-0000-0000-000000000001'")[0];
check('decimals are numbers', $option['premium_total'] === 19250.0);
check('dates stay Y-m-d', $option['valid_from'] === '2026-01-01');
check('datetimes are ISO UTC', $option['created_at'] === '2026-01-01T00:00:00.000Z');
check('booleans are bool', select('SELECT is_active FROM users LIMIT 1')[0]['is_active'] === true);

// Search rules (Section 10.2)
$search = fn(array $f) => search_options($f + ['pageSize' => 100]);
check('only the latest published versions appear', $search([])['totalCount'] === 6);
check('text search', $search(['query' => 'วิริยะ'])['totalCount'] === 3);
check('insurance type filter', $search(['insuranceTypes' => ['ชั้น 2+']])['totalCount'] === 2);
check('required coverage must be covered', $search(['requiredCoverageCodes' => ['loss_of_use']])['totalCount'] === 0);
check('specific-model plan is excluded for another brand', !in_array('ทิพย EV Power Safe ประกันภัยรถยนต์ไฟฟ้าชั้น 1', array_column($search(['vehicleBrand' => 'Toyota'])['items'], 'planName'), true));
check('premium ascending', $search(['sortBy' => 'premium_asc'])['items'][0]['premiumTotal'] === 7075.0);
check('Thai name order puts leading vowels by consonant', array_values(array_unique(array_column($search(['sortBy' => 'name_asc'])['items'], 'insurerName'))) === ['กรุงเทพประกันภัย', 'ทิพยประกันภัย', 'ธนชาตประกันภัย', 'วิริยะประกันภัย']);
check('car age window', $search(['carAge' => 18])['totalCount'] === 1);
check('pagination', search_options(['pageSize' => 2, 'page' => 2])['page'] === 2 && count(search_options(['pageSize' => 2, 'page' => 2])['items']) === 2);

// Comparison
$compare = comparison_data(['70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004']);
$types = array_column($compare['warnings'], 'type');
check('compare keeps both options', count($compare['options']) === 2);
check('warns on sum insured', in_array('sum_insured_diff', $types, true));
check('warns on repair type', in_array('repair_type_diff', $types, true));
check('coverage text format', $compare['categories'][1]['items'][0]['values']['70000000-0000-0000-0000-000000000001']['text'] === '฿1,000,000 (ต่อคน)');
check('quote capped by end date', quote_validity('2026-01-01', ['2026-01-11'])['days'] === 10 && quote_validity('2026-01-01', ['2026-01-11'])['capped']);
check('quote default is 30 days', quote_validity('2026-01-01', [])['days'] === 30);
check('quote is negative after expiry', quote_validity('2026-01-10', ['2026-01-01'])['days'] === -9);

// Validation at the trust boundary
rejects('rejects a bad id', 'รหัสอ้างอิงไม่ถูกต้อง', fn() => parse_id("1' OR '1'='1"));
rejects('rejects javascript: links', WEB_URL_MESSAGE, fn() => parse_save_plan(BASE_PLAN + ['documentSourceUrl' => 'javascript:alert(1)']));
rejects('rejects path traversal', 'ตำแหน่งไฟล์เอกสารไม่ถูกต้อง', fn() => parse_save_plan(BASE_PLAN + ['documentStoragePath' => '../../etc/passwd']));
rejects('rejects an impossible date', DATE_MESSAGE, fn() => parse_save_plan(BASE_PLAN + ['effectiveFrom' => '2026-02-31']));
rejects('rejects reversed car ages', 'อายุรถสูงสุดต้องไม่น้อยกว่าอายุรถขั้นต่ำ', fn() => parse_save_plan(BASE_PLAN + ['minCarAge' => 5, 'maxCarAge' => 1]));
check('drops unknown fields', !array_key_exists('evil', parse_save_plan(BASE_PLAN + ['evil' => 1])));

// Workflow
$saved = Store::createOrUpdatePlan(BASE_PLAN + ['workflowStatus' => 'draft', 'priceOptions' => [['repairType' => 'garage', 'premiumTotal' => 1000, 'sumInsuredMax' => 100000]]], ADMIN);
$versionId = $saved['version']['id'];
$planId = $saved['plan']['id'];
check('save assigns version 1', $saved['version']['version_no'] === 1);
check('save fills default label', select('SELECT label FROM price_options po JOIN eligibility_rules r ON r.id = po.eligibility_rule_id WHERE r.plan_version_id = ?', [$versionId])[0]['label'] === 'ซ่อมอู่ - ทุน 100,000 บาท');
check('save fills every default coverage', count(select('SELECT id FROM version_coverages WHERE plan_version_id = ?', [$versionId])) === 16);
Store::submitForReview($versionId, 'ส่ง', ADMIN);
rejects('publish needs a source document', NO_DOCUMENT_MESSAGE, fn() => Store::publishVersion($versionId, 'เผยแพร่', ADMIN));
rejects('editor cannot change an in-review version', 'แก้ไขได้เฉพาะรุ่นฉบับร่าง รุ่นที่ส่งตรวจแล้วต้องให้ผู้ตรวจสอบตีกลับก่อน หรือสร้างรุ่นใหม่แทน', fn() => Store::createOrUpdatePlan(BASE_PLAN + ['planId' => $planId, 'versionId' => $versionId, 'workflowStatus' => 'draft'], ADMIN, true));
Store::rejectVersion($versionId, 'แก้', ADMIN);
check('reject returns to draft', find_version($versionId)['workflow_status'] === 'draft');
Store::createOrUpdatePlan(BASE_PLAN + ['planId' => $planId, 'versionId' => $versionId, 'workflowStatus' => 'in_review', 'documentTitle' => 'เอกสาร'], ADMIN);
Store::publishVersion($versionId, 'เผยแพร่', ADMIN);
$second = Store::createOrUpdatePlan(BASE_PLAN + ['planId' => $planId, 'workflowStatus' => 'published', 'documentTitle' => 'ใหม่'], ADMIN);
check('new version number', $second['version']['version_no'] === 2);
check('publishing archives the older version', find_version($versionId)['workflow_status'] === 'archived');
rejects('editor cannot rename a published plan', 'ชื่อแพ็กเกจ บริษัทประกัน และชั้นประกันของแพ็กเกจที่เผยแพร่แล้ว เปลี่ยนได้เฉพาะผู้มีสิทธิ์เผยแพร่', fn() => Store::createOrUpdatePlan(['name' => 'อื่น', 'planId' => $planId, 'workflowStatus' => 'draft'] + BASE_PLAN, ADMIN, true));
check('published plan archives instead of deleting', Store::deletePlan($planId, ADMIN)['mode'] === 'archived');
Store::restorePlan($planId, ADMIN);
check('restore un-archives', select('SELECT is_archived FROM plans WHERE id = ?', [$planId])[0]['is_archived'] === false);

$draft = Store::createOrUpdatePlan(BASE_PLAN + ['workflowStatus' => 'draft'], ADMIN);
check('draft plan is really deleted', Store::deletePlan($draft['plan']['id'], ADMIN)['mode'] === 'deleted');
check('child rows cascade', !select('SELECT id FROM plan_versions WHERE plan_id = ?', [$draft['plan']['id']]));

$insurer = Store::saveInsurer(['name' => 'ใหม่'], ADMIN);
check('unused insurer is deleted', Store::deleteInsurer($insurer['id'], ADMIN)['mode'] === 'deleted');
check('linked insurer is deactivated', Store::deleteInsurer('20000000-0000-0000-0000-000000000001', ADMIN)['mode'] === 'deactivated');
check('audit log stores JSON', str_contains(select("SELECT after_data FROM audit_logs WHERE action = 'publish' ORDER BY created_at DESC LIMIT 1")[0]['after_data'], 'published'));

// Permissions
foreach (['viewer' => [false, false], 'editor' => [false, true], 'reviewer' => [true, false], 'admin' => [true, true]] as $role => [$publish, $edit]) {
    check("$role permissions", has_permission([$role], 'canPublish') === $publish && has_permission([$role], 'canEditDraft') === $edit);
}
check('guarded refuses without a session', guarded('canSearch', fn() => 1) === err('กรุณาเข้าสู่ระบบก่อนใช้งาน'));

// Login throttle
$email = 'locked@example.com';
for ($i = 0; $i < 10; $i++) check_silent(register_login_attempt($email));
function check_silent(bool $locked): void { if ($locked) check('locked too early', false); }
check('locks after 10 failures', register_login_attempt($email));
clear_failed_logins($email);
check('success clears the lock', !register_login_attempt($email));

echo $failed ? "\n$failed failed\n" : "\nall passed\n";
exit($failed ? 1 : 0);
