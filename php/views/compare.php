<?php
if (!$data || count($data['options']) < 2): ?>
  <div class="card max-w-lg mx-auto mt-10 p-8 text-center space-y-3" data-compare-empty>
    <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><?= icon('columns-3', 'w-6 h-6') ?></div>
    <h2 class="text-lg font-black">กรุณาเลือกตัวเลือกประกัน 2 ถึง 4 รายการ</h2>
    <p class="text-xs text-slate-500">ไปที่หน้าค้นหาประกัน และกดปุ่ม <span class="font-bold">&quot;+ เปรียบเทียบ&quot;</span> เพื่อสร้างใบเสนอราคาและตารางเปรียบเทียบเงื่อนไข</p>
    <a href="<?= e(url('/search')) ?>" class="btn btn-primary"><?= icon('arrow-left', 'w-3.5 h-3.5') ?><span>กลับไปหน้าค้นหาและเลือกแพ็กเกจ</span></a>
  </div>
<?php return; endif;

['options' => $options, 'warnings' => $warnings, 'categories' => $categories] = $data;
$distinct = fn(callable $fn) => count(array_unique(array_map($fn, $options), SORT_REGULAR));
$sumOf = fn($o) => $o['sumInsuredMax'] ?? $o['sumInsuredMin'];
$hasPlateLimit = (bool) array_filter($options, fn($o) => ($o['registrationZone'] ?? 'all') !== 'all');
$repairLabel = fn($o) => $o['repairType'] === 'dealer' ? 'ซ่อมห้าง (ศูนย์บริการ)' : 'ซ่อมอู่ (อู่ในเครือ)';

// Differences (never map a null sum insured to 0)
$coreSpecs = [
    ['ทุนประกันภัย (บาท)', $distinct(fn($o) => $sumOf($o) ?? 'UNKNOWN') > 1, fn($o) => $sumOf($o) !== null ? '<span class="font-bold">฿' . money($sumOf($o)) . '</span>' : '<span class="text-amber-700">ยังไม่ระบุทุน</span>'],
    ['ลักษณะการซ่อม', $distinct(fn($o) => $o['repairType']) > 1, fn($o) => e($repairLabel($o))],
    ['ค่าเสียหายส่วนแรก (Deductible)', $distinct(fn($o) => $o['deductibleAmount']) > 1, fn($o) => $o['deductibleAmount'] > 0 ? '<span class="text-red-700 font-bold">฿' . money($o['deductibleAmount']) . ' บาท (เมื่อเป็นฝ่ายผิด)</span>' : '<span class="text-emerald-700">ไม่มี (฿0)</span>'],
    ['เงื่อนไขผู้ขับขี่', $distinct(fn($o) => $o['driverConditions'] ?: 'ไม่จำกัดชื่อผู้ขับขี่') > 1, fn($o) => e($o['driverConditions'] ?: 'ไม่จำกัดชื่อผู้ขับขี่')],
    ['พ.ร.บ. คุ้มครองผู้ประสบภัย', $distinct(fn($o) => $o['compulsoryIncluded']) > 1, fn($o) => match ($o['compulsoryIncluded']) { 'included' => 'รวมในเบี้ยแล้ว', 'unspecified' => 'ยังไม่ระบุ', default => 'ไม่รวม พ.ร.บ.' }],
    ['เงื่อนไขอายุ รุ่นรถ และป้ายทะเบียน',
        $distinct(fn($o) => "{$o['scopeType']}:{$o['vehicleModelId']}:{$o['minCarAge']}-{$o['maxCarAge']}:" . ($o['registrationZone'] ?? 'all')) > 1,
        function ($o) use ($hasPlateLimit) {
            $base = match ($o['scopeType']) {
                'specific_model' => trim("เฉพาะ {$o['vehicleBrand']} {$o['vehicleModel']}"),
                'unknown' => 'ยังไม่ระบุขอบเขตรุ่นรถ',
                default => 'รถทั่วไปอายุ ' . format_car_age_range($o['minCarAge'], $o['maxCarAge']),
            };
            $zone = $o['registrationZone'] ?? 'all';
            $suffix = $zone !== 'all' ? '<span class="text-amber-700 font-bold"> • ' . e(format_zone_label($zone, true)) . '</span>' : ($hasPlateLimit ? ' • ทุกป้ายทะเบียน' : '');
            return e($base) . $suffix;
        }],
];

// Header summary
$usages = array_unique(array_map(fn($o) => $o['usageType'] ?: 'private', $options));
$zones = array_unique(array_map(fn($o) => $o['registrationZone'] ?: 'all', $options));
$usage = count($usages) === 1
    ? match ($options[0]['usageType']) { 'commercial' => 'รถยนต์เชิงพาณิชย์ / รับจ้าง', 'all' => 'รองรับทุกรูปแบบการใช้งาน', default => 'รถยนต์ใช้งานส่วนบุคคล' }
    : 'แตกต่างกันตามแต่ละแผน';
if ($hasPlateLimit) $usage .= count($zones) === 1 ? ' (' . format_zone_label($options[0]['registrationZone'], true) . ')' : ' (จำกัดป้ายบางแผน)';
$scopes = array_values(array_unique(array_map(fn($o) => match ($o['scopeType']) {
    'specific_model' => trim("เฉพาะ {$o['vehicleBrand']} {$o['vehicleModel']}"), 'unknown' => 'ยังไม่ระบุขอบเขตรุ่นรถ', default => 'รองรับทุกรุ่นภายใต้เงื่อนไข',
}, $options)));
$scope = count($scopes) === 1 ? $scopes[0] : 'ตามเงื่อนไขแต่ละแผน (ดูในตาราง)';
$ages = array_values(array_unique(array_map(fn($o) => 'อายุ ' . format_car_age_range($o['minCarAge'], $o['maxCarAge']), $options)));
$age = count($ages) === 1 ? $ages[0] : 'แตกต่างกันตามแต่ละแผน';
$inspected = count(array_filter($options, fn($o) => $o['inspectionRequired']));
$inspection = $inspected === count($options) ? 'ต้องตรวจสภาพรถก่อนทำประกัน' : ($inspected === 0 ? 'ไม่ต้องตรวจสภาพรถ' : 'ขึ้นอยู่กับแผนที่เลือก');

// The quote is good for 30 days, but never past the day any compared price or plan version ends.
$today = bangkok_date(0);
$validity = quote_validity($today, array_merge(array_column($options, 'priceValidTo'), array_column($options, 'versionEffectiveTo')));
$todayThai = thai_long_date($today);
$validUntil = thai_long_date($validity['until']);
$now = new DateTimeImmutable($today, bangkok_tz());
$quotationNo = 'QT-' . thai_year($now) . $now->format('md') . '-' . substr($options[0]['id'], -4);
$count = count($options);
?>
<div class="no-print flex flex-wrap items-center justify-between gap-3 mb-4">
  <div class="flex items-center gap-2 text-xs text-slate-500">
    <a href="<?= e(url('/search')) ?>" class="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"><?= icon('arrow-left', 'w-3.5 h-3.5') ?><span>กลับไปหน้าค้นหา</span></a><span>•</span><span><?= $count ?> แผนประกัน</span>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class="btn btn-outline" data-only-diff aria-pressed="false"><?= icon('sparkles', 'w-3.5 h-3.5') ?><span>เน้นเฉพาะจุดต่าง</span></button>
    <?php if ($warnings): ?><button type="button" class="btn btn-outline" data-warnings-toggle aria-expanded="false" aria-controls="compare-warnings"><?= icon('triangle-alert', 'w-3.5 h-3.5') ?><span>ข้อสังเกต (<?= count($warnings) ?>)</span></button><?php endif; ?>
    <button type="button" class="btn btn-dark" data-print><?= icon('printer', 'w-3.5 h-3.5') ?><span>พิมพ์ใบเสนอราคา (A4 1 หน้า)</span></button>
    <button type="button" class="btn btn-soft" data-compare-clear title="ล้างการเปรียบเทียบ" aria-label="ล้างการเปรียบเทียบและกลับไปหน้าค้นหา"><?= icon('rotate-ccw', 'w-3.5 h-3.5') ?></button>
  </div>
</div>
<?php if ($warnings): ?>
  <div id="compare-warnings" hidden class="no-print card border-amber-200 bg-amber-50 p-4 mb-4">
    <div class="flex justify-between gap-2 mb-2"><span class="font-black text-xs text-amber-900">ข้อสังเกตความแตกต่างที่สำคัญ</span><button type="button" data-warnings-toggle class="text-[11px] font-bold text-amber-800 cursor-pointer">ปิดแถบนี้</button></div>
    <div class="grid sm:grid-cols-2 gap-2">
      <?php foreach ($warnings as $w): ?><div class="bg-white/70 rounded-xl p-2.5 text-xs"><span class="block font-bold text-slate-800"><?= e($w['title']) ?></span><span class="text-slate-600"><?= e($w['message']) ?></span></div><?php endforeach; ?>
    </div>
  </div>
<?php endif; ?>
<div class="a4-quotation-sheet card p-5 sm:p-7" data-compare-ids="<?= e(implode(',', array_column($options, 'id'))) ?>">
  <div class="flex flex-wrap justify-between gap-4 pb-3 border-b-2 border-slate-900">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><?= icon('shield', 'w-5 h-5') ?></div>
      <div>
        <div class="flex flex-wrap items-baseline gap-2"><span class="font-black text-lg">InsureDesk</span><span class="font-bold text-sm text-slate-700">ใบเสนอราคาประกันภัยรถยนต์</span></div>
        <p class="text-[11px] text-slate-500">ระบบจัดการและเปรียบเทียบข้อมูลประกันภัยรถยนต์ • ฝ่ายบริการข้อมูลลูกค้า</p>
      </div>
    </div>
    <div class="text-[11px] text-slate-600 text-right">
      <div><span>เลขที่ใบเสนอราคา: </span><span class="font-bold font-mono"><?= e($quotationNo) ?></span></div>
      <div><span>วันที่เสนอราคา: </span><span class="font-bold"><?= e($todayThai) ?></span></div>
      <div><span>การยืนยันราคา: </span>
        <?php if ($validity['days'] < 0): ?><span class="font-bold text-red-700">ราคาบางแผนหมดอายุแล้ว (สิ้นสุด <?= e($validUntil) ?>)</span>
        <?php else: ?><span class="font-bold"><?= $validity['days'] === 0 ? 'ถึงสิ้นวันนี้' : "{$validity['days']} วัน" ?> (ถึงวันที่ <?= e($validUntil) ?><?= $validity['capped'] ? ' ตามวันสิ้นสุดราคาของแผน' : '' ?>)</span><?php endif; ?>
      </div>
    </div>
  </div>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 text-[11px]">
    <?php foreach (['ประเภทการใช้งาน:' => $usage, 'ขอบเขตรุ่นรถยนต์:' => $scope, 'อายุรถยนต์ที่รับประกัน:' => $age, 'การตรวจสภาพรถ:' => $inspection] as $label => $value): ?>
      <div><span class="block text-slate-500"><?= $label ?></span><span class="font-bold"><?= e($value) ?></span></div>
    <?php endforeach; ?>
  </div>
  <p class="no-print sm:hidden text-[11px] text-slate-500 mb-1">เลื่อนตารางไปด้านข้างเพื่อดูทุกตัวเลือก</p>
  <div class="overflow-x-auto">
    <table class="w-full table-fixed border-collapse text-[11px]" style="min-width: <?= 180 + $count * 150 ?>px">
      <colgroup><col style="width: 28%"><?php foreach ($options as $o): ?><col style="width: <?= 72 / $count ?>%"><?php endforeach; ?></colgroup>
      <thead>
        <tr>
          <th class="border border-slate-200 bg-slate-900 text-white p-2 text-left align-top"><span class="block font-black">รายการเปรียบเทียบ</span><span class="block font-normal text-slate-300">ความคุ้มครองและเงื่อนไข</span></th>
          <?php foreach ($options as $idx => $o):
              $sum = $sumOf($o);
              $compulsory = match ($o['compulsoryIncluded']) { 'included' => 'รวม พ.ร.บ.', 'unspecified' => 'ยังไม่ระบุ พ.ร.บ.', default => 'ไม่รวม พ.ร.บ.' };
          ?>
            <th class="border border-slate-200 bg-slate-50 p-2 text-left align-top font-normal">
              <div class="flex items-center justify-between gap-1">
                <span class="font-bold text-slate-500">ตัวเลือกที่ <?= $idx + 1 ?></span>
                <span class="flex items-center gap-1"><span class="badge bg-blue-100 text-blue-800"><?= e($o['insuranceType']) ?></span>
                  <?php if ($count > 2): ?><button type="button" class="no-print text-slate-400 hover:text-red-600 cursor-pointer" data-compare-remove="<?= e($o['id']) ?>" title="นำตัวเลือกนี้ออก" aria-label="นำตัวเลือกที่ <?= $idx + 1 ?> (<?= e($o['planName']) ?>) ออก"><?= icon('x', 'w-3.5 h-3.5') ?></button><?php endif; ?></span>
              </div>
              <div class="font-black text-xs mt-1"><?= e($o['insurerName']) ?></div>
              <div class="text-slate-600"><?= e($o['planName']) ?></div>
              <div class="mt-1"><span class="block text-slate-500">เบี้ยประกันภัยรวม (<?= $compulsory ?>)</span>
                <div class="text-base font-black text-blue-700"><?= $o['premiumTotal'] !== null ? '฿' . money($o['premiumTotal']) : '<span class="text-amber-700 text-xs">ยังไม่มีข้อมูลราคา</span>' ?></div>
                <span class="text-slate-500"><?= e($repairLabel($o)) ?></span></div>
              <div class="font-bold mt-0.5"><?= $sum !== null ? 'ทุนประกัน ฿' . money($sum) . ' บาท' : 'ยังไม่ระบุทุนประกัน' ?></div>
            </th>
          <?php endforeach; ?>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="<?= $count + 1 ?>" class="border border-slate-200 bg-blue-50 p-1.5 font-black text-blue-900">1. ข้อมูลพื้นฐานและเงื่อนไขราคา (Pricing &amp; Basic Conditions)</td></tr>
        <?php foreach ($coreSpecs as [$label, $different, $render]): ?>
          <tr <?= $different ? '' : 'data-same' ?>>
            <td class="border border-slate-200 p-1.5 font-semibold"><?= e($label) ?><?php if ($different): ?> <span class="no-print badge bg-amber-100 text-amber-800">ต่างกัน</span><?php endif; ?></td>
            <?php foreach ($options as $o): ?><td class="border border-slate-200 p-1.5"><?= $render($o) ?></td><?php endforeach; ?>
          </tr>
        <?php endforeach; ?>
        <?php foreach ($categories as $cIdx => $cat): $anyDiff = (bool) array_filter($cat['items'], fn($i) => $i['hasDifference']); ?>
          <tr <?= $anyDiff ? '' : 'data-same' ?>><td colspan="<?= $count + 1 ?>" class="border border-slate-200 bg-blue-50 p-1.5 font-black text-blue-900"><?= $cIdx + 2 ?>. หมวดความคุ้มครอง: <?= e($cat['name']) ?></td></tr>
          <?php foreach ($cat['items'] as $item): ?>
            <tr <?= $item['hasDifference'] ? '' : 'data-same' ?>>
              <td class="border border-slate-200 p-1.5 font-semibold"><?= e($item['name']) ?><?php if ($item['hasDifference']): ?> <span class="no-print badge bg-amber-100 text-amber-800">ต่างกัน</span><?php endif; ?></td>
              <?php foreach ($options as $o): $v = $item['values'][$o['id']]; ?>
                <td class="border border-slate-200 p-1.5">
                  <?php if ($v['status'] === 'covered'): ?><span class="text-emerald-800 font-semibold"><?= e($v['text']) ?></span>
                  <?php elseif ($v['status'] === 'not_covered'): ?><span class="text-red-700">ไม่คุ้มครอง</span>
                  <?php elseif ($v['status'] === 'optional'): ?><span class="text-amber-700"><?= e($v['text']) ?></span>
                  <?php else: ?><span class="text-slate-400">ยังไม่ระบุ</span><?php endif; ?>
                </td>
              <?php endforeach; ?>
            </tr>
          <?php endforeach; ?>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="mt-3 space-y-3 text-[10px] text-slate-600">
    <div>
      <p class="font-bold text-slate-800">หมายเหตุและเงื่อนไขประกอบใบเสนอราคา:</p>
      <p>1. เบี้ยประกันภัยและทุนประกันภัยข้างต้นเป็นราคาที่รวมภาษีอากรและ พ.ร.บ. ตามเงื่อนไขที่ระบุแล้ว</p>
      <p>2. ความคุ้มครอง ข้อยกเว้น และเงื่อนไขการเรียกร้องค่าเสียหายเป็นไปตามกรมธรรม์ประกันภัยของแต่ละบริษัทประกันภัยที่ได้รับความเห็นชอบจาก คปภ.</p>
      <p>3. ใบเสนอราคานี้ใช้สำหรับเปรียบเทียบข้อมูลภายในทีม InsureDesk เพื่อเสนอแนะแก่ลูกค้า ขอสงวนสิทธิ์ในการเปลี่ยนแปลงตามผลการตรวจสภาพรถหรือประวัติการขับขี่</p>
    </div>
    <div class="grid grid-cols-2 gap-6">
      <div class="text-center"><span class="block font-bold text-slate-800">ผู้จัดทำใบเสนอราคา (Advisor)</span><div class="h-8 border-b border-dotted border-slate-400 mx-6"></div><span class="block mt-1">( <?= e($session['name']) ?> / ทีม InsureDesk )</span><span class="block">วันที่: <?= e($todayThai) ?></span></div>
      <div class="text-center"><span class="block font-bold text-slate-800">ผู้ขอเอาประกันภัย / ลูกค้า (Customer Acceptance)</span>
        <div class="flex flex-wrap justify-center gap-3 my-1"><?php foreach ($options as $i => $o): ?><span class="inline-flex items-center gap-1"><span aria-hidden="true" class="w-2.5 h-2.5 border border-slate-500 inline-block"></span><span>เลือกตัวเลือกที่ <?= $i + 1 ?></span></span><?php endforeach; ?></div>
        <span class="block mt-2">ลงชื่อ: ................................................................</span><span class="block">วันที่: ........ / ........ / <?= thai_year($now) ?></span></div>
    </div>
  </div>
</div>
