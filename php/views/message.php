<div class="card max-w-lg mx-auto mt-10 p-8 text-center space-y-3">
  <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><?= icon($iconName, 'w-6 h-6') ?></div>
  <h2 class="text-lg font-black"><?= e($heading) ?></h2>
  <?php if ($body !== ''): ?><p class="text-xs text-slate-500"><?= e($body) ?></p><?php endif; ?>
  <a href="<?= e(url('/search')) ?>" class="btn btn-primary">กลับไปหน้าค้นหาประกัน</a>
</div>
