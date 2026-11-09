<!doctype html>
<html lang="th" class="h-full antialiased">
<?php $title = ''; require APP_ROOT . '/views/head.php'; ?>
<body class="min-h-full flex items-center justify-center bg-slate-50 text-slate-900 font-sans p-4">
  <div class="card w-full max-w-md p-8 space-y-5">
    <div class="text-center space-y-2">
      <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center"><?= icon('shield', 'w-6 h-6') ?></div>
      <h1 class="text-2xl font-black">InsureDesk</h1>
      <p class="text-xs text-slate-500">ระบบค้นหาและเปรียบเทียบประกันรถยนต์ภายในทีม (สำหรับสมาชิกที่ได้รับเชิญเท่านั้น)</p>
    </div>
    <div id="login-error" role="alert" hidden class="alert-red"></div>
    <form id="login-form" class="space-y-3">
      <div><label class="label" for="login-email">อีเมลสมาชิก</label><input class="input" id="login-email" type="email" required autocomplete="username" placeholder="name@insuredesk.team"></div>
      <div><label class="label" for="login-password">รหัสผ่าน</label><input class="input" id="login-password" type="password" required autocomplete="current-password" placeholder="••••••••"></div>
      <button type="submit" class="btn btn-primary w-full"><span>เข้าสู่ระบบ</span></button>
    </form>
    <?php if ($demoAuthEnabled): ?>
      <div class="pt-4 border-t border-slate-100 space-y-2">
        <span class="block text-[11px] font-bold text-slate-500 text-center">เลือกเข้าสู่ระบบด่วนด้วยบัญชีจำลอง (สำหรับทดสอบ)</span>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <?php foreach (['admin' => 'Admin', 'reviewer' => 'Reviewer', 'editor' => 'Editor', 'viewer' => 'Viewer'] as $role => $label): ?>
            <button type="button" class="btn btn-soft" data-quick-login="<?= $role ?>"><?= $label ?></button>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>
  </div>
<script>window.APP = <?= json_encode(['base' => base_path()]) ?>;</script>
<script src="<?= e(url('/assets/app.js')) ?>"></script>
</body>
</html>
