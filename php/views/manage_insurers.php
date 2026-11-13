<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
  <div><h1 class="page-title"><?= icon('building-2', 'w-6 h-6 text-blue-600') ?><span>จัดการบริษัทประกันภัย (Insurers)</span></h1><p class="page-sub">ข้อมูลบริษัทและช่องทางติดต่อเพื่อประสานงานเช็คเบี้ย</p></div>
  <button type="button" class="btn btn-primary" data-insurer-create><?= icon('plus', 'w-3.5 h-3.5') ?><span>เพิ่มบริษัทประกัน</span></button>
</div>
<div id="status-notice" role="status" hidden class="notice mb-3"></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
  <?php foreach ($insurers as $ins): ?>
    <div class="card p-4 flex justify-between gap-3">
      <div class="min-w-0 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2"><h3 class="font-black text-sm"><?= e($ins['name']) ?></h3><span class="badge <?= $ins['is_active'] ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700' ?>"><?= $ins['is_active'] ? 'เปิดใช้งาน' : 'ปิดใช้งาน' ?></span></div>
        <div class="flex items-center gap-1.5 text-xs text-slate-600"><?= icon('phone', 'w-3.5 h-3.5 shrink-0') ?><span><?= e($ins['contact_channels'] ?: 'ไม่มีข้อมูลติดต่อ') ?></span></div>
        <?php if ($ins['website']): ?><div class="flex items-center gap-1.5 text-xs"><?= icon('globe', 'w-3.5 h-3.5 shrink-0 text-slate-500') ?><a class="text-blue-600 hover:underline break-all" href="<?= e($ins['website']) ?>" target="_blank" rel="noreferrer"><span><?= e($ins['website']) ?></span></a></div><?php endif; ?>
      </div>
      <div class="flex items-start gap-1 shrink-0">
        <button type="button" class="btn btn-outline" data-insurer-edit="<?= e(json_encode(array_intersect_key($ins, array_flip(['id', 'name', 'contact_channels', 'website', 'is_active'])), JSON_UNESCAPED_UNICODE)) ?>"><?= icon('pencil', 'w-3.5 h-3.5') ?><span>แก้ไข</span></button>
        <button type="button" class="btn btn-red" title="ลบหรือปิดการใช้งาน" aria-label="ลบหรือปิดการใช้งาน" data-insurer-delete="<?= e($ins['id']) ?>" data-name="<?= e($ins['name']) ?>"><?= icon('trash-2', 'w-3.5 h-3.5') ?></button>
      </div>
    </div>
  <?php endforeach; ?>
</div>
<dialog id="insurer-modal" aria-labelledby="insurer-modal-title">
  <form id="insurer-form" class="bg-white rounded-2xl p-6 w-[min(28rem,calc(100vw-2rem))] space-y-3">
    <h3 id="insurer-modal-title" class="font-black"></h3>
    <div id="insurer-error" role="alert" hidden class="alert-red"></div>
    <div><label class="label" for="insurer-name">ชื่อบริษัทประกัน *</label><input class="input" id="insurer-name" type="text" required placeholder="เช่น สินมั่นคงประกันภัย"></div>
    <div><label class="label" for="insurer-contact">ช่องทางติดต่อ / Call Center</label><input class="input" id="insurer-contact" type="text" placeholder="เช่น โทร 1596 หรือ 0-2xxx-xxxx"></div>
    <div><label class="label" for="insurer-website">เว็บไซต์ทางการ</label><input class="input" id="insurer-website" type="url" placeholder="https://www.example.com"></div>
    <label class="check-row" id="insurer-active-row"><input type="checkbox" id="insurer-active"><span>เปิดใช้งานบริษัทประกันนี้ในระบบค้นหา</span></label>
    <div class="flex justify-end gap-2"><button type="button" class="btn btn-soft" data-dialog-close>ยกเลิก</button><button type="submit" class="btn btn-primary">บันทึก</button></div>
  </form>
</dialog>
