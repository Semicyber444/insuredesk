<?php
/** @var string $content @var ?array $session @var string $title */
$roles = $session['roles'] ?? [];
$primaryRole = $roles[0] ?? 'viewer';
$current = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$current = substr($current, strlen(base_path()));
$links = array_filter([
    ['/search', 'ค้นหาประกัน', 'search', true],
    ['/compare', 'เปรียบเทียบ', 'columns-3', true],
    ['/manage/plans', 'จัดการแพ็กเกจ', 'file-text', has_permission($roles, 'canEditDraft')],
    ['/manage/reviews', 'ตรวจสอบ (Review)', 'file-check', has_permission($roles, 'canReview')],
    ['/manage/insurers', 'บริษัทประกัน', 'settings', has_permission($roles, 'canEditDraft')],
    ['/manage/users', 'สมาชิก', 'users', has_permission($roles, 'canManageUsers')],
    ['/manage/audit', 'ประวัติ (Audit)', 'history', has_permission($roles, 'canViewAudit')],
], fn($l) => $l[3]);
$isDemo = $session && is_demo_user($session['id']);
$navHtml = '';
foreach ($links as [$href, $label, $iconName]) {
    $active = str_starts_with($current, $href) ? ' aria-current="page"' : '';
    $navHtml .= '<a class="nav-link" href="' . e(url($href)) . "\"$active>" . icon($iconName, 'w-3.5 h-3.5') . e($label) . '</a>';
}
$formIcons = array_intersect_key(ICONS, array_flip(['x', 'plus', 'copy', 'trash-2', 'upload', 'file-text', 'external-link', 'circle-alert', 'save', 'layers', 'sparkles', 'loader-circle']));
?><!doctype html>
<html lang="th" class="h-full antialiased">
<?php require APP_ROOT . '/views/head.php'; ?>
<body class="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
<div class="min-h-screen bg-slate-50 flex flex-col text-slate-900">
  <header class="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
      <div class="flex items-center gap-5 min-w-0">
        <a href="<?= e(url('/search')) ?>" class="flex items-center gap-2 shrink-0">
          <span class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center"><?= icon('shield') ?></span>
          <span class="flex flex-col leading-tight"><span class="font-black text-sm">InsureDesk</span><span class="hidden sm:block text-[10px] text-slate-500">ระบบเปรียบเทียบประกันรถยนต์</span></span>
        </a>
        <nav aria-label="เมนูหลัก" class="hidden xl:flex items-center gap-0.5"><?= $navHtml ?></nav>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center" title="<?= e($session['name'] . ' · ' . role_label($primaryRole)) ?>"><?= e(mb_substr($session['name'], 0, 1)) ?></span>
        <span class="hidden sm:flex flex-col leading-tight text-right"><span class="text-xs font-bold"><?= e($session['name']) ?></span><span class="badge border <?= role_badge_class($primaryRole) ?>"><?= e(role_label($primaryRole)) ?></span></span>
        <button type="button" data-logout class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" title="ออกจากระบบ / สลับบัญชี" aria-label="ออกจากระบบ"><?= icon('log-out') ?></button>
        <button type="button" data-menu-toggle aria-expanded="false" aria-label="เปิดเมนูนำทาง" class="p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer <?= $isDemo ? '' : 'xl:hidden' ?>"><?= icon('menu') ?></button>
      </div>
    </div>
    <div id="mobile-menu" hidden class="border-t border-slate-100 bg-white px-4 py-3 space-y-3">
      <nav aria-label="เมนูหลัก" class="flex flex-wrap gap-1 xl:hidden"><?= $navHtml ?></nav>
      <?php if ($isDemo): ?>
        <div class="flex flex-wrap items-center gap-2">
          <span id="demo-role-label" class="text-xs font-bold text-slate-500">สลับสิทธิ์ทดสอบ (Demo Role):</span>
          <div role="group" aria-labelledby="demo-role-label" class="flex flex-wrap gap-1">
            <?php foreach (['admin', 'reviewer', 'editor', 'viewer'] as $r): ?>
              <button type="button" data-demo-role="<?= $r ?>" aria-pressed="<?= $primaryRole === $r ? 'true' : 'false' ?>" class="btn <?= $primaryRole === $r ? 'btn-primary' : 'btn-soft' ?>"><?= $r ?></button>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endif; ?>
    </div>
  </header>
  <main class="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
    <?= $content ?>
  </main>
  <footer class="no-print border-t border-slate-200 bg-white">
    <div class="max-w-7xl mx-auto px-4 py-4 text-[11px] text-slate-500 space-y-2">
      <div class="flex gap-2"><?= icon('circle-alert', 'w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5') ?><p><span class="font-bold text-slate-700">ข้อจำกัดและข้อกำหนดการใช้งานภายในทีม:</span> ระบบ InsureDesk นี้เป็นเครื่องมืออ้างอิงข้อมูลภายในทีมเท่านั้น ไม่ใช่การยืนยันราคา การรับประกัน หรือความคุ้มครองสำหรับรถคันใดโดยอัตโนมัติ ก่อนนำข้อมูลไปใช้งานจริง ต้องตรวจสอบเอกสารและเงื่อนไขที่มีผลบังคับใช้กับบริษัทประกันภัยเสมอ</p></div>
      <div class="flex flex-wrap justify-between gap-2"><span>© 2026 InsureDesk — ระบบจัดการและค้นหาประกันภัยรถยนต์ภายในทีม</span><span>PHP + MySQL Architecture</span></div>
    </div>
  </footer>
</div>
<script>window.APP = <?= json_encode(['base' => base_path(), 'userName' => $session['name'], 'canPublish' => has_permission($roles, 'canPublish'), 'icons' => $formIcons, 'today' => bangkok_date(0), 'nextYear' => bangkok_date(365)], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;</script>
<script src="<?= e(url('/assets/app.js')) ?>"></script>
<?php if (has_permission($roles, 'canEditDraft')): ?><script src="<?= e(url('/assets/plan-form.js')) ?>"></script><?php endif; ?>
</body>
</html>
