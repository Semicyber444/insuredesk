<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
  <div><h1 class="page-title"><?= icon('users', 'w-6 h-6 text-blue-600') ?><span>จัดการสมาชิกและบทบาท (Team Members)</span></h1><p class="page-sub">จำกัดการเข้าใช้งานเฉพาะบัญชีที่ผู้ดูแลระบบสร้างให้เท่านั้น</p></div>
  <button type="button" class="btn btn-outline" data-alert="เพิ่มสมาชิกจริงได้ด้วยคำสั่ง php bin/db.php create-user บนเซิร์ฟเวอร์ (ดูรายละเอียดใน README)"><?= icon('info', 'w-3.5 h-3.5') ?><span>คำแนะนำการเชิญสมาชิก</span></button>
</div>
<div class="card">
  <div class="p-3 border-b border-slate-100 text-xs font-bold text-slate-600">บัญชีและบทบาทมาตรฐานในระบบ (<?= count($users) ?> บัญชี)</div>
  <div class="divide-y divide-slate-100">
    <?php foreach ($users as $u): ?>
      <div class="p-3 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center"><?= e(mb_substr($u['display_name'], 0, 1)) ?></div><div><h3 class="font-bold text-sm"><?= e($u['display_name']) ?></h3><div class="flex items-center gap-1 text-[11px] text-slate-500"><?= icon('mail', 'w-3 h-3') ?><span><?= e($u['email']) ?></span></div></div></div>
        <div class="flex flex-wrap gap-1"><?php foreach ($u['roles'] as $r): ?><span class="badge border <?= role_badge_class($r) ?>"><?= e(role_label($r)) ?></span><?php endforeach; ?></div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
