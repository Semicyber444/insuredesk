<?php
$roles = $session['roles'];
$canEdit = has_permission($roles, 'canEditDraft');
$canSubmit = has_permission($roles, 'canSubmitReview');
$back = '<a href="' . e(url('/search')) . '" class="btn btn-primary">' . icon('arrow-left', 'w-3.5 h-3.5') . '<span>กลับไปหน้ารายการค้นหา</span></a>';
if (!$bundle): ?>
  <div class="card max-w-lg mx-auto mt-10 p-8 text-center space-y-3"><h2 class="text-lg font-black">ไม่พบแพ็กเกจที่ระบุ</h2><?= $back ?></div>
<?php return; endif;

$plan = $bundle['plan'];
$publishedVersions = array_values(array_filter($plan['versions'], fn($v) => $v['workflow_status'] === 'published'));
$isViewer = $roles[0] === 'viewer';
if ($isViewer && ($plan['is_archived'] || !$publishedVersions)): ?>
  <div class="card max-w-lg mx-auto mt-10 p-8 text-center space-y-3">
    <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><?= icon('shield-alert', 'w-6 h-6') ?></div>
    <h2 class="text-lg font-black">แพ็กเกจนี้ยังไม่เปิดเผยแพร่สำหรับฝ่ายขาย</h2>
    <p class="text-xs text-slate-500">เฉพาะผู้กรอกข้อมูล (Editor), ผู้ตรวจสอบ (Reviewer), และผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดูข้อมูลร่างหรือข้อมูลที่จัดเก็บเข้ากรุได้</p>
    <?= $back ?>
  </div>
<?php return; endif;

$visibleVersions = $plan['versions'];
$activeVersion = null;
foreach ($visibleVersions as $v) if ($v['id'] === ($_GET['version'] ?? null)) $activeVersion = $v;
$activeVersion ??= $publishedVersions[0] ?? $visibleVersions[0] ?? null;
$vid = $activeVersion['id'] ?? null;
$rules = array_values(array_filter($bundle['rules'], fn($r) => $r['plan_version_id'] === $vid));
$ruleIds = array_column($rules, 'id');
$options = array_values(array_filter($bundle['options'], fn($o) => in_array($o['eligibility_rule_id'], $ruleIds, true)));
$docs = array_values(array_filter($bundle['documents'], fn($d) => $d['plan_version_id'] === $vid));
$vehicles = array_column($bundle['vehicleModels'], null, 'id');
$selected = null;
foreach ($options as $o) if ($o['id'] === ($_GET['optionId'] ?? null)) $selected = $o;
$selected ??= $options[0] ?? null;
$coverages = $vid && $selected ? resolve_coverages(array_values(array_filter($bundle['versionCoverages'], fn($c) => $c['plan_version_id'] === $vid)), $bundle['coverageTypes']) : [];
$published = ($activeVersion['workflow_status'] ?? '') === 'published';
$link = fn(array $q) => url("/plans/{$plan['id']}") . '?' . http_build_query($q);
$planJson = e(json_encode(['id' => $plan['id'], 'insurer_id' => $plan['insurer_id'], 'name' => $plan['name'], 'insurance_type' => $plan['insurance_type']], JSON_UNESCAPED_UNICODE));
$statusClass = fn($status) => match ($status) { 'published' => 'bg-emerald-100 text-emerald-800', 'in_review' => 'bg-amber-100 text-amber-800', 'archived' => 'bg-slate-200 text-slate-700', default => 'bg-blue-100 text-blue-800' };
$zone = $rules[0]['registration_zone'] ?? 'all';
?>
<div class="mb-3"><a href="<?= e(url('/search')) ?>" class="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><?= icon('arrow-left', 'w-3.5 h-3.5') ?><span>กลับไปหน้ารายการค้นหา</span></a></div>
<div id="action-error" role="alert" hidden class="alert-red mb-3"></div>
<div class="card p-5 mb-4">
  <div class="flex flex-wrap justify-between gap-4">
    <div class="min-w-0">
      <div class="flex flex-wrap gap-1.5 mb-1.5">
        <span class="badge bg-slate-900 text-white"><?= e($plan['insurer']['name'] ?? 'ไม่ระบุบริษัท') ?></span>
        <span class="badge bg-blue-100 text-blue-800"><?= e($plan['insurance_type']) ?></span>
        <?php if ($activeVersion): ?><span class="badge <?= $statusClass($activeVersion['workflow_status']) ?>">รุ่นที่ <?= $activeVersion['version_no'] ?> (<?= e($activeVersion['workflow_status']) ?>)</span><?php endif; ?>
        <?php if ($plan['is_archived']): ?><span class="badge bg-slate-200 text-slate-700">จัดเก็บเข้ากรุแล้ว (Archived)</span><?php endif; ?>
        <?php if ($zone && $zone !== 'all'): ?><span class="badge bg-amber-100 text-amber-800"><?= e(format_zone_label($zone)) ?></span><?php endif; ?>
      </div>
      <h1 class="text-xl font-black"><?= e($plan['name']) ?></h1>
      <p class="text-xs text-slate-500 mt-1">ช่องทางติดต่อบริษัท: <?= e($plan['insurer']['contact_channels'] ?? '' ?: '-') ?> • เว็บไซต์: <?= e($plan['insurer']['website'] ?? '' ?: '-') ?><?php if (!empty($activeVersion['effective_from'])): ?> • มีผลบังคับใช้: <?= e($activeVersion['effective_from']) ?> ถึง <?= e($activeVersion['effective_to'] ?: 'ไม่กำหนด') ?><?php endif; ?></p>
    </div>
    <div class="flex flex-wrap items-start gap-2">
      <?php if ($canSubmit && ($activeVersion['workflow_status'] ?? '') === 'draft'): ?>
        <button type="button" class="btn btn-primary" data-submit-review="<?= e($activeVersion['id']) ?>" data-reason="<?= e("ส่งตรวจสอบแพ็กเกจ \"{$plan['name']}\" รุ่นที่ {$activeVersion['version_no']}") ?>"><?= icon('send', 'w-3.5 h-3.5') ?><span>ส่งตรวจสอบ (Submit Review)</span></button>
      <?php endif; ?>
      <?php if ($canEdit): ?>
        <button type="button" class="btn btn-outline" data-plan-edit="<?= $planJson ?>"><?= icon('pencil', 'w-3.5 h-3.5') ?><span>แก้ไขข้อมูลแพ็กเกจ</span></button>
        <button type="button" class="btn btn-outline" data-plan-copy="<?= $planJson ?>"><?= icon('copy', 'w-3.5 h-3.5') ?><span>คัดลอกแพ็กเกจ</span></button>
      <?php endif; ?>
      <?php if ($selected && $published): ?><button type="button" class="btn btn-outline" data-basket-toggle="<?= e($selected['id']) ?>"><?= icon('plus', 'w-3.5 h-3.5') ?><span>เพิ่มลงรายการเปรียบเทียบ</span></button><?php endif; ?>
      <?php if (count($options) >= 2 && $published): ?><a class="btn btn-soft" href="<?= e(url('/compare?ids=' . implode(',', array_slice(array_column($options, 'id'), 0, 4)))) ?>"><?= icon('columns-3', 'w-3.5 h-3.5') ?><span>เทียบตัวเลือกในแผนนี้ (<?= min(count($options), 4) ?>)</span></a><?php endif; ?>
      <a hidden class="btn btn-primary" data-basket-open><?= icon('columns-3', 'w-3.5 h-3.5') ?><span>เปิดตารางเปรียบเทียบ (<span data-basket-count></span>)</span></a>
    </div>
  </div>
  <div class="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 text-xs">
    <span class="font-bold text-slate-500">ประวัติรุ่น (คลิกเพื่อดูย้อนหลัง):</span>
    <?php foreach ($visibleVersions as $ver): ?>
      <a href="<?= e($link(['version' => $ver['id']])) ?>" <?= $ver['id'] === $vid ? 'aria-current="true"' : '' ?> class="btn <?= $ver['id'] === $vid ? 'btn-dark' : 'btn-soft' ?>"><span>รุ่นที่ <?= $ver['version_no'] ?></span><span class="font-normal">(<?= e($ver['workflow_status']) ?>)</span></a>
    <?php endforeach; ?>
  </div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 items-start">
  <div class="space-y-4">
    <section class="card p-4">
      <h3 class="font-black text-sm mb-2 flex items-center gap-1.5"><?= icon('car') ?><span>เงื่อนไขรถที่รับประกัน</span></h3>
      <?php if (!$rules): ?><p class="text-xs text-slate-500">ยังไม่มีข้อมูลเงื่อนไขรถยนต์ในรุ่นนี้</p><?php endif; ?>
      <?php foreach ($rules as $r):
          $vehicle = $r['vehicle_model_id'] ? ($vehicles[$r['vehicle_model_id']] ?? null) : null;
          $basis = match ($r['age_basis']) { 'manufacture_year' => 'นับตามปีผลิต ค.ศ.', 'registration_year' => 'นับตามปีจดทะเบียน', default => 'ยังไม่ระบุเกณฑ์นับอายุ' };
          $scopeTitle = match ($r['scope_type']) {
              'specific_model' => trim('เฉพาะรุ่น: ' . ($vehicle['brand'] ?? '') . ' ' . ($vehicle['model'] ?? '') . ' ' . (!empty($vehicle['variant']) ? "({$vehicle['variant']})" : '')),
              'unknown' => 'ยังไม่ระบุขอบเขตรุ่นรถชัดเจน',
              default => 'รองรับรถทั่วไปทุกรุ่นภายใต้เงื่อนไข',
          };
      ?>
        <div class="text-xs text-slate-700 space-y-1">
          <div class="font-bold"><?= e($scopeTitle) ?></div>
          <div>อายุรถ: <?= e(format_car_age_range($r['min_age'], $r['max_age'])) ?> (<?= $basis ?>)</div>
          <div><span>ป้ายทะเบียน:</span> <span class="<?= ($r['registration_zone'] ?? 'all') !== 'all' ? 'font-bold text-amber-700' : '' ?>"><?= e(format_zone_label($r['registration_zone'])) ?></span></div>
          <div>ตรวจสภาพรถ: <?= $r['inspection_required'] ? 'ต้องตรวจสภาพรถก่อนทำประกัน' : 'ไม่ต้องตรวจสภาพรถ' ?></div>
          <?php if ($r['notes']): ?><div class="text-slate-500"><?= e($r['notes']) ?></div><?php endif; ?>
        </div>
      <?php endforeach; ?>
    </section>
    <section class="card p-4">
      <h3 class="font-black text-sm mb-2">ตัวเลือกราคาในรุ่นนี้ (<?= count($options) ?>)</h3>
      <?php if (!$options): ?><p class="text-xs text-slate-500">ยังไม่มีตัวเลือกราคาในรุ่นนี้</p><?php endif; ?>
      <div class="space-y-2">
        <?php foreach ($options as $opt): $current = $opt['id'] === ($selected['id'] ?? null); $sum = $opt['sum_insured_max'] ?? $opt['sum_insured_min']; ?>
          <a href="<?= e($link(['version' => $vid, 'optionId' => $opt['id']])) ?>" <?= $current ? 'aria-current="true"' : '' ?> class="block p-3 rounded-xl border text-xs <?= $current ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50' ?>">
            <div class="flex justify-between gap-2 font-bold"><span><?= e($opt['label']) ?></span><span class="text-blue-700 shrink-0"><?= $opt['premium_total'] !== null ? '฿' . money($opt['premium_total']) : 'ยังไม่มีข้อมูลราคา' ?></span></div>
            <div class="text-[11px] text-slate-500 mt-0.5"><?= $opt['repair_type'] === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่' ?> • <?= $sum !== null ? 'ทุน ฿' . money($sum) : 'ยังไม่ระบุทุน' ?><?php if ($opt['deductible_amount'] > 0): ?> • Deduct ฿<?= money($opt['deductible_amount']) ?><?php endif; ?></div>
          </a>
        <?php endforeach; ?>
      </div>
    </section>
    <section class="card p-4">
      <h3 class="font-black text-sm mb-2 flex items-center gap-1.5"><?= icon('file-text') ?><span>เอกสารต้นทางอ้างอิง (<?= count($docs) ?>)</span></h3>
      <?php if (!$docs): ?><p class="text-xs text-slate-500">ยังไม่มีเอกสารอ้างอิงแนบในรุ่นนี้ (ต้องแนบอย่างน้อย 1 รายการก่อนอนุมัติเผยแพร่)</p><?php endif; ?>
      <div class="space-y-2">
      <?php foreach ($docs as $doc): $uploaded = str_starts_with((string) $doc['source_url'], '/api/documents/'); ?>
        <div class="p-3 rounded-xl bg-slate-50 text-xs space-y-1">
          <div class="font-bold"><?= e($doc['title']) ?></div>
          <?php if ($doc['page_reference']): ?><div class="text-slate-600">จุดอ้างอิง: <?= e($doc['page_reference']) ?></div><?php endif; ?>
          <div class="text-[11px] text-slate-500 break-all">ประเภท: <?= e($doc['source_type']) ?><?= $doc['storage_path'] ? ' • ไฟล์: ' . e($doc['storage_path']) : '' ?><?= $doc['file_size'] ? ' (' . max(1, (int) round($doc['file_size'] / 1024)) . ' KB)' : '' ?></div>
          <?php if ($doc['source_url']): ?>
            <div class="flex gap-3 pt-1">
              <a class="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline" href="<?= e(document_url($doc['source_url'])) ?>" target="_blank" rel="noopener noreferrer"><?= icon('external-link', 'w-3.5 h-3.5') ?><span>เปิดดูเอกสาร</span></a>
              <?php if ($uploaded): ?><a class="inline-flex items-center gap-1 font-bold text-slate-600 hover:underline" href="<?= e(document_url($doc['source_url'])) ?>?download=1"><?= icon('download', 'w-3.5 h-3.5') ?><span>ดาวน์โหลด</span></a><?php endif; ?>
            </div>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
      </div>
    </section>
  </div>
  <div class="space-y-4">
    <section class="card p-4">
      <div class="flex justify-between gap-2 mb-3">
        <div><h3 class="font-black text-sm">ตารางความคุ้มครองและข้อยกเว้น</h3><p class="text-[11px] text-slate-500"><?= $selected ? e("แสดงผลตามตัวเลือก \"{$selected['label']}\" (รวมข้อยกเว้นและเงื่อนไขเฉพาะ)") : 'ยังไม่มีตัวเลือกราคาให้แสดงผล' ?></p></div>
        <span class="badge bg-slate-100 text-slate-700 h-fit"><?= count($coverages) ?> หมวด</span>
      </div>
      <div class="divide-y divide-slate-100">
        <?php foreach ($coverages as $cov):
            [$class, $text] = match ($cov['status']) {
                'covered' => ['text-emerald-800', $cov['limitAmount'] ? '฿' . money($cov['limitAmount']) . ($cov['limitBasis'] ? " ({$cov['limitBasis']})" : '') : ($cov['limitBasis'] ?: 'คุ้มครอง (ยังไม่ระบุวงเงิน)')],
                'not_covered' => ['text-red-700', 'ไม่คุ้มครอง'],
                'optional' => ['text-amber-700', 'ซื้อเพิ่มได้ (Optional)'],
                default => ['text-slate-400', 'ยังไม่ระบุ'],
            };
        ?>
          <div class="flex justify-between gap-3 py-2 text-xs">
            <div class="min-w-0"><span class="font-semibold"><?= e($cov['name']) ?></span>
              <?php if ($cov['terms']): ?><p class="text-[11px] text-slate-500"><?= e($cov['terms']) ?></p><?php endif; ?>
              <?php if ($cov['exclusions']): ?><p class="text-[11px] text-red-600">ข้อยกเว้น: <?= e($cov['exclusions']) ?></p><?php endif; ?>
            </div>
            <span class="font-bold text-right shrink-0 max-w-[45%] <?= $class ?>"><?= e($text) ?></span>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
    <section class="card p-4">
      <h3 class="font-black text-sm mb-2 flex items-center gap-1.5"><?= icon('history') ?><span>ประวัติการเปลี่ยนแปลงและการตรวจสอบ (Audit Trail)</span></h3>
      <?php if (!$bundle['auditLogs']): ?><p class="text-xs text-slate-500">ยังไม่มีประวัติบันทึกสำหรับแพ็กเกจนี้</p><?php endif; ?>
      <div class="space-y-2">
        <?php foreach ($bundle['auditLogs'] as $log): ?>
          <div class="p-2.5 rounded-xl bg-slate-50 text-xs">
            <div class="flex flex-wrap justify-between gap-2"><span class="font-bold">ผู้ดำเนินการ: <?= e($log['actor_name'] ?: 'ระบบ') ?></span><span class="text-[11px] text-slate-500"><?= thai_datetime($log['created_at']) ?></span></div>
            <div>การกระทำ: <span class="font-mono font-bold"><?= e($log['action']) ?></span></div>
            <?php if ($log['reason']): ?><div class="text-slate-600">เหตุผล: <?= e($log['reason']) ?></div><?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  </div>
</div>
