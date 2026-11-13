<?php
declare(strict_types=1);

const CONNECTION_ERROR = 'ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง';
const INVALID_LOGIN = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับเชิญเข้าสู่ระบบ';

function ok(mixed $data = null): array { return ['ok' => true, 'data' => $data]; }
function err(string $message): array { return ['ok' => false, 'error' => $message]; }
function actor_of(array $session): array { return ['id' => $session['id'], 'name' => $session['name']]; }

/**
 * Wraps every action: these are reachable by direct POST, so each one checks the session and
 * permission here. Passing several permissions means any one of them is enough.
 */
function guarded(array|string $permissions, callable $work): array
{
    try {
        $session = current_session();
        if (!$session) return err('กรุณาเข้าสู่ระบบก่อนใช้งาน');
        foreach ((array) $permissions as $permission) {
            if (has_permission($session['roles'], $permission)) return ok($work($session));
        }
        return err('คุณไม่มีสิทธิ์ดำเนินการนี้');
    } catch (StoreError $e) {
        return err($e->getMessage());
    } catch (Throwable $e) {
        error_log('Action failed: ' . $e);
        return err('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
}

function login_action(mixed $rawEmail, mixed $rawPassword): array
{
    // scrypt work grows with input, so cap what a request can make the server hash.
    if (!is_string($rawEmail) || !is_string($rawPassword)) return err(INVALID_LOGIN);
    $email = mb_strtolower(trim($rawEmail));
    if ($email === '' || mb_strlen($email) > 255 || $rawPassword === '' || mb_strlen($rawPassword) > 1024) return err(INVALID_LOGIN);

    try {
        $user = select('SELECT id, password_hash, is_active FROM users WHERE email = ?', [$email])[0] ?? null;

        // Demo accounts sign in with any password while demo auth is on.
        if ($user && is_demo_user($user['id']) && is_demo_auth_enabled()) {
            start_session($user['id']);
            return ok();
        }
        // Applies to unknown emails too, so being locked out doesn't reveal which accounts exist.
        if (register_login_attempt($email)) return err(LOGIN_LOCKED_MESSAGE);

        // A dummy hash for unknown emails, so response time doesn't reveal which accounts exist.
        $matches = verify_password($rawPassword, $user['password_hash'] ?? 'scrypt$' . str_repeat('0', 32) . '$' . str_repeat('0', 128));
        if (!$user || !$user['is_active'] || !$user['password_hash'] || !$matches) return err(INVALID_LOGIN);
        clear_failed_logins($email);
        start_session($user['id']);
        return ok();
    } catch (Throwable $e) {
        error_log('Login failed: ' . $e);
        return err(CONNECTION_ERROR);
    }
}

function demo_login_action(mixed $role): array
{
    if (!is_demo_auth_enabled() || !is_string($role) || !isset(DEMO_USER_IDS[$role])) return err('ไม่ได้เปิดใช้งานบัญชีจำลอง');
    try {
        start_session(DEMO_USER_IDS[$role]);
        return ok();
    } catch (Throwable $e) {
        error_log('Demo login failed: ' . $e);
        return err(CONNECTION_ERROR);
    }
}

/** The navbar's role switcher: only a signed-in demo user may hop between demo users. */
function switch_demo_role_action(mixed $role): array
{
    $session = current_session();
    if (!$session || !is_demo_user($session['id']) || !is_string($role) || !isset(DEMO_USER_IDS[$role])) return err('สลับบทบาทได้เฉพาะบัญชีจำลอง');
    end_session();
    return demo_login_action($role);
}

function save_plan_action(mixed $raw): array
{
    return guarded('canEditDraft', function ($session) use ($raw) {
        $payload = parse_save_plan($raw);
        $canPublish = has_permission($session['roles'], 'canPublish');
        $status = $payload['workflowStatus'] ?? ($canPublish ? 'published' : 'draft');

        if (!$canPublish && $status !== 'draft' && $status !== 'in_review') fail('คุณไม่มีสิทธิ์เผยแพร่แพ็กเกจ');

        // Section 8.4: nothing is published without a source document.
        if ($status === 'published') {
            $inPayload = blank($payload['documentTitle'] ?? null) !== null || !empty($payload['documentStoragePath']) || !empty($payload['documentSourceUrl']);
            $existing = !empty($payload['versionId']) && select('SELECT id FROM source_documents WHERE plan_version_id = ? LIMIT 1', [$payload['versionId']]);
            if (!$inPayload && !$existing) fail(NO_DOCUMENT_MESSAGE);
        }
        return Store::createOrUpdatePlan(['workflowStatus' => $status] + $payload, actor_of($session), !$canPublish);
    });
}

function plan_form_action(mixed $planId): array
{
    return guarded('canEditDraft', function ($session) use ($planId) {
        return [
            'insurers' => Store::insurers(),
            'vehicleModels' => Store::vehicleModels(),
            'coverageTypes' => Store::coverageTypes(),
            'bundle' => $planId === null ? null : plan_bundle(parse_lookup_id($planId), false, false),
        ];
    });
}

/** The only names POST /action/{name} can reach. */
function action_table(): array
{
    return [
        'login' => 'login_action',
        'demoLogin' => 'demo_login_action',
        'switchDemoRole' => 'switch_demo_role_action',
        'logout' => function () { end_session(); return ok(); },
        'savePlan' => 'save_plan_action',
        'planForm' => 'plan_form_action',
        'deletePlan' => fn($id = null) => guarded('canEditDraft', fn($s) => Store::deletePlan(parse_id($id), actor_of($s))),
        'restorePlan' => fn($id = null) => guarded('canEditDraft', fn($s) => Store::restorePlan(parse_id($id), actor_of($s))),
        'submitForReview' => fn($id = null, $reason = null) => guarded('canSubmitReview', fn($s) => Store::submitForReview(parse_id($id), parse_reason($reason), actor_of($s))),
        'publishVersion' => fn($id = null, $reason = null) => guarded('canPublish', fn($s) => Store::publishVersion(parse_id($id), parse_reason($reason), actor_of($s))),
        'rejectVersion' => fn($id = null, $reason = null) => guarded('canReview', fn($s) => Store::rejectVersion(parse_id($id), parse_reason($reason), actor_of($s))),
        'saveInsurer' => fn($data = null) => guarded('canEditDraft', fn($s) => Store::saveInsurer(parse_insurer($data), actor_of($s))),
        'deleteInsurer' => fn($id = null) => guarded('canEditDraft', fn($s) => Store::deleteInsurer(parse_id($id), actor_of($s))),
    ];
}
