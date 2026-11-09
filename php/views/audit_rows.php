<?php foreach ($logs as $log): ?>
  <div class="p-3 text-xs space-y-1" data-log-id="<?= e($log['id']) ?>">
    <div class="flex flex-wrap justify-between gap-2"><div class="flex flex-wrap items-center gap-1.5"><span class="font-bold"><?= e($log['actor_name'] ?: 'ระบบอัตโนมัติ') ?></span><span class="text-slate-300">•</span><span class="text-[11px] text-slate-400 font-mono">ID: <?= e($log['id']) ?></span></div><span class="text-[11px] text-slate-500"><?= thai_datetime($log['created_at']) ?></span></div>
    <div class="flex flex-wrap items-center gap-2"><span class="badge bg-blue-100 text-blue-800 font-mono"><?= e($log['action']) ?></span><span class="text-[11px] text-slate-500">เป้าหมาย: <?= e($log['entity_type']) ?> (<?= e(substr($log['entity_id'], 0, 12)) ?>...)</span></div>
    <?php if ($log['reason']): ?><div class="text-slate-700"><strong>เหตุผล:</strong> <?= e($log['reason']) ?></div><?php endif; ?>
  </div>
<?php endforeach; ?>
