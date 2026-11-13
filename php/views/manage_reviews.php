<div class="mb-5"><h1 class="page-title"><?= icon('file-check', 'w-6 h-6 text-blue-600') ?><span>คิวตรวจสอบและเผยแพร่ข้อมูล (Review Queue)</span></h1><p class="page-sub">สำหรับบทบาทผู้ตรวจสอบ (Reviewer / Admin) ในการตรวจเทียบข้อมูลกับเอกสารต้นทางก่อนเผยแพร่ให้ทีมใช้งาน</p></div>
<?php if (!$reviews): ?>
  <div class="card p-10 text-center"><div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3"><?= icon('circle-check', 'w-6 h-6') ?></div><h3 class="font-black">ไม่มีรายการค้างตรวจในระบบ</h3><p class="text-xs text-slate-500 mt-1">ข้อมูลแพ็กเกจทั้งหมดได้รับการตรวจสอบและเผยแพร่เรียบร้อยแล้ว</p></div>
<?php else: ?>
  <div class="space-y-3">
  <?php foreach ($reviews as ['version' => $version, 'plan' => $plan, 'insurer' => $insurer, 'documentsCount' => $docs, 'priceOptionsCount' => $options]): ?>
    <div class="card p-4 flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0 space-y-1.5">
        <div class="flex flex-wrap gap-1.5"><span class="badge bg-slate-900 text-white"><?= e($insurer['name'] ?? 'ไม่ระบุบริษัท') ?></span><span class="badge bg-blue-100 text-blue-800"><?= e($plan['insurance_type'] ?? '') ?></span><span class="badge bg-amber-100 text-amber-800">รอตรวจสอบ (In Review)</span></div>
        <div class="flex flex-wrap items-center gap-2"><h3 class="font-black text-sm"><?= e($plan['name'] ?? '') ?></h3><?php if ($plan): ?><a class="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline" href="<?= e(url("/plans/{$plan['id']}")) ?>"><?= icon('external-link', 'w-3.5 h-3.5') ?><span>ตรวจดูรายละเอียด</span></a><?php endif; ?></div>
        <div class="flex flex-wrap gap-3 text-[11px] text-slate-600"><span>รุ่นที่: <strong><?= $version['version_no'] ?></strong></span><span>ตัวเลือกราคา: <strong><?= $options ?> รายการ</strong></span><span>เอกสารแนบ: <strong><?= $docs ?> ฉบับ</strong></span><?php if ($version['notes']): ?><span>&quot;<?= e($version['notes']) ?>&quot;</span><?php endif; ?></div>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn btn-red" data-review="reject" data-version="<?= e($version['id']) ?>" data-name="<?= e($plan['name'] ?? '') ?>"><span>ส่งกลับแก้ไข</span></button>
        <button type="button" class="btn btn-green" data-review="publish" data-version="<?= e($version['id']) ?>" data-name="<?= e($plan['name'] ?? '') ?>"><span>อนุมัติและเผยแพร่</span></button>
      </div>
    </div>
  <?php endforeach; ?>
  </div>
<?php endif; ?>
<dialog id="review-modal" aria-labelledby="review-modal-title">
  <div class="bg-white rounded-2xl p-6 w-[min(32rem,calc(100vw-2rem))] space-y-3">
    <h3 id="review-modal-title" class="font-black"></h3>
    <div id="review-error" role="alert" hidden class="alert-red"></div>
    <p class="text-xs">แพ็กเกจ: <strong id="review-plan"></strong></p>
    <div><label class="label" for="review-reason">เหตุผลและบันทึกการตรวจสอบ (จะถูกบันทึกลงใน Audit Log):</label><textarea id="review-reason" rows="3" class="input"></textarea></div>
    <div class="flex justify-end gap-2"><button type="button" class="btn btn-soft" data-dialog-close>ยกเลิก</button><button type="button" class="btn btn-primary" id="review-confirm" disabled>ยืนยัน</button></div>
  </div>
</dialog>
