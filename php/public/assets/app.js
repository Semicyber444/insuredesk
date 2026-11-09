/* eslint-disable -- browser script of the PHP app, outside the Next.js lint rules */
// Page behaviour shared by every view. Server state lives in PHP; this only wires up the UI.
const App = (() => {
  const base = window.APP.base;
  const BASKET_KEY = 'insuredesk_compare_ids_v1';

  /** Calls a PHP action. Resolves with its data, or throws its Thai error message. */
  async function action(name, ...args) {
    let body;
    try {
      const res = await fetch(`${base}/action/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) });
      body = await res.json();
    } catch {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    }
    if (!body.ok) throw new Error(body.error);
    return body.data;
  }

  // The compare basket (2-4 option IDs) is per-tab UI state, so it stays in sessionStorage.
  function basket() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(BASKET_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  function setBasket(ids) {
    try {
      sessionStorage.setItem(BASKET_KEY, JSON.stringify(ids.slice(0, 4)));
    } catch {
      // Ignore storage errors
    }
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function flash(message) {
    try {
      sessionStorage.setItem('insuredesk_flash', message);
    } catch {
      // Ignore storage errors
    }
  }

  function showAlert(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  return { action, basket, setBasket, esc, flash, showAlert, base };
})();

function initShell() {
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await App.action('logout').catch(() => {});
    location.href = `${App.base}/login`;
  });
  const toggle = document.querySelector('[data-menu-toggle]');
  toggle?.addEventListener('click', () => {
    const menu = document.getElementById('mobile-menu');
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.querySelectorAll('[data-demo-role]').forEach((b) => b.addEventListener('click', async () => {
    await App.action('switchDemoRole', b.dataset.demoRole).catch((e) => alert(e.message));
    location.reload();
  }));
  document.querySelectorAll('[data-dialog-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', () => alert(b.dataset.alert)));

  const notice = document.getElementById('status-notice');
  if (notice) {
    let message = null;
    try {
      message = sessionStorage.getItem('insuredesk_flash');
      sessionStorage.removeItem('insuredesk_flash');
    } catch {
      // Ignore storage errors
    }
    if (message) showNotice(message);
  }
}

function showNotice(message) {
  const notice = document.getElementById('status-notice');
  notice.innerHTML = `<span>${App.esc(message)}</span><button type="button" class="font-bold cursor-pointer">ปิด</button>`;
  notice.hidden = false;
  notice.querySelector('button').addEventListener('click', () => { notice.hidden = true; });
}

function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;
  const error = document.getElementById('login-error');
  const submit = form.querySelector('[type=submit]');
  const finish = async (call) => {
    submit.disabled = true;
    submit.firstElementChild.textContent = 'กำลังเข้าสู่ระบบ...';
    error.hidden = true;
    try {
      await call();
      location.href = `${App.base}/search`;
    } catch (e) {
      App.showAlert(error, e.message);
      submit.disabled = false;
      submit.firstElementChild.textContent = 'เข้าสู่ระบบ';
    }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    finish(() => App.action('login', form.querySelector('#login-email').value, form.querySelector('#login-password').value));
  });
  document.querySelectorAll('[data-quick-login]').forEach((b) => b.addEventListener('click', () => finish(() => App.action('demoLogin', b.dataset.quickLogin))));
}

function initSearch() {
  const form = document.getElementById('filter-form');
  if (!form) return;
  const results = document.getElementById('results');
  const pool = new Map(JSON.parse(document.getElementById('compare-pool').textContent).map((p) => [p.id, p]));
  const pageInput = form.elements.page;
  const brand = form.elements.vehicleBrand;
  const model = form.elements.vehicleModelId;

  let selected = App.basket().filter((id) => pool.has(id));
  App.setBasket(selected);

  function syncCards() {
    results.querySelectorAll('[data-compare-toggle]').forEach((b) => {
      const on = selected.includes(b.dataset.compareToggle);
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('span').textContent = on ? 'เลือกเปรียบเทียบแล้ว' : 'เปรียบเทียบ';
      b.classList.toggle('btn-primary', on);
      b.classList.toggle('btn-outline', !on);
      b.disabled = !on && selected.length >= 4;
      b.title = b.disabled ? 'เลือกครบ 4 รายการแล้ว' : '';
    });
    renderDock();
  }

  function renderDock() {
    const dock = document.getElementById('compare-dock');
    dock.hidden = selected.length === 0;
    if (dock.hidden) return;
    const chips = selected.map((id) => pool.get(id)).filter(Boolean).map((p) => `
      <div class="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1 text-[11px] max-w-56">
        <span class="font-bold shrink-0">${App.esc(p.insurerName)}</span><span class="truncate text-slate-600">${App.esc(p.planName)}</span>
        <button type="button" data-dock-remove="${App.esc(p.id)}" title="นำออก" aria-label="นำ ${App.esc(p.planName)} ออกจากการเปรียบเทียบ" class="cursor-pointer text-slate-500 hover:text-red-600">✕</button>
      </div>`).join('');
    const can = selected.length >= 2;
    dock.innerHTML = `
      <div class="min-w-0 flex flex-wrap items-center gap-2">
        <div class="text-xs"><span class="font-black">เลือกเปรียบเทียบ</span> <span aria-live="polite" class="text-blue-700 font-bold">${selected.length}/4 รายการ</span></div>
        ${chips}
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-soft" data-dock-clear>ล้างทั้งหมด</button>
        ${can ? `<a class="btn btn-primary" href="${App.base}/compare?ids=${selected.join(',')}">เปรียบเทียบ (${selected.length})</a>` : '<button type="button" class="btn btn-soft" disabled>ต้องเลือก 2-4 รายการ</button>'}
      </div>`;
  }

  function narrowModels() {
    for (const option of model.options) {
      if (option.dataset.brand) option.hidden = Boolean(brand.value) && option.dataset.brand !== brand.value;
    }
    if (model.selectedOptions[0]?.hidden) model.value = '';
  }

  let request = 0;
  async function refresh() {
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (value !== '') query.append(key, value);
    const mine = ++request;
    results.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(`${App.base}/search?${query}&partial=1`);
      if (!res.ok) throw new Error();
      const html = await res.text();
      if (mine !== request) return;
      results.innerHTML = html;
      history.replaceState(null, '', `${App.base}/search?${query}`);
      const root = results.firstElementChild;
      document.getElementById('filter-total').textContent = root.dataset.total;
      const active = document.getElementById('filter-active');
      active.hidden = root.dataset.active === '0';
      active.querySelector('span').textContent = root.dataset.active;
      document.getElementById('coverage-count').textContent = form.querySelectorAll('[name="requiredCoverageCodes[]"]:checked').length;
      syncCards();
    } catch {
      results.innerHTML = '<p role="alert" class="alert-red">ไม่สามารถโหลดผลการค้นหาได้ กรุณาลองใหม่อีกครั้ง</p>';
    } finally {
      if (mine === request) results.setAttribute('aria-busy', 'false');
    }
  }

  let timer;
  const schedule = (delay) => {
    pageInput.value = 1;
    clearTimeout(timer);
    timer = setTimeout(refresh, delay);
  };
  form.addEventListener('input', (e) => { if (e.target.matches('input[type=text], input[type=number]')) schedule(300); });
  form.addEventListener('change', (e) => { if (!e.target.matches('input[type=text], input[type=number]')) schedule(0); });
  form.addEventListener('submit', (e) => { e.preventDefault(); schedule(0); });
  document.querySelector('[name=sortBy]').addEventListener('change', () => schedule(0));
  brand.addEventListener('change', narrowModels);
  narrowModels();

  document.querySelector('[data-filter-toggle]').addEventListener('click', (e) => {
    const open = form.classList.toggle('hidden') === false;
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    const page = e.target.closest('[data-page]');
    if (page) {
      e.preventDefault();
      pageInput.value = page.dataset.page;
      refresh();
      return;
    }
    const toggle = e.target.closest('[data-compare-toggle]');
    const remove = e.target.closest('[data-dock-remove]');
    if (toggle) {
      const id = toggle.dataset.compareToggle;
      if (selected.includes(id)) selected = selected.filter((x) => x !== id);
      else if (selected.length < 4) selected = [...selected, id];
    } else if (remove) {
      selected = selected.filter((x) => x !== remove.dataset.dockRemove);
    } else if (e.target.closest('[data-dock-clear]')) {
      selected = [];
    } else {
      return;
    }
    App.setBasket(selected);
    syncCards();
  });

  syncCards();
}

function initCompare() {
  if (document.querySelector('[data-compare-empty]')) {
    const saved = App.basket().slice(0, 4);
    if (saved.length >= 2) location.replace(`${App.base}/compare?ids=${saved.join(',')}`);
    return;
  }
  const sheet = document.querySelector('[data-compare-ids]');
  if (!sheet) return;
  App.setBasket(sheet.dataset.compareIds.split(','));

  document.querySelector('[data-only-diff]').addEventListener('click', (e) => {
    const on = document.documentElement.classList.toggle('only-diff');
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.classList.toggle('btn-primary', on);
    e.currentTarget.classList.toggle('btn-outline', !on);
  });
  document.querySelectorAll('[data-warnings-toggle]').forEach((b) => b.addEventListener('click', () => {
    const panel = document.getElementById('compare-warnings');
    panel.hidden = !panel.hidden;
    document.querySelector('button[aria-controls=compare-warnings]').setAttribute('aria-expanded', String(!panel.hidden));
  }));
  document.querySelector('[data-print]').addEventListener('click', () => window.print());
  document.querySelector('[data-compare-clear]').addEventListener('click', () => {
    App.setBasket([]);
    location.href = `${App.base}/search`;
  });
  document.querySelectorAll('[data-compare-remove]').forEach((b) => b.addEventListener('click', () => {
    const remaining = sheet.dataset.compareIds.split(',').filter((id) => id !== b.dataset.compareRemove);
    App.setBasket(remaining);
    location.href = remaining.length >= 2 ? `${App.base}/compare?ids=${remaining.join(',')}` : `${App.base}/search`;
  }));
}

function initPlanPage() {
  const toggle = document.querySelector('[data-basket-toggle]');
  const open = document.querySelector('[data-basket-open]');
  function sync() {
    const ids = App.basket();
    if (toggle) {
      const inBasket = ids.includes(toggle.dataset.basketToggle);
      toggle.querySelector('span').textContent = inBasket ? 'อยู่ในรายการเปรียบเทียบแล้ว' : 'เพิ่มลงรายการเปรียบเทียบ';
      toggle.disabled = !inBasket && ids.length >= 4;
    }
    if (open) {
      open.hidden = ids.length < 2;
      open.href = `${App.base}/compare?ids=${ids.join(',')}`;
      open.querySelector('[data-basket-count]').textContent = ids.length;
    }
  }
  toggle?.addEventListener('click', () => {
    const ids = App.basket();
    const id = toggle.dataset.basketToggle;
    App.setBasket(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 4 ? ids : [...ids, id]);
    sync();
  });
  if (toggle || open) sync();
}

function initManage() {
  const finish = (message) => {
    if (message) App.flash(message);
    location.reload();
  };
  const report = (message) => {
    const target = document.getElementById('status-notice');
    if (target) showNotice(message);
    else App.showAlert(document.getElementById('action-error'), message);
  };

  document.querySelectorAll('[data-submit-review]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await App.action('submitForReview', b.dataset.submitReview, b.dataset.reason);
      finish(b.dataset.notice);
    } catch (e) {
      report(e.message);
    }
  }));

  const archived = document.querySelector('[data-show-archived]');
  archived?.addEventListener('change', () => { location.href = `${App.base}/manage/plans${archived.checked ? '?archived=1' : ''}`; });

  document.querySelectorAll('[data-plan-delete]').forEach((b) => b.addEventListener('click', async () => {
    const name = b.dataset.name;
    const prompt = b.dataset.published
      ? `แพ็กเกจ "${name}" มีประวัติเผยแพร่แล้ว ระบบจะจัดเก็บเข้ากรุ (Archive) แทนการลบทิ้งตามกฎ Section 8.1 ต้องการดำเนินการหรือไม่?`
      : `คุณแน่ใจหรือไม่ว่าต้องการลบแพ็กเกจร่าง "${name}"?`;
    if (!confirm(prompt)) return;
    try {
      const { mode } = await App.action('deletePlan', b.dataset.planDelete);
      finish(mode === 'archived' ? `จัดเก็บแพ็กเกจ "${name}" เข้ากรุ (Archived) เรียบร้อยแล้ว` : `ลบแพ็กเกจร่าง "${name}" เรียบร้อยแล้ว`);
    } catch (e) {
      report(e.message);
    }
  }));
  document.querySelectorAll('[data-plan-restore]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await App.action('restorePlan', b.dataset.planRestore);
      finish(`กู้คืนแพ็กเกจ "${b.dataset.name}" กลับมาใช้งานเรียบร้อยแล้ว`);
    } catch (e) {
      report(e.message);
    }
  }));

  document.querySelector('[data-plan-create]')?.addEventListener('click', () => PlanForm.open(null, false));
  document.querySelectorAll('[data-plan-edit]').forEach((b) => b.addEventListener('click', () => PlanForm.open(JSON.parse(b.dataset.planEdit), false)));
  document.querySelectorAll('[data-plan-copy]').forEach((b) => b.addEventListener('click', () => PlanForm.open(JSON.parse(b.dataset.planCopy), true)));

  // Reviews
  const reviewModal = document.getElementById('review-modal');
  if (reviewModal) {
    const reason = document.getElementById('review-reason');
    const confirmButton = document.getElementById('review-confirm');
    const error = document.getElementById('review-error');
    let current = null;
    const update = () => { confirmButton.disabled = !reason.value.trim(); };
    reason.addEventListener('input', update);
    document.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => {
      const publish = b.dataset.review === 'publish';
      current = { versionId: b.dataset.version, publish };
      document.getElementById('review-modal-title').textContent = publish ? 'ยืนยันการเผยแพร่ข้อมูล' : 'ส่งกลับให้ผู้กรอกแก้ไข';
      document.getElementById('review-plan').textContent = b.dataset.name;
      reason.value = '';
      reason.placeholder = publish ? 'เช่น ตรวจสอบตารางเบี้ยและเงื่อนไขตรงตามเอกสารต้นทางครบถ้วน' : 'เช่น ข้อมูลทุนประกันไม่ตรงกับหน้า 3 ของเอกสาร กรุณาแก้ไข';
      error.hidden = true;
      update();
      reviewModal.showModal();
    }));
    confirmButton.addEventListener('click', async () => {
      confirmButton.disabled = true;
      confirmButton.textContent = 'กำลังดำเนินการ...';
      try {
        await App.action(current.publish ? 'publishVersion' : 'rejectVersion', current.versionId, reason.value.trim());
        location.reload();
      } catch (e) {
        App.showAlert(error, e.message);
        confirmButton.textContent = 'ยืนยัน';
        update();
      }
    });
  }

  // Insurers
  const insurerModal = document.getElementById('insurer-modal');
  if (insurerModal) {
    const field = (id) => document.getElementById(`insurer-${id}`);
    let editingId = null;
    const open = (insurer) => {
      editingId = insurer?.id ?? null;
      document.getElementById('insurer-modal-title').textContent = editingId ? 'แก้ไขข้อมูลบริษัทประกันภัย' : 'เพิ่มบริษัทประกันภัยใหม่';
      field('name').value = insurer?.name ?? '';
      field('contact').value = insurer?.contact_channels ?? '';
      field('website').value = insurer?.website ?? '';
      field('active').checked = insurer?.is_active ?? true;
      field('active-row').hidden = !editingId;
      field('error').hidden = true;
      insurerModal.showModal();
    };
    document.querySelector('[data-insurer-create]').addEventListener('click', () => open(null));
    document.querySelectorAll('[data-insurer-edit]').forEach((b) => b.addEventListener('click', () => open(JSON.parse(b.dataset.insurerEdit))));
    document.getElementById('insurer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = { name: field('name').value, contact_channels: field('contact').value || null, website: field('website').value || null, is_active: field('active').checked };
      if (editingId) data.id = editingId;
      try {
        await App.action('saveInsurer', data);
        location.reload();
      } catch (err) {
        App.showAlert(field('error'), err.message);
      }
    });
    document.querySelectorAll('[data-insurer-delete]').forEach((b) => b.addEventListener('click', async () => {
      const name = b.dataset.name;
      if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหรือปิดการใช้งานบริษัท "${name}"?`)) return;
      try {
        const { mode } = await App.action('deleteInsurer', b.dataset.insurerDelete);
        finish(mode === 'deactivated' ? `บริษัท "${name}" มีแพ็กเกจผูกอยู่ ระบบจึงเปลี่ยนสถานะเป็น "ปิดใช้งาน" แทนการลบเพื่อรักษาข้อมูลอ้างอิง` : `ลบบริษัท "${name}" เรียบร้อยแล้ว`);
      } catch (err) {
        report(err.message);
      }
    }));
  }

  // Audit: entries written since the last page push older ones down, so the next page can repeat a few.
  const more = document.getElementById('audit-more');
  more?.addEventListener('click', async () => {
    const list = document.getElementById('audit-list');
    more.disabled = true;
    more.textContent = 'กำลังโหลด...';
    try {
      const res = await fetch(`${App.base}/manage/audit?partial=1&offset=${list.children.length}`);
      if (!res.ok) throw new Error();
      const shown = new Set([...list.children].map((c) => c.dataset.logId));
      const holder = document.createElement('div');
      holder.innerHTML = await res.text();
      [...holder.children].filter((c) => !shown.has(c.dataset.logId)).forEach((c) => list.append(c));
      document.getElementById('audit-more-wrap').hidden = res.headers.get('X-Has-More') !== '1';
    } catch {
      alert('ไม่สามารถโหลดประวัติเพิ่มได้ กรุณาลองใหม่อีกครั้ง');
    }
    more.disabled = false;
    more.textContent = 'โหลดเพิ่ม';
  });
}

initLogin();
if (document.querySelector('main')) {
  initShell();
  initSearch();
  initCompare();
  initPlanPage();
  initManage();
}
