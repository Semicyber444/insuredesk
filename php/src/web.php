<?php
declare(strict_types=1);

function json_out(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function redirect(string $path): never
{
    header('Location: ' . url($path));
    exit;
}

/** Renders a view. `$layout` wraps it in the signed-in shell, null sends it bare. */
function view(string $name, array $vars = [], ?string $layout = 'workspace', string $title = ''): never
{
    extract($vars);
    $session = current_session();
    ob_start();
    require APP_ROOT . "/views/$name.php";
    $content = ob_get_clean();
    if ($layout === null) echo $content;
    else require APP_ROOT . "/views/layout.php";
    exit;
}

function forbidden(string $title, string $body): never
{
    view('message', ['heading' => $title, 'body' => $body, 'iconName' => 'shield-alert']);
}

function require_session(): array
{
    return current_session() ?? redirect('/login');
}

/**
 * The same protection Server Actions had: browsers always say where a cross-site POST came from.
 * A proxy may rewrite Host, so the forwarded host counts too; a browser page can't forge either.
 */
function reject_cross_site_post(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin !== null) {
        $originHost = parse_url($origin, PHP_URL_HOST) . (($p = parse_url($origin, PHP_URL_PORT)) ? ":$p" : '');
        if (!in_array($originHost, array_filter([$_SERVER['HTTP_HOST'] ?? null, $_SERVER['HTTP_X_FORWARDED_HOST'] ?? null]), true)) {
            json_out(err('คำขอไม่ถูกต้อง'), 403);
        }
    } elseif (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin') === 'cross-site') {
        json_out(err('คำขอไม่ถูกต้อง'), 403);
    }
}

function handle_action(string $name): never
{
    reject_cross_site_post();
    $action = action_table()[$name] ?? null;
    if (!$action) json_out(err('ไม่พบคำสั่งที่ระบุ'), 404);
    $body = json_decode((string) file_get_contents('php://input'), true);
    $args = is_array($body['args'] ?? null) && array_is_list($body['args']) ? $body['args'] : [];
    json_out($action(...array_slice($args, 0, 2)));
}

const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const UPLOAD_TYPES = [
    'pdf' => 'application/pdf', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xls' => 'application/vnd.ms-excel', 'csv' => 'text/csv',
];
const SIZE_MESSAGE = 'ขนาดไฟล์เกินกำหนด (สูงสุดไม่เกิน 15 MB)';

function handle_upload(): never
{
    reject_cross_site_post();
    $session = current_session();
    if (!$session || (!has_permission($session['roles'], 'canEditDraft') && !has_permission($session['roles'], 'canReview'))) {
        json_out(['error' => 'ไม่มีสิทธิ์อัปโหลดเอกสารอ้างอิง'], 403);
    }

    $file = $_FILES['file'] ?? null;
    // PHP empties $_FILES when the body exceeds post_max_size.
    if (!$file && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > UPLOAD_MAX_BYTES) json_out(['error' => SIZE_MESSAGE], 400);
    if (!is_array($file) || !is_string($file['name']) || $file['error'] === UPLOAD_ERR_NO_FILE || $file['size'] === 0) {
        json_out(['error' => 'กรุณาเลือกไฟล์เอกสารที่ต้องการอัปโหลด'], 400);
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE || $file['size'] > UPLOAD_MAX_BYTES) json_out(['error' => SIZE_MESSAGE], 400);

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mime = UPLOAD_TYPES[$ext] ?? null;
    if (!$mime) json_out(['error' => 'รองรับเฉพาะไฟล์ PDF, รูปภาพ (PNG, JPG, WEBP) หรือตาราง Excel/CSV เท่านั้น'], 400);

    $safeName = (int) (microtime(true) * 1000) . '-' . substr(uuid(), 0, 8) . ".$ext";
    if (!is_dir(DOCUMENTS_DIR)) mkdir(DOCUMENTS_DIR, 0775, true);
    if ($file['error'] !== UPLOAD_ERR_OK || !move_uploaded_file($file['tmp_name'], DOCUMENTS_DIR . "/$safeName")) {
        error_log('Document upload error: ' . $file['error']);
        json_out(['error' => 'เกิดข้อผิดพลาดระหว่างบันทึกไฟล์เอกสารบนเซิร์ฟเวอร์'], 500);
    }
    // Each upload also clears files that older, never-saved uploads left behind.
    try {
        Store::removeAbandonedUploads();
    } catch (Throwable $e) {
        error_log('Upload sweep failed: ' . $e);
    }
    json_out(['storagePath' => "storage/documents/$safeName", 'sourceUrl' => "/api/documents/$safeName", 'originalName' => $file['name'], 'fileSize' => $file['size'], 'mimeType' => $mime]);
}

function serve_document(string $filename): never
{
    $session = current_session();
    if (!$session) json_out(['error' => 'กรุณาเข้าสู่ระบบก่อนเปิดเอกสาร'], 401);
    if (!preg_match('/^[a-zA-Z0-9._-]+$/D', $filename) || str_contains($filename, '..')) json_out(['error' => 'ชื่อไฟล์ไม่ถูกต้อง'], 400);

    // Viewers only see published documents. 404, not 403, so a draft's existence isn't revealed.
    $canSeeUnpublished = has_permission($session['roles'], 'canEditDraft') || has_permission($session['roles'], 'canReview');
    $path = DOCUMENTS_DIR . "/$filename";
    if ((!$canSeeUnpublished && !Store::isPublishedDocument("storage/documents/$filename")) || !is_file($path)) {
        json_out(['error' => 'ไม่พบไฟล์เอกสารบนเซิร์ฟเวอร์'], 404);
    }

    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $type = isset(UPLOAD_TYPES[$ext]) ? UPLOAD_TYPES[$ext] . ($ext === 'csv' ? '; charset=utf-8' : '') : 'application/octet-stream';
    $inline = in_array($ext, ['pdf', 'png', 'jpg', 'jpeg', 'webp'], true) && ($_GET['download'] ?? '') !== '1';
    header("Content-Type: $type");
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . "; filename=\"$filename\"");
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=3600');
    readfile($path);
    exit;
}

function page_search(): never
{
    $session = require_session();
    if (!has_permission($session['roles'], 'canSearch')) forbidden('ไม่มีสิทธิ์เข้าถึง', 'บัญชีนี้ไม่มีสิทธิ์ค้นหาแพ็กเกจ');
    $filters = parse_search_filters($_GET);
    $pool = build_search_items();
    $results = search_options($filters, $pool);
    $activeCount = count(array_filter([
        trim($filters['query'] ?? ''), $filters['insuranceTypes'] ?? null, $filters['repairTypes'] ?? null, $filters['insurerIds'] ?? null,
        $filters['vehicleBrand'] ?? null, $filters['vehicleModelId'] ?? null, isset($filters['carAge']), $filters['usageType'] ?? null,
        $filters['registrationPlate'] ?? null, isset($filters['minPremium']) || isset($filters['maxPremium']), $filters['includeUnknownPrice'] ?? null,
        isset($filters['minSumInsured']) || isset($filters['maxSumInsured']), $filters['requiredCoverageCodes'] ?? null,
    ]));
    $vars = compact('filters', 'results', 'activeCount');
    if (isset($_GET['partial'])) view('search_results', $vars, null);

    $insurers = array_values(array_filter(Store::insurers(), fn($i) => $i['is_active']));
    $poolSummary = array_map(fn($p) => ['id' => $p['id'], 'insurerName' => $p['insurerName'], 'planName' => $p['planName']], $pool);
    view('search', $vars + ['insurers' => $insurers, 'vehicleModels' => Store::vehicleModels(), 'coverageTypes' => Store::coverageTypes(), 'poolSummary' => $poolSummary]);
}

function page_compare(): never
{
    $session = require_session();
    if (!has_permission($session['roles'], 'canCompare')) forbidden('ไม่มีสิทธิ์เข้าถึง', 'บัญชีนี้ไม่มีสิทธิ์เปรียบเทียบแพ็กเกจ');
    $ids = array_slice(array_values(array_filter(explode(',', (string) ($_GET['ids'] ?? '')), fn($id) => $id !== '' && strlen($id) <= 64)), 0, 4);
    $data = count($ids) >= 2 ? comparison_data($ids) : null;
    view('compare', ['data' => $data, 'urlIds' => $ids], 'workspace', 'ใบเสนอราคาประกันภัยรถยนต์ - InsureDesk');
}

function page_plan(string $planId): never
{
    $session = require_session();
    $roles = $session['roles'];
    if (strlen($planId) > 64 || !has_permission($roles, 'canViewPublished')) forbidden('ไม่พบแพ็กเกจที่ระบุ', '');
    $canSeeUnpublished = has_permission($roles, 'canEditDraft') || has_permission($roles, 'canReview');
    view('plan', ['bundle' => plan_bundle($planId, !$canSeeUnpublished, has_permission($roles, 'canViewAudit'))]);
}

function page_manage(string $section): never
{
    $session = require_session();
    $roles = $session['roles'];
    switch ($section) {
        case 'plans':
            if (!has_permission($roles, 'canEditDraft')) forbidden('ไม่มีสิทธิ์เข้าถึงหน้าจัดการแพ็กเกจ', 'หน้านี้จำกัดเฉพาะบทบาทผู้กรอกข้อมูล (Editor) และผู้ดูแลระบบ (Admin) เท่านั้น');
            $showArchived = ($_GET['archived'] ?? '') === '1';
            view('manage_plans', ['plans' => all_plans($showArchived), 'showArchived' => $showArchived]);
        case 'reviews':
            if (!has_permission($roles, 'canReview')) forbidden('ไม่มีสิทธิ์เข้าถึงคิวตรวจสอบข้อมูล', 'หน้านี้จำกัดเฉพาะบทบาทผู้ตรวจสอบ (Reviewer) และผู้ดูแลระบบ (Admin) เท่านั้น');
            view('manage_reviews', ['reviews' => pending_reviews()]);
        case 'insurers':
            if (!has_permission($roles, 'canEditDraft')) forbidden('ไม่มีสิทธิ์เข้าถึงหน้าจัดการบริษัทประกัน', 'หน้านี้จำกัดเฉพาะบทบาทผู้กรอกข้อมูล (Editor) และผู้ดูแลระบบ (Admin) เท่านั้น');
            view('manage_insurers', ['insurers' => Store::insurers()]);
        case 'users':
            if (!has_permission($roles, 'canManageUsers')) forbidden('ไม่มีสิทธิ์เข้าถึงหน้าจัดการสมาชิก', 'หน้านี้จำกัดเฉพาะผู้ดูแลระบบ (Admin) เท่านั้น');
            view('manage_users', ['users' => all_users()]);
        case 'audit':
            if (!has_permission($roles, 'canViewAudit')) forbidden('ไม่มีสิทธิ์เข้าถึงประวัติระบบ (Audit Logs)', 'หน้านี้จำกัดเฉพาะผู้ตรวจสอบ (Reviewer) และผู้ดูแลระบบ (Admin) เท่านั้น');
            $offset = max(0, (int) ($_GET['offset'] ?? 0));
            // One extra row tells the page whether there is more to load.
            $rows = Store::auditLogs(AUDIT_PAGE_SIZE + 1, $offset);
            $vars = ['logs' => array_slice($rows, 0, AUDIT_PAGE_SIZE), 'hasMore' => count($rows) > AUDIT_PAGE_SIZE];
            if (isset($_GET['partial'])) {
                header('X-Has-More: ' . ($vars['hasMore'] ? '1' : '0'));
                view('audit_rows', $vars, null);
            }
            view('manage_audit', $vars);
    }
    http_response_code(404);
    view('message', ['heading' => 'ไม่พบหน้าที่ต้องการ', 'body' => '', 'iconName' => 'info']);
}

function dispatch(): never
{
    $path = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $base = base_path();
    if ($base !== '' && str_starts_with($path, $base)) $path = substr($path, strlen($base));
    $path = rtrim($path, '/') ?: '/';
    $isPost = $_SERVER['REQUEST_METHOD'] === 'POST';

    try {
        if ($isPost && preg_match('#^/action/(\w+)$#', $path, $m)) handle_action($m[1]);
        if ($isPost && $path === '/api/documents/upload') handle_upload();
        if (!$isPost && preg_match('#^/api/documents/([^/]+)$#', $path, $m)) serve_document(rawurldecode($m[1]));
        if ($isPost) json_out(err('ไม่พบคำสั่งที่ระบุ'), 404);

        if ($path === '/') redirect(current_session() ? '/search' : '/login');
        if ($path === '/login') view('login', ['demoAuthEnabled' => is_demo_auth_enabled()], null);
        if ($path === '/search') page_search();
        if ($path === '/compare') page_compare();
        if (preg_match('#^/plans/([^/]+)$#', $path, $m)) page_plan(rawurldecode($m[1]));
        if (preg_match('#^/manage/(\w+)$#', $path, $m)) page_manage($m[1]);
        require_session();
        http_response_code(404);
        view('message', ['heading' => 'ไม่พบหน้าที่ต้องการ', 'body' => '', 'iconName' => 'info']);
    } catch (Throwable $e) {
        error_log('Request failed: ' . $e);
        if (!headers_sent()) http_response_code(500);
        if ($isPost) json_out(err('เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'), 500);
        echo '<!doctype html><meta charset="utf-8"><title>InsureDesk</title><p role="alert" style="font-family:sans-serif;padding:2rem">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>';
        exit;
    }
}
