<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
  <div><h1 class="page-title"><?= icon('file-text', 'w-6 h-6 text-blue-600') ?><span>จัดการแพ็กเกจและข้อมูลร่าง (Plans Management)</span></h1><p class="page-sub">บันทึก แก้ไขข้อมูลแพ็กเกจ รุ่นเงื่อนไข ราคา และเอกสารอ้างอิง</p></div>
  <div class="flex items-center gap-3">
    <label class="check-row"><input type="checkbox" data-show-archived <?= $showArchived ? 'checked' : '' ?>><span>แสดงแพ็กเกจในกรุ (Archived)</span></label>
    <button type="button" class="btn btn-primary" data-plan-create><?= icon('plus', 'w-3.5 h-3.5') ?><span>สร้างแพ็กเกจใหม่</span></button>
  </div>
</div>
<div id="status-notice" role="status" hidden class="notice mb-3"></div>
<div class="card overflow-x-auto">
  <?php if (!$plans): ?><div class="p-8 text-center text-xs text-slate-500">ไม่มีรายการแพ็กเกจในมุมมองนี้</div>
  <?php else: ?>
  <table class="w-full text-xs min-w-[860px]">
    <thead class="bg-slate-50 text-left text-slate-500"><tr><th class="p-3">บริษัทประกัน</th><th class="p-3">ชื่อแพ็กเกจ</th><th class="p-3">ประเภท</th><th class="p-3">เวอร์ชันล่าสุด</th><th class="p-3">สถานะการทำงาน</th><th class="p-3">การจัดการ</th></tr></thead>
    <tbody class="divide-y divide-slate-100">
    <?php foreach ($plans as $plan):
        $planJson = e(json_encode(['id' => $plan['id'], 'insurer_id' => $plan['insurer_id'], 'name' => $plan['name'], 'insurance_type' => $plan['insurance_type'], 'currentStatus' => $plan['currentStatus']], JSON_UNESCAPED_UNICODE));
        [$class, $label] = $plan['is_archived'] ? ['bg-slate-200 text-slate-700', 'จัดเก็บเข้ากรุ (Archived)'] : match ($plan['currentStatus']) {
            'published' => ['bg-emerald-100 text-emerald-800', 'เผยแพร่แล้ว (Published)'],
            'in_review' => ['bg-amber-100 text-amber-800', 'รอตรวจสอบ (In Review)'],
            default => ['bg-blue-100 text-blue-800', 'ข้อมูลร่าง (Draft)'],
        };
    ?>
      <tr>
        <td class="p-3 font-semibold"><?= e($plan['insurerName']) ?></td>
        <td class="p-3"><div class="font-bold"><?= e($plan['name']) ?></div><div class="text-[11px] text-slate-400 font-mono">ID: <?= e(substr($plan['id'], 0, 8)) ?>...</div></td>
        <td class="p-3"><?= e($plan['insurance_type']) ?></td>
        <td class="p-3"><span class="font-bold">รุ่นที่ <?= $plan['latestVersionNo'] ?></span> <span class="text-slate-400">(<?= $plan['versionsCount'] ?> รุ่น)</span></td>
        <td class="p-3"><span class="badge <?= $class ?>"><?= $label ?></span></td>
        <td class="p-3"><div class="flex flex-wrap items-center gap-1">
          <?php if (!$plan['is_archived'] && $plan['currentStatus'] === 'draft' && has_permission($session['roles'], 'canSubmitReview')): ?>
            <button type="button" class="btn btn-primary" title="ส่งให้ผู้ตรวจสอบอนุมัติ" data-submit-review="<?= e($plan['activeVersionId']) ?>" data-reason="<?= e("ส่งตรวจสอบแพ็กเกจ \"{$plan['name']}\" รุ่นที่ {$plan['latestVersionNo']}") ?>" data-notice="<?= e("ส่งแพ็กเกจ \"{$plan['name']}\" เข้าสู่คิวตรวจสอบเรียบร้อยแล้ว") ?>"><span>ส่งตรวจ</span></button>
          <?php endif; ?>
          <?php if (!$plan['is_archived']): ?><button type="button" class="btn btn-outline" title="แก้ไขข้อมูลแพ็กเกจ" data-plan-edit="<?= $planJson ?>"><?= icon('pencil', 'w-3.5 h-3.5') ?><span>แก้ไข</span></button><?php endif; ?>
          <button type="button" class="btn btn-outline" title="คัดลอกแพ็กเกจนี้เพื่อสร้างแพ็กเกจใหม่" data-plan-copy="<?= $planJson ?>"><?= icon('copy', 'w-3.5 h-3.5') ?><span>คัดลอก</span></button>
          <a class="btn btn-outline" title="ดูรายละเอียดฉบับเต็ม" href="<?= e(url("/plans/{$plan['id']}")) ?>"><?= icon('eye', 'w-3.5 h-3.5') ?><span>เปิดดู</span></a>
          <?php if ($plan['is_archived']): ?>
            <button type="button" class="btn btn-green" title="กู้คืนแพ็กเกจกลับมาใช้งาน" data-plan-restore="<?= e($plan['id']) ?>" data-name="<?= e($plan['name']) ?>"><?= icon('archive-restore', 'w-3.5 h-3.5') ?><span>กู้คืน</span></button>
          <?php else: $isPublished = $plan['currentStatus'] === 'published'; ?>
            <button type="button" class="btn btn-red" aria-label="ลบหรือจัดเก็บแพ็กเกจ" title="<?= $isPublished ? 'จัดเก็บแพ็กเกจเข้ากรุ (Archive)' : 'ลบแพ็กเกจร่าง' ?>" data-plan-delete="<?= e($plan['id']) ?>" data-name="<?= e($plan['name']) ?>" data-published="<?= $isPublished ? '1' : '' ?>"><?= icon('trash-2', 'w-3.5 h-3.5') ?></button>
          <?php endif; ?>
        </div></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <?php endif; ?>
</div>
