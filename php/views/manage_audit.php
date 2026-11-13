<div class="mb-5"><h1 class="page-title"><?= icon('history', 'w-6 h-6 text-blue-600') ?><span>บันทึกประวัติการเปลี่ยนแปลง (Audit Logs)</span></h1><p class="page-sub">บันทึกการส่งตรวจ การเผยแพร่ การจัดเก็บเข้ากรุ และการแก้ไขทุกรายการเพื่อความโปร่งใสและตรวจสอบย้อนหลังได้ (เรียงจากล่าสุด ประวัติของแต่ละแพ็กเกจดูได้ในหน้าแพ็กเกจนั้นด้วย)</p></div>
<div class="card">
  <?php if (!$logs): ?><div class="p-8 text-center text-xs text-slate-500">ยังไม่มีประวัติการเปลี่ยนแปลง</div>
  <?php else: ?><div id="audit-list" class="divide-y divide-slate-100"><?php require APP_ROOT . '/views/audit_rows.php'; ?></div><?php endif; ?>
</div>
<div class="text-center mt-4" id="audit-more-wrap" <?= $hasMore ? '' : 'hidden' ?>><button type="button" id="audit-more" class="btn btn-outline">โหลดเพิ่ม</button></div>
