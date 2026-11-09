<?php
$badge = function (string $label, string $status, string $covered = 'bg-emerald-50 text-emerald-800 border border-emerald-200') {
    [$class, $text] = match ($status) {
        'covered' => [$covered, 'คุ้มครอง'],
        'optional' => ['bg-amber-50 text-amber-800 border border-amber-200', 'ซื้อเพิ่มได้'],
        'unknown' => ['bg-slate-100 text-slate-600 border border-slate-200', 'ยังไม่ระบุ'],
        default => ['bg-red-50 text-red-700 border border-red-200', 'ไม่คุ้มครอง'],
    };
    return "<span class=\"badge $class\">" . e($label) . ": $text</span>";
};
$pageLink = function (int $page) use ($filters) {
    $query = $_GET;
    unset($query['partial']);
    $query['page'] = $page;
    return url('/search') . '?' . http_build_query($query);
};
?>
<div data-total="<?= $results['totalCount'] ?>" data-active="<?= $activeCount ?>">
<?php if (!$results['items']): ?>
  <div class="card p-10 text-center">
    <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3"><?= icon('search', 'w-6 h-6') ?></div>
    <h3 class="font-black">ไม่พบแพ็กเกจที่ตรงตามเงื่อนไข</h3>
    <p class="text-xs text-slate-500 mt-1">ลองปรับลดเงื่อนไขตัวกรอง เช่น ขยายช่วงเบี้ย หรือเลือกไม่บังคับความคุ้มครองบางรายการ</p>
  </div>
<?php else: ?>
  <div class="flex flex-wrap justify-between gap-2 mb-3 text-[11px] text-slate-500">
    <span aria-live="polite">แสดง <?= count($results['items']) ?> จากทั้งหมด <?= $results['totalCount'] ?> รายการ</span>
    <span>(คลิกปุ่ม &quot;เปรียบเทียบ&quot; เพื่อเลือกเทียบได้สูงสุด 4 รายการ)</span>
  </div>
  <div class="space-y-3">
  <?php foreach ($results['items'] as $item):
      $compulsory = match ($item['compulsoryIncluded']) { 'included' => 'รวม พ.ร.บ.', 'unspecified' => 'ยังไม่ระบุ พ.ร.บ.', default => 'ไม่รวม พ.ร.บ.' };
      $status = array_column($item['coverages'], 'status', 'code');
      $sum = $item['sumInsuredMax'] ?: $item['sumInsuredMin'];
      $scope = match ($item['scopeType']) {
          'specific_model' => trim("เฉพาะ {$item['vehicleBrand']} {$item['vehicleModel']}"),
          'unknown' => 'ยังไม่ระบุขอบเขตรุ่นรถ',
          default => 'รองรับรถอายุ ' . format_car_age_range($item['minCarAge'], $item['maxCarAge']),
      };
  ?>
    <article class="card p-4 space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap gap-1.5 mb-1">
            <span class="badge bg-slate-900 text-white"><?= e($item['insurerName']) ?></span>
            <span class="badge bg-blue-100 text-blue-800"><?= e($item['insuranceType']) ?></span>
            <span class="badge <?= $item['repairType'] === 'dealer' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700' ?>"><?= $item['repairType'] === 'dealer' ? 'ซ่อมห้าง (ศูนย์)' : 'ซ่อมอู่' ?></span>
            <?php if (($item['registrationZone'] ?? 'all') !== 'all'): ?><span class="badge bg-amber-100 text-amber-800"><?= e(format_zone_label($item['registrationZone'], true)) ?></span><?php endif; ?>
          </div>
          <h3 class="font-black text-sm"><?= e($item['planName']) ?></h3>
          <p class="text-xs text-slate-500"><?= e($item['priceOptionLabel']) ?></p>
        </div>
        <button type="button" class="btn btn-outline" data-compare-toggle="<?= e($item['id']) ?>" aria-pressed="false"><?= icon('plus', 'w-3.5 h-3.5') ?><span>เปรียบเทียบ</span></button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div class="bg-slate-50 rounded-xl p-3">
          <span class="block text-[11px] text-slate-500">เบี้ยประกันรวม</span>
          <?php if ($item['premiumTotal'] === null): ?>
            <span class="block font-bold text-amber-700">ยังไม่มีข้อมูลราคา</span><span class="block text-[11px] text-slate-500">ต้องติดต่อบริษัทเพื่อเช็คเบี้ย • <?= $compulsory ?></span>
          <?php else: ?>
            <div class="flex items-baseline gap-1"><span class="text-xl font-black text-blue-700">฿<?= money($item['premiumTotal']) ?></span><span class="text-[11px] text-slate-500">/ปี</span></div>
            <div class="flex flex-wrap gap-1 text-[11px] text-slate-500">
              <?php if ($item['priceType'] === 'starting'): ?><span class="badge bg-amber-50 text-amber-800">ราคาเริ่มต้น</span><?php endif; ?>
              <?php if ($item['priceType'] === 'indicative'): ?><span class="badge bg-amber-50 text-amber-800">ราคาประมาณการ</span><?php endif; ?>
              <span><?= $compulsory ?></span>
            </div>
          <?php endif; ?>
        </div>
        <div class="bg-slate-50 rounded-xl p-3">
          <span class="block text-[11px] text-slate-500">ทุนประกันภัย</span>
          <div class="font-black text-sm"><?= $sum ? '฿' . money($sum) : '<span class="text-amber-700">ยังไม่ระบุทุน</span>' ?></div>
          <span class="block text-[11px] text-slate-500"><?= e($scope) ?></span>
        </div>
        <div class="bg-slate-50 rounded-xl p-3">
          <span class="block text-[11px] text-slate-500">ค่าเสียหายส่วนแรก (Deductible)</span>
          <div class="font-black text-sm"><?= $item['deductibleAmount'] > 0 ? '<span class="text-red-700">฿' . money($item['deductibleAmount']) . '</span>' : '<span class="text-emerald-700">ไม่มี Deductible</span>' ?></div>
          <span class="block text-[11px] text-slate-500"><?= e($item['deductibleTerms'] ?: 'กรณีเกิดเหตุเป็นฝ่ายถูกไม่ต้องจ่าย') ?></span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="font-bold text-slate-600">ความคุ้มครองหลัก:</span>
        <?= $badge('ชนตัวรถ', $status['own_damage'] ?? 'unknown') ?>
        <?= $badge('พลิกคว่ำ/ตกทาง', $status['rollover_offroad'] ?? 'unknown') ?>
        <?= $badge('รถหาย/ไฟไหม้', $status['theft_fire'] ?? 'unknown') ?>
        <?= $badge('น้ำท่วม', $status['flood'] ?? 'unknown', 'bg-blue-50 text-blue-800 border border-blue-200') ?>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <div class="flex flex-wrap items-center gap-1.5">
          <span><?= $item['documents'] ? 'มีเอกสารอ้างอิง (' . count($item['documents']) . ')' : 'รอแนบเอกสาร' ?></span>
          <?php if ($item['verifiedAt']): ?><span>• ตรวจทานเมื่อ <?= thai_date($item['verifiedAt']) ?></span><?php endif; ?>
        </div>
        <a class="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline" href="<?= e(url("/plans/{$item['planId']}?optionId={$item['id']}")) ?>"><span>ดูรายละเอียดเต็ม</span><?= icon('chevron-right', 'w-3.5 h-3.5') ?></a>
      </div>
    </article>
  <?php endforeach; ?>
  </div>
  <?php if ($results['totalPages'] > 1): ?>
    <nav aria-label="เลือกหน้าผลการค้นหา" class="flex flex-wrap justify-center gap-1 mt-4">
      <?php for ($p = 1; $p <= $results['totalPages']; $p++): ?>
        <a href="<?= e($pageLink($p)) ?>" data-page="<?= $p ?>" aria-label="หน้า <?= $p ?>" <?= $p === $results['page'] ? 'aria-current="page"' : '' ?> class="btn <?= $p === $results['page'] ? 'btn-primary' : 'btn-outline' ?>"><?= $p ?></a>
      <?php endfor; ?>
    </nav>
  <?php endif; ?>
<?php endif; ?>
</div>
