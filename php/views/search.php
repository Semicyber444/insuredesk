<?php
$selected = fn(string $key, $value) => in_array($value, $filters[$key] ?? [], true) ? 'checked' : '';
$val = fn(string $key) => e($filters[$key] ?? '');
$categories = group_by($coverageTypes, 'category');
$brands = array_values(array_unique(array_column($vehicleModels, 'brand')));
$is = fn(string $key, string $value) => ($filters[$key] ?? '') === $value ? 'selected' : '';
?>
<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
  <div>
    <h1 class="page-title">ค้นหาและเปรียบเทียบประกันภัยรถยนต์</h1>
    <p class="page-sub">ฐานข้อมูลเงื่อนไขและราคาอ้างอิงภายในทีม เฉพาะแพ็กเกจที่ผ่านการอนุมัติเผยแพร่แล้ว</p>
  </div>
  <label class="flex items-center gap-2 text-xs font-semibold text-slate-600"><span>เรียงตาม:</span>
    <select name="sortBy" form="filter-form" aria-label="เรียงตาม" class="input w-auto">
      <option value="premium_asc" <?= $is('sortBy', 'premium_asc') ?>>เบี้ยประกันรวม: ต่ำไปสูง</option>
      <option value="premium_desc" <?= $is('sortBy', 'premium_desc') ?>>เบี้ยประกันรวม: สูงไปต่ำ</option>
      <option value="sum_insured_desc" <?= $is('sortBy', 'sum_insured_desc') ?>>ทุนประกัน: มากไปน้อย</option>
      <option value="name_asc" <?= $is('sortBy', 'name_asc') ?>>ชื่อบริษัทประกัน (ก-ฮ)</option>
    </select>
  </label>
</div>
<div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
  <aside aria-label="ตัวกรองค้นหา" class="card p-4">
    <div class="flex items-center justify-between gap-2">
      <button type="button" data-filter-toggle aria-expanded="false" aria-controls="filter-panel" class="lg:hidden flex items-center gap-1.5 font-bold text-sm cursor-pointer">
        <span>ตัวกรองค้นหา</span><span id="filter-active" class="badge bg-blue-100 text-blue-800" <?= $activeCount ? '' : 'hidden' ?>>ใช้อยู่ <span><?= $activeCount ?></span></span><?= icon('chevron-down') ?>
      </button>
      <div class="hidden lg:flex items-center gap-2"><span class="font-black text-sm">ตัวกรองค้นหา</span><span class="text-[11px] text-slate-500">พบ <span id="filter-total" class="font-bold text-blue-700"><?= $results['totalCount'] ?></span> รายการ</span></div>
      <a href="<?= e(url('/search')) ?>" data-filter-reset class="text-[11px] font-bold text-blue-600 hover:underline">ล้างค่า</a>
    </div>
    <form id="filter-form" method="get" action="<?= e(url('/search')) ?>" class="hidden lg:block mt-3 space-y-4" data-panel>
      <input type="hidden" name="page" value="1">
      <div><label class="label" for="filter-query">ค้นหาชื่อบริษัท หรือ แพ็กเกจ</label><input class="input" id="filter-query" name="query" type="text" placeholder="เช่น วิริยะ, BKI, ซ่อมห้าง..." value="<?= $val('query') ?>"></div>
      <div>
        <span class="label" id="filter-insurance-types">ประเภทประกันภัย</span>
        <div role="group" aria-labelledby="filter-insurance-types" class="flex flex-wrap gap-1.5">
          <?php foreach (INSURANCE_TYPES as $type): ?><label class="chip"><input class="sr-only" type="checkbox" name="insuranceTypes[]" value="<?= e($type) ?>" <?= $selected('insuranceTypes', $type) ?>><?= e($type) ?></label><?php endforeach; ?>
        </div>
      </div>
      <div>
        <span class="label" id="filter-repair-types">ลักษณะการซ่อม</span>
        <div role="group" aria-labelledby="filter-repair-types" class="space-y-1.5">
          <?php foreach (['dealer' => 'ซ่อมห้าง (ศูนย์บริการ)', 'garage' => 'ซ่อมอู่ (อู่ในเครือ)'] as $value => $label): ?><label class="check-row"><input type="checkbox" name="repairTypes[]" value="<?= $value ?>" <?= $selected('repairTypes', $value) ?>><span><?= $label ?></span></label><?php endforeach; ?>
        </div>
      </div>
      <div>
        <span class="label" id="filter-insurers">บริษัทประกันภัย</span>
        <div role="group" aria-labelledby="filter-insurers" class="space-y-1.5 max-h-40 overflow-y-auto">
          <?php foreach ($insurers as $ins): ?><label class="check-row"><input type="checkbox" name="insurerIds[]" value="<?= e($ins['id']) ?>" <?= $selected('insurerIds', $ins['id']) ?>><span><?= e($ins['name']) ?></span></label><?php endforeach; ?>
        </div>
      </div>
      <div class="space-y-3 pt-3 border-t border-slate-100">
        <div><label class="label" for="filter-vehicleBrand">ยี่ห้อรถยนต์</label>
          <select class="input" id="filter-vehicleBrand" name="vehicleBrand"><option value="">ทุกยี่ห้อ / ไม่ระบุ</option><?php foreach ($brands as $brand): ?><option value="<?= e($brand) ?>" <?= $is('vehicleBrand', $brand) ?>><?= e($brand) ?></option><?php endforeach; ?></select></div>
        <div><label class="label" for="filter-vehicleModelId">รุ่นรถยนต์</label>
          <select class="input" id="filter-vehicleModelId" name="vehicleModelId"><option value="">ทุกรุ่น / ไม่ระบุ</option><?php foreach ($vehicleModels as $vm): ?><option value="<?= e($vm['id']) ?>" data-brand="<?= e($vm['brand']) ?>" <?= $is('vehicleModelId', $vm['id']) ?>><?= e("{$vm['brand']} {$vm['model']} (" . ($vm['variant'] ?: ($vm['powertrain'] ?: 'ทั่วไป')) . ')') ?></option><?php endforeach; ?></select></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="filter-carAge">อายุรถ (ปี)</label><input class="input" id="filter-carAge" name="carAge" type="number" min="0" max="35" placeholder="เช่น 3 ปี" value="<?= $val('carAge') ?>"></div>
          <div><label class="label" for="filter-usageType">การใช้งาน</label><select class="input" id="filter-usageType" name="usageType"><option value="">ทั้งหมด</option><option value="private" <?= $is('usageType', 'private') ?>>ส่วนบุคคล</option><option value="commercial" <?= $is('usageType', 'commercial') ?>>เชิงพาณิชย์</option></select></div>
        </div>
        <div><label class="label" for="filter-registrationPlate">ป้ายทะเบียนรถ</label>
          <select class="input" id="filter-registrationPlate" name="registrationPlate">
            <option value="">ทุกป้ายทะเบียน / ไม่ระบุ</option>
            <option value="bangkok" <?= $is('registrationPlate', 'bangkok') ?>>รถป้าย กทม. (แสดงแผนที่รับรถ กทม.)</option>
            <option value="metro" <?= $is('registrationPlate', 'metro') ?>>รถป้ายปริมณฑล</option>
            <option value="upcountry" <?= $is('registrationPlate', 'upcountry') ?>>รถป้ายต่างจังหวัด (ตจว.)</option>
            <option value="bangkok_only_strict" <?= $is('registrationPlate', 'bangkok_only_strict') ?>>ดูเฉพาะแผนจำกัดป้าย กทม. เท่านั้น</option>
          </select></div>
      </div>
      <div class="space-y-3 pt-3 border-t border-slate-100">
        <div>
          <span class="label" id="filter-premium-range">ช่วงเบี้ยรวม (บาท)</span>
          <div role="group" aria-labelledby="filter-premium-range" class="grid grid-cols-2 gap-2">
            <input class="input" type="number" min="0" name="minPremium" placeholder="ต่ำสุด" aria-label="เบี้ยรวมต่ำสุด (บาท)" value="<?= $val('minPremium') ?>">
            <input class="input" type="number" min="0" name="maxPremium" placeholder="สูงสุด" aria-label="เบี้ยรวมสูงสุด (บาท)" value="<?= $val('maxPremium') ?>">
          </div>
          <label class="check-row mt-2"><input type="checkbox" name="includeUnknownPrice" value="1" <?= !empty($filters['includeUnknownPrice']) ? 'checked' : '' ?>><span>รวมแผนที่ยังไม่ระบุราคา</span></label>
        </div>
        <div>
          <span class="label" id="filter-sum-range">ช่วงทุนประกัน (บาท)</span>
          <div role="group" aria-labelledby="filter-sum-range" class="grid grid-cols-2 gap-2">
            <input class="input" type="number" min="0" step="50000" name="minSumInsured" placeholder="ทุนต่ำสุด" aria-label="ทุนประกันต่ำสุด (บาท)" value="<?= $val('minSumInsured') ?>">
            <input class="input" type="number" min="0" step="50000" name="maxSumInsured" placeholder="ทุนสูงสุด" aria-label="ทุนประกันสูงสุด (บาท)" value="<?= $val('maxSumInsured') ?>">
          </div>
        </div>
      </div>
      <div class="pt-3 border-t border-slate-100">
        <span class="label" id="filter-coverages">ความคุ้มครองที่ต้องมี (<span id="coverage-count"><?= count($filters['requiredCoverageCodes'] ?? []) ?></span>)</span>
        <span class="block text-[11px] text-slate-500 mb-2">แผนต้องคุ้มครอง ไม่นับที่เป็นตัวเลือกซื้อเพิ่ม</span>
        <div role="group" aria-labelledby="filter-coverages" class="space-y-3">
          <?php foreach ($categories as $category => $types): ?>
            <div><span class="block text-[11px] font-bold text-slate-500 mb-1">หมวด<?= e($category) ?></span>
              <div class="space-y-1.5"><?php foreach ($types as $ct): ?><label class="check-row"><input type="checkbox" name="requiredCoverageCodes[]" value="<?= e($ct['code']) ?>" <?= $selected('requiredCoverageCodes', $ct['code']) ?>><span><?= e($ct['name']) ?></span></label><?php endforeach; ?></div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
      <noscript><button class="btn btn-primary w-full">ค้นหา</button></noscript>
    </form>
  </aside>
  <div>
    <div id="results" aria-busy="false"><?php require APP_ROOT . '/views/search_results.php'; ?></div>
    <div id="compare-dock" hidden class="no-print sticky bottom-3 mt-4 z-20 card shadow-xl border-blue-200 p-3 flex flex-wrap items-center justify-between gap-3"></div>
  </div>
</div>
<script type="application/json" id="compare-pool"><?= json_encode($poolSummary, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
