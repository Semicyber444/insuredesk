/* eslint-disable -- browser script of the PHP app, outside the Next.js lint rules */
// The multi-tab create / edit / copy plan modal.
const PlanForm = (() => {
  const { esc } = App;
  const icon = (name, cls = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}">${window.APP.icons[name]}</svg>`;
  const STATUS = [['covered', 'คุ้มครอง'], ['not_covered', 'ไม่คุ้มครอง'], ['optional', 'ซื้อเพิ่มได้'], ['unknown', 'ยังไม่ระบุ']];
  const TYPES = ['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3'];
  const DEFAULT_DRIVER = 'ไม่จำกัดชื่อผู้ขับขี่';
  const thaiNumber = (n) => Number(n).toLocaleString('th-TH');

  function coveragePreset(type, coverageTypes) {
    const t1 = type === 'ชั้น 1', p2 = type === 'ชั้น 2+', p3 = type === 'ชั้น 3+', t2 = type === 'ชั้น 2';
    return coverageTypes.map((ct) => {
      let status = 'covered', limitAmount = '', limitBasis = '', terms = '';
      switch (ct.code) {
        case 'own_damage':
          if (t1) { limitBasis = 'ตามทุนประกัน'; terms = 'คุ้มครองอุบัติเหตุทุกกรณี'; }
          else if (p2 || p3) { limitBasis = 'ตามทุนประกัน (ชนกับยานพาหนะทางบก)'; terms = 'ต้องมีคู่กรณีเป็นยานพาหนะทางบก'; }
          else status = 'not_covered';
          break;
        case 'rollover_offroad':
          if (t1) { limitBasis = 'ตามทุนประกัน'; terms = 'คุ้มครองกรณีรถพลิกคว่ำหรือตกข้างทาง'; } else status = 'not_covered';
          break;
        case 'theft_fire':
          if (t1 || p2 || t2) limitBasis = 'ตามทุนประกัน'; else status = 'not_covered';
          break;
        case 'flood':
          if (t1 || p2) limitBasis = 'ตามทุนประกัน'; else status = 'not_covered';
          break;
        case 'windshield':
          status = t1 ? 'covered' : 'not_covered';
          if (t1) limitBasis = 'ตามทุนประกัน';
          break;
        case 'theft_personal_prop':
          status = t1 ? 'optional' : 'not_covered';
          if (t1) { limitAmount = 20000; limitBasis = 'ต่อครั้ง'; }
          break;
        case 'accessories':
          status = t1 || p2 ? 'covered' : 'optional';
          limitAmount = 20000; limitBasis = 'ต่อครั้ง (ตามที่แจ้งไว้)'; terms = 'คุ้มครองอุปกรณ์ตกแต่งตามที่แจ้งไว้ไม่เกิน 20,000 บาท';
          break;
        case 'tp_life_person': limitAmount = 1000000; limitBasis = 'ต่อคน'; break;
        case 'tp_life_event': limitAmount = 10000000; limitBasis = 'ต่อครั้ง'; break;
        case 'tp_property': limitAmount = t1 ? 2500000 : 1000000; limitBasis = 'ต่อครั้ง'; break;
        case 'pa_driver_passenger': limitAmount = 200000; limitBasis = 'ต่อคน (5 ที่นั่ง)'; break;
        case 'medical_expenses': limitAmount = 200000; limitBasis = 'ต่อคน'; break;
        case 'bail_bond': limitAmount = 300000; limitBasis = 'ต่อครั้ง'; break;
        case 'roadside_assist': status = t1 || p2 ? 'covered' : 'optional'; limitBasis = 'ช่วยเหลือ 24 ชม.'; break;
        case 'towing': status = t1 || p2 ? 'covered' : 'optional'; limitAmount = 1500; limitBasis = 'ไม่เกิน 50 กม.'; break;
        case 'loss_of_use': status = 'optional'; limitAmount = 500; limitBasis = 'ต่อวัน'; terms = 'ซื้อความคุ้มครองเสริม'; break;
      }
      return { code: ct.code, name: ct.name, category: ct.category, status, limitAmount, limitBasis, terms, exclusions: '' };
    });
  }

  const isAutoLabel = (label) => label.trim() === '' || /^(ซ่อมห้าง|ซ่อมอู่)\s*-\s*(ทุน|ยังไม่ระบุทุน)/.test(label.trim());
  function autoLabel(repair, hasSum, sum) {
    const prefix = repair === 'dealer' ? 'ซ่อมห้าง' : 'ซ่อมอู่';
    return !hasSum || sum === '' || Number(sum) <= 0 ? `${prefix} - ยังไม่ระบุทุน` : `${prefix} - ทุน ${thaiNumber(sum)}`;
  }
  const blankTier = (overrides) => ({ label: 'ซ่อมอู่ - ทุน 50,000', repairType: 'garage', priceType: 'fixed_for_conditions', hasPrice: true, premiumTotal: 5400, hasSumInsured: true, sumInsuredMax: 50000, deductibleAmount: 0, deductibleTerms: '', compulsoryIncluded: 'excluded', driverConditions: DEFAULT_DRIVER, ...overrides });

  function initialState(plan, isCopy, data) {
    const { canPublish, today, nextYear } = window.APP;
    const state = {
      plan, isCopy, insurers: data.insurers, vehicles: data.vehicleModels, coverageTypes: data.coverageTypes,
      versionId: null, versionNo: 1, versionStatus: 'draft', saveMode: 'new_version',
      insurerId: data.insurers.find((i) => i.is_active)?.id || data.insurers[0]?.id || '',
      name: '', insuranceType: 'ชั้น 1', workflowStatus: canPublish ? 'published' : 'in_review',
      effectiveFrom: today, effectiveTo: nextYear, notes: '',
      scopeType: 'all_models', vehicleModelId: '', minCarAge: 1, maxCarAge: 10, usageType: 'private', registrationZone: 'all', inspectionRequired: false, ageBasis: 'registration_year',
      tiers: [blankTier()], coverages: coveragePreset(plan?.insurance_type || 'ชั้น 1', data.coverageTypes),
      documentTitle: '', documentRef: '', sourceType: 'rate_sheet', documentStoragePath: null, documentSourceUrl: '', documentFileSize: null, documentMimeType: null, uploadedName: '',
      tab: 'info', error: '', busy: false, uploading: false,
    };
    if (!plan) return state;

    const versions = [...(data.bundle?.plan.versions ?? [])].sort((a, b) => b.version_no - a.version_no);
    const latest = versions.find((v) => v.workflow_status === 'published') ?? versions[0];
    const locked = latest?.workflow_status === 'published' || latest?.workflow_status === 'archived';
    const raw = latest?.workflow_status ?? plan.currentStatus ?? 'draft';
    if (latest) {
      const rule = data.bundle.rules.find((r) => r.plan_version_id === latest.id);
      if (rule) {
        Object.assign(state, { scopeType: rule.scope_type || 'all_models', vehicleModelId: rule.vehicle_model_id || '', minCarAge: rule.min_age ?? '', maxCarAge: rule.max_age ?? '', usageType: rule.usage_type || 'private', registrationZone: rule.registration_zone || 'all', inspectionRequired: rule.inspection_required ?? false, ageBasis: rule.age_basis || 'registration_year' });
        const options = data.bundle.options.filter((o) => o.eligibility_rule_id === rule.id);
        if (options.length) {
          state.tiers = options.map((o) => {
            const sum = o.sum_insured_max ?? o.sum_insured_min;
            return { id: locked || isCopy ? undefined : o.id, label: o.label || '', repairType: o.repair_type, priceType: o.price_type, hasPrice: o.premium_total !== null, premiumTotal: o.premium_total ?? '', hasSumInsured: sum !== null, sumInsuredMax: sum ?? '', deductibleAmount: o.deductible_amount ?? 0, deductibleTerms: o.deductible_terms || '', compulsoryIncluded: o.compulsory_included || 'excluded', driverConditions: o.driver_conditions || DEFAULT_DRIVER };
          });
        }
      }
      const versionCoverages = data.bundle.versionCoverages.filter((c) => c.plan_version_id === latest.id);
      if (versionCoverages.length) {
        const t1 = plan.insurance_type === 'ชั้น 1', p2 = plan.insurance_type.includes('2+');
        state.coverages = data.coverageTypes.map((ct) => {
          const found = versionCoverages.find((c) => c.coverage_type_id === ct.id);
          const item = { code: ct.code, name: ct.name, category: ct.category, status: found?.status ?? 'unknown', limitAmount: found?.limit_amount ?? '', limitBasis: found?.limit_basis ?? '', terms: found?.terms ?? '', exclusions: found?.exclusions ?? '' };
          if (!found && ct.code === 'accessories') Object.assign(item, { status: t1 || p2 ? 'covered' : 'optional', limitAmount: 20000, limitBasis: 'ต่อครั้ง (ตามที่แจ้งไว้)', terms: 'คุ้มครองอุปกรณ์ตกแต่งตามที่แจ้งไว้ไม่เกิน 20,000 บาท' });
          else if (!found && ct.code === 'rollover_offroad') Object.assign(item, t1 ? { status: 'covered', limitBasis: 'ตามทุนประกัน', terms: 'คุ้มครองกรณีรถพลิกคว่ำหรือตกข้างทาง' } : { status: 'unknown' });
          return item;
        });
      }
      const doc = data.bundle.documents.find((d) => d.plan_version_id === latest.id);
      if (doc) Object.assign(state, { documentTitle: doc.title, documentRef: doc.page_reference || '', sourceType: doc.source_type || 'rate_sheet', documentStoragePath: doc.storage_path || null, documentSourceUrl: doc.source_url || '', documentFileSize: doc.file_size ?? null, documentMimeType: doc.mime_type ?? null });
    }
    return Object.assign(state, {
      versionId: isCopy ? null : latest?.id ?? null,
      versionNo: isCopy ? 1 : latest?.version_no ?? 1,
      versionStatus: isCopy ? 'draft' : latest?.workflow_status ?? 'draft',
      // Section 12.2: published versions default to a new version to preserve history.
      saveMode: isCopy || locked ? 'new_version' : 'update',
      insurerId: plan.insurer_id || data.insurers[0]?.id || '',
      name: isCopy ? `${plan.name} (สำเนา)` : plan.name,
      insuranceType: plan.insurance_type || 'ชั้น 1',
      workflowStatus: isCopy ? (canPublish ? 'published' : 'in_review') : !canPublish ? (raw === 'draft' ? 'draft' : 'in_review') : raw === 'archived' ? 'draft' : raw,
      effectiveFrom: latest?.effective_from || today,
      effectiveTo: latest?.effective_to || nextYear,
      notes: isCopy ? `คัดลอกข้อมูลตั้งต้นจาก "${plan.name}"` : latest?.notes || '',
    });
  }

  let s = null; // the open form's state
  let dialog = null;
  let onSaved = null;

  const field = (key, label, control) => `<div><label class="label" for="plan-${key}">${label}</label>${control}</div>`;
  const select = (key, options, rerender = false) => `<select class="input" id="plan-${key}" data-bind="${key}" ${rerender ? 'data-rerender' : ''}>${options.map(([v, t]) => `<option value="${esc(v)}" ${String(s[key]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const input = (key, type, placeholder = '', extra = '') => `<input class="input" id="plan-${key}" type="${type}" data-bind="${key}" value="${esc(s[key])}" placeholder="${esc(placeholder)}" ${extra}>`;

  function tabInfo() {
    const { canPublish } = window.APP;
    const locked = s.versionStatus === 'published' || s.versionStatus === 'archived';
    return `<div class="space-y-4">
      ${s.isCopy && s.plan ? `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950"><span class="font-bold block">กำลังสร้างแพ็กเกจใหม่โดยคัดลอกจาก &quot;${esc(s.plan.name)}&quot;</span><span class="text-[11px] text-emerald-800">ดึงข้อมูลเงื่อนไขรถ ตัวเลือกราคา ความคุ้มครองทั้ง 16 หมวด และเอกสารอ้างอิงมาให้ครบแล้ว สามารถแก้ชื่อแพ็กเกจ ปรับเงื่อนไขป้ายทะเบียน หรือราคาแล้วกดบันทึกเป็นแพ็กเกจใหม่ได้ทันที</span></div>` : ''}
      ${s.plan && !s.isCopy ? `<div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2">
        <div class="flex items-center justify-between text-xs"><span class="font-bold text-blue-950">รุ่นอ้างอิงล่าสุด: รุ่นที่ ${s.versionNo} (${esc(s.versionStatus)})</span><span class="text-[11px] text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md font-mono">ID: ${esc((s.versionId || '').slice(0, 12))}...</span></div>
        <div class="text-xs text-slate-700 font-semibold pt-2 border-t border-blue-100 flex flex-wrap gap-4">
          <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="saveMode" value="new_version" data-bind="saveMode" ${s.saveMode === 'new_version' ? 'checked' : ''}><span>สร้างเป็นรุ่นใหม่ (รุ่นที่ ${s.versionNo + 1}) — เก็บประวัติรุ่นเดิมตามมาตรฐาน</span></label>
          ${locked ? '' : `<label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="saveMode" value="update" data-bind="saveMode" ${s.saveMode === 'update' ? 'checked' : ''}><span>แก้ไขในรุ่นร่างปัจจุบัน (รุ่นที่ ${s.versionNo}) โดยตรง</span></label>`}
        </div></div>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('insurerId', 'บริษัทประกันภัย *', select('insurerId', s.insurers.map((i) => [i.id, `${i.name} ${i.is_active ? '' : '(ปิดใช้งาน)'}`])))}
        ${field('insuranceType', 'ประเภทประกันภัย *', select('insuranceType', TYPES.map((t) => [t, t])))}
      </div>
      ${field('name', 'ชื่อแพ็กเกจประกัน *', input('name', 'text', 'เช่น วิริยะ ซุปเปอร์โปรเทค พรีเมียม หรือ ธนชาต 2+ ฟิต อุ่นใจ', 'required'))}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('effectiveFrom', 'วันเริ่มมีผลบังคับใช้', input('effectiveFrom', 'date'))}
        ${field('effectiveTo', 'วันสิ้นสุดผลบังคับใช้', input('effectiveTo', 'date'))}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('workflowStatus', 'สถานะข้อมูล (Workflow Status)', select('workflowStatus', [...(canPublish ? [['published', 'เผยแพร่ทันที (Published - แสดงในผลค้นหา)']] : []), ['in_review', 'ส่งตรวจ (In Review - ไปที่คิวตรวจสอบ)'], ['draft', 'บันทึกร่าง (Draft)']]))}
        ${field('notes', 'หมายเหตุของรุ่น (Version Notes)', input('notes', 'text', 'เช่น อัตราเบี้ยปี 2569 ได้รับอนุมัติแล้ว'))}
      </div></div>`;
  }

  function tabVehicle() {
    return `<div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('scopeType', 'ขอบเขตรุ่นรถที่รับประกัน', select('scopeType', [['all_models', 'รองรับทุกรุ่นภายใต้เงื่อนไข (All Models)'], ['specific_model', 'เฉพาะรุ่นรถที่ระบุ (Specific Model)'], ['unknown', 'ยังไม่ระบุขอบเขตรุ่นรถชัดเจน (Unknown)']], true))}
        ${s.scopeType === 'specific_model' ? field('vehicleModelId', 'เลือกรุ่นรถเฉพาะ *', select('vehicleModelId', [['', '-- กรุณาเลือกรุ่นรถ --'], ...s.vehicles.map((v) => [v.id, `${v.brand} ${v.model} (${v.variant || v.powertrain || 'ทั่วไป'})`])])) : ''}
      </div>
      <div class="grid grid-cols-3 gap-3">
        ${field('minCarAge', 'อายุรถขั้นต่ำ (ปี)', input('minCarAge', 'number', 'ไม่จำกัด', 'min="0"'))}
        ${field('maxCarAge', 'อายุรถสูงสุด (ปี)', input('maxCarAge', 'number', 'ไม่จำกัด', 'min="0"'))}
        ${field('ageBasis', 'เกณฑ์นับอายุรถ', select('ageBasis', [['registration_year', 'ปีจดทะเบียน'], ['manufacture_year', 'ปีที่ผลิต (ค.ศ.)']]))}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('usageType', 'ลักษณะการใช้งาน', select('usageType', [['private', 'การใช้งานส่วนบุคคล (Private)'], ['commercial', 'การพาณิชย์/รับจ้าง (Commercial)'], ['all', 'รองรับทุกรูปแบบ']]))}
        ${field('registrationZone', 'เงื่อนไขเขตป้ายทะเบียนรถ', select('registrationZone', [['all', 'รับทุกป้ายทะเบียน (ทั่วประเทศ)'], ['bangkok_only', 'เฉพาะรถป้าย กทม. เท่านั้น'], ['bangkok_metro', 'เฉพาะรถป้าย กทม. และปริมณฑล'], ['upcountry_only', 'เฉพาะรถป้ายต่างจังหวัด (ตจว.)']]))}
      </div>
      <label class="check-row"><input type="checkbox" data-bind="inspectionRequired" ${s.inspectionRequired ? 'checked' : ''}><span>ต้องตรวจสภาพรถก่อนทำประกัน</span></label>
    </div>`;
  }

  function tierCard(t, i) {
    const f = (name) => `data-tier="${i}" data-field="${name}"`;
    const id = (name) => `plan-tier-${i}-${name}`;
    const opts = (cur, list) => list.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('');
    const unknownToggle = (name, on) => `<label class="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer"><input type="checkbox" ${f(name)} data-invert data-rerender ${on ? '' : 'checked'}><span>ยังไม่ระบุ</span></label>`;
    const empty = (text) => `<div class="p-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold">${text}</div>`;
    return `<div class="border border-slate-200 rounded-2xl p-4 space-y-3">
      <div class="flex items-center gap-2">
        <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">${i + 1}</span>
        <input class="input" type="text" ${f('label')} value="${esc(t.label)}" placeholder="ชื่อตัวเลือกที่ ${i + 1}" aria-label="ชื่อตัวเลือกราคาที่ ${i + 1}">
        <button type="button" class="btn btn-soft" data-tier-copy="${i}" title="คัดลอกตัวเลือกนี้แล้วเปลี่ยนทุน">${icon('copy', 'w-3.5 h-3.5')}<span>คัดลอก</span></button>
        ${s.tiers.length > 1 ? `<button type="button" class="btn btn-red" data-tier-remove="${i}" title="ลบตัวเลือกราคานี้" aria-label="ลบตัวเลือกราคานี้">${icon('trash-2', 'w-3.5 h-3.5')}</button>` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><div class="flex justify-between"><label class="label" for="${id('sumInsuredMax')}">ทุนประกันภัย (บาท)</label>${unknownToggle('hasSumInsured', t.hasSumInsured)}</div>
          ${t.hasSumInsured ? `<input class="input" id="${id('sumInsuredMax')}" type="number" min="0" step="10000" placeholder="เช่น 50000 หรือ 100000" ${f('sumInsuredMax')} value="${esc(t.sumInsuredMax)}">` : empty('ยังไม่ระบุทุนประกัน')}</div>
        <div><div class="flex justify-between"><label class="label" for="${id('premiumTotal')}">เบี้ยประกันรวม (บาท)</label>${unknownToggle('hasPrice', t.hasPrice)}</div>
          ${t.hasPrice ? `<input class="input" id="${id('premiumTotal')}" type="number" min="0" step="100" placeholder="เช่น 5400" ${f('premiumTotal')} value="${esc(t.premiumTotal)}">` : empty('ยังไม่มีข้อมูลราคา')}</div>
        <div><label class="label" for="${id('repairType')}">ลักษณะการซ่อม *</label><select class="input" id="${id('repairType')}" ${f('repairType')}>${opts(t.repairType, [['garage', 'ซ่อมอู่ (อู่ในเครือ)'], ['dealer', 'ซ่อมห้าง (ศูนย์บริการ)']])}</select></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label class="label" for="${id('deductibleAmount')}">ค่าเสียหายส่วนแรก Deductible (บาท)</label><input class="input" id="${id('deductibleAmount')}" type="number" min="0" step="1000" placeholder="0 หากไม่มี" ${f('deductibleAmount')} value="${esc(t.deductibleAmount)}"></div>
        <div><label class="label" for="${id('compulsoryIncluded')}">การรวม พ.ร.บ.</label><select class="input" id="${id('compulsoryIncluded')}" ${f('compulsoryIncluded')}>${opts(t.compulsoryIncluded, [['excluded', 'ไม่รวม พ.ร.บ.'], ['included', 'รวม พ.ร.บ. แล้ว'], ['unspecified', 'ยังไม่ระบุ']])}</select></div>
        <div><label class="label" for="${id('driverConditions')}">เงื่อนไขผู้ขับขี่</label><input class="input" id="${id('driverConditions')}" type="text" placeholder="เช่น ไม่จำกัดชื่อ หรือ ระบุอายุ" ${f('driverConditions')} value="${esc(t.driverConditions)}"></div>
      </div></div>`;
  }

  function tabPrice() {
    return `<div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5">
        <div><span class="font-bold text-blue-950 block">ตารางทุนและเบี้ยประกันภัย (Price Options / Tiers)</span><p class="text-[11px] text-blue-900">แพ็กเกจชื่อเดียวกันสามารถมีได้หลายตัวเลือกราคา โดยระบุทุนประกันและเบี้ยที่ต่างกันได้ หากยังไม่ทราบราคาหรือทุนประกัน สามารถติ๊ก &quot;ยังไม่ระบุ&quot; ได้โดยไม่บันทึกเป็น 0 บาท</p></div>
        <button type="button" class="btn btn-primary" data-tier-add>${icon('plus', 'w-3.5 h-3.5')}<span>เพิ่มตัวเลือกราคา / ทุน</span></button>
      </div>
      ${s.tiers.map(tierCard).join('')}
      <button type="button" class="btn btn-outline w-full" data-tier-add>${icon('plus', 'w-3.5 h-3.5')}<span>เพิ่มตัวเลือกราคา / ทุนประกันอีกรายการ (เช่น ทุน 100,000 / 200,000 / 300,000)</span></button>
    </div>`;
  }

  function coverageRow(c) {
    const box = (name, type, placeholder, label) => `<input class="input" type="${type}" ${type === 'number' ? 'min="0"' : ''} placeholder="${placeholder}" aria-label="${esc(c.name)}: ${label}" data-cov="${c.code}" data-field="${name}" value="${esc(c[name])}">`;
    return `<div class="border border-slate-200 rounded-xl p-3 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2"><span class="font-semibold">${esc(c.name)}</span>
        <div class="flex flex-wrap gap-1">${STATUS.map(([v, l]) => `<button type="button" class="btn ${c.status === v ? 'btn-primary' : 'btn-soft'}" aria-pressed="${c.status === v}" data-cov-status="${c.code}" data-value="${v}">${l}</button>`).join('')}</div></div>
      ${c.status === 'covered' || c.status === 'optional' ? `<div class="grid grid-cols-1 sm:grid-cols-4 gap-2">${box('limitAmount', 'number', 'วงเงิน (บาท)', 'วงเงิน (บาท)')}${box('limitBasis', 'text', 'เกณฑ์วงเงิน เช่น ตามทุน, ต่อครั้ง', 'เกณฑ์วงเงิน')}${box('terms', 'text', 'เงื่อนไขความคุ้มครอง', 'เงื่อนไขความคุ้มครอง')}${box('exclusions', 'text', 'ข้อยกเว้น (ถ้ามี)', 'ข้อยกเว้น')}</div>` : ''}
    </div>`;
  }

  function tabCoverages() {
    const categories = [...new Set(s.coverageTypes.map((c) => c.category))];
    return `<div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2 bg-slate-50 rounded-xl p-3"><span class="font-bold">${icon('sparkles', 'w-3.5 h-3.5 inline')} ตั้งค่ามาตรฐานด่วนตามประเภทประกัน:</span>${TYPES.map((t) => `<button type="button" class="btn btn-outline" data-preset="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      ${categories.map((cat) => {
        const items = s.coverages.filter((c) => c.category === cat);
        return items.length ? `<div><h4 class="font-black mb-2">หมวด${esc(cat)} (${items.length} รายการ)</h4><div class="space-y-2">${items.map(coverageRow).join('')}</div></div>` : '';
      }).join('')}</div>`;
  }

  const fileSize = (b) => (!b || b <= 0 ? '' : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(2)} MB`);

  function tabDocument() {
    const uploaded = s.documentSourceUrl.startsWith('/api/documents/');
    return `<div class="space-y-4">
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5"><p class="font-bold text-blue-950">การอ้างอิงเอกสารต้นทาง (Section 8.4 &amp; Section 13)</p><p class="text-[11px] text-blue-900">ตามหลักการออกแบบ ทุกชุดข้อมูลที่เผยแพร่ต้องมีเอกสารอ้างอิงต้นทางอย่างน้อย 1 รายการ (Rate sheet, Brochure หรือ กรมธรรม์) สามารถอัปโหลดไฟล์เอกสารเข้าสู่ระบบโดยตรง หรือระบุลิงก์อ้างอิงพร้อมเลขหน้าเพื่อให้สมาชิกในทีมตรวจเทียบย้อนหลังได้</p></div>
      <div><label class="label" for="plan-document-file">ไฟล์เอกสารแนบ (PDF, รูปภาพ PNG/JPG/WEBP, หรือ Excel/CSV ไม่เกิน 15 MB)</label>
        <input id="plan-document-file" class="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv">
        ${uploaded ? `<div class="flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 rounded-xl p-3">
          <div class="flex items-center gap-2 min-w-0">${icon('file-text', 'w-5 h-5 text-emerald-700 shrink-0')}<div class="min-w-0"><div class="font-bold truncate">${esc(s.uploadedName || s.documentTitle || s.documentStoragePath)}</div><div class="text-[11px] text-slate-600 flex flex-wrap gap-2">${s.documentMimeType ? `<span>${esc(s.documentMimeType.split('/').pop())}</span>` : ''}${s.documentFileSize ? `<span>ขนาด ${fileSize(s.documentFileSize)}</span>` : ''}<span>อัปโหลดพร้อมบันทึกแล้ว</span></div></div></div>
          <div class="flex items-center gap-1"><a class="btn btn-outline" href="${esc(App.base + s.documentSourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('external-link', 'w-3.5 h-3.5')}<span>เปิดดูไฟล์</span></a><button type="button" class="btn btn-outline" data-file-pick ${s.uploading ? 'disabled' : ''}>${icon('upload', 'w-3.5 h-3.5')}<span>เปลี่ยนไฟล์</span></button><button type="button" class="btn btn-red" data-file-clear title="ลบไฟล์ที่แนบ" aria-label="ลบไฟล์ที่แนบ">${icon('x', 'w-3.5 h-3.5')}</button></div>
        </div>` : `<div data-drop tabindex="0" role="button" aria-label="เลือกไฟล์เอกสาร" class="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50">
          ${s.uploading ? `<div class="flex items-center justify-center gap-2">${icon('loader-circle', 'w-4 h-4 animate-spin')}<span>กำลังอัปโหลดไฟล์เอกสารเข้าสู่เซิร์ฟเวอร์...</span></div>` : `${icon('upload', 'w-6 h-6 mx-auto text-slate-400')}<p class="font-bold mt-1">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์เอกสารมาวางที่นี่</p><p class="text-[11px] text-slate-500">รองรับไฟล์ PDF, PNG, JPG, WEBP, XLSX, XLS, CSV (สูงสุดไม่เกิน 15 MB)</p>`}
        </div>`}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('sourceType', 'ประเภทเอกสาร', select('sourceType', [['rate_sheet', 'ตารางอัตราเบี้ยประกันภัย (Rate Sheet)'], ['policy_schedule', 'ตารางกรมธรรม์ (Policy Schedule)'], ['brochure', 'โบรชัวร์เผยแพร่ (Brochure)'], ['endorsement', 'เอกสารแนบท้าย (Endorsement)'], ['manual_note', 'บันทึกภายใน (Manual Note)'], ['other', 'เอกสารอื่น ๆ']]))}
        ${field('documentTitle', `ชื่อเอกสารอ้างอิง ${s.workflowStatus === 'published' ? '*' : ''}`, input('documentTitle', 'text', 'เช่น ตารางเบี้ยประกันภัยวิริยะ ซุปเปอร์โปรเทค 2569'))}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('documentRef', 'จุดอ้างอิง / เลขหน้าในเอกสาร', input('documentRef', 'text', 'เช่น หน้า 3-5 ตารางเบี้ยรถกลุ่ม 3, 4'))}
        ${uploaded ? '' : field('documentSourceUrl', 'ลิงก์เอกสารภายนอก (ถ้าไม่ได้อัปโหลดไฟล์)', input('documentSourceUrl', 'url', 'เช่น https://drive.google.com/...'))}
      </div></div>`;
  }

  const TABS = { info: tabInfo, vehicle: tabVehicle, price: tabPrice, coverages: tabCoverages, document: tabDocument };

  function render() {
    const body = dialog.querySelector('[data-body]');
    const scroll = body ? body.scrollTop : 0;
    const title = s.isCopy ? 'คัดลอกเพื่อสร้างแพ็กเกจใหม่' : s.plan ? 'แก้ไขแพ็กเกจประกันภัย' : 'เพิ่มแพ็กเกจประกันภัยใหม่';
    const tabs = [['info', '1. ข้อมูลแพ็กเกจ'], ['vehicle', '2. เงื่อนไขรถ'], ['price', `3. ราคาและทุนประกัน (${s.tiers.length} ตัวเลือก)`], ['coverages', `4. ความคุ้มครอง (${s.coverages.length} หมวด)`], ['document', '5. เอกสารอ้างอิง']];
    dialog.innerHTML = `<form class="bg-white rounded-3xl w-[min(56rem,calc(100vw-1.5rem))] max-h-[92vh] p-6 sm:p-8 flex flex-col text-xs" novalidate>
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
        <div><h2 id="plan-modal-title" class="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">${icon(s.isCopy ? 'copy' : 'layers', 'w-5 h-5 text-blue-600')}<span>${title}</span></h2>
          <p class="text-xs text-slate-500 mt-0.5">รองรับตารางหลายทุนและหลายเบี้ยในแพ็กเกจเดียวกัน (Multiple Price Tiers), เงื่อนไขรถ, ความคุ้มครอง ${s.coverageTypes.length} หมวดมาตรฐาน, และเอกสารต้นทาง</p></div>
        <button type="button" data-close aria-label="ปิดฟอร์ม" class="p-2 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer">${icon('x', 'w-5 h-5')}</button>
      </div>
      <div class="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-slate-100 shrink-0">${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" class="px-3 py-1.5 rounded-lg font-bold whitespace-nowrap cursor-pointer ${s.tab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">${label}</button>`).join('')}</div>
      ${s.error ? `<div role="alert" class="alert-red my-3 shrink-0 flex items-center gap-2">${icon('circle-alert', 'w-4 h-4 shrink-0')}<span>${esc(s.error)}</span></div>` : ''}
      <div data-body class="flex-1 overflow-y-auto py-4 pr-1">${TABS[s.tab]()}</div>
      <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 shrink-0">
        <div class="text-slate-500"><span>ผู้บันทึก:</span> <span class="font-bold text-slate-700">${esc(window.APP.userName)}</span></div>
        <div class="flex gap-2"><button type="button" class="btn btn-soft" data-close>ยกเลิก</button><button type="submit" class="btn btn-primary" ${s.busy ? 'disabled' : ''}>${icon('save', 'w-3.5 h-3.5')}<span>${s.busy ? 'กำลังบันทึก...' : 'บันทึกแพ็กเกจ'}</span></button></div>
      </div></form>`;
    dialog.querySelector('[data-body]').scrollTop = scroll;
    dialog.querySelector('form').addEventListener('submit', submit);
  }

  const goError = (message, tab) => { s.error = message; if (tab) s.tab = tab; render(); };
  const numberOrNull = (v) => (v === '' ? null : Number(v));

  async function upload(file) {
    s.error = '';
    if (file.size > 15 * 1024 * 1024) return goError('ขนาดไฟล์เกินกำหนด (สูงสุดไม่เกิน 15 MB)');
    s.uploading = true;
    render();
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${App.base}/api/documents/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.sourceUrl || !data.storagePath) throw new Error(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ');
      Object.assign(s, { documentStoragePath: data.storagePath, documentSourceUrl: data.sourceUrl, documentFileSize: data.fileSize ?? file.size, documentMimeType: data.mimeType ?? file.type, uploadedName: data.originalName ?? file.name });
      if (!s.documentTitle.trim()) s.documentTitle = s.uploadedName.replace(/\.[^.]+$/, '');
    } catch (err) {
      s.error = err.message || 'อัปโหลดเอกสารไม่สำเร็จ';
    }
    s.uploading = false;
    render();
  }

  async function submit(e) {
    e.preventDefault();
    s.error = '';
    if (!s.insurerId) return goError('กรุณาเลือกบริษัทประกันภัย', 'info');
    if (!s.name.trim()) return goError('กรุณากรอกชื่อแพ็กเกจประกัน', 'info');
    if (s.effectiveFrom && s.effectiveTo && s.effectiveTo < s.effectiveFrom) return goError('วันสิ้นสุดผลบังคับใช้ต้องไม่ก่อนวันเริ่มต้น', 'info');

    const minAge = numberOrNull(s.minCarAge), maxAge = numberOrNull(s.maxCarAge);
    if (s.scopeType === 'specific_model' && !s.vehicleModelId) return goError('กรุณาเลือกรุ่นรถสำหรับเงื่อนไขระบุรุ่นเฉพาะ', 'vehicle');
    if ((minAge !== null && minAge < 0) || (maxAge !== null && maxAge < 0)) return goError('อายุรถต้องไม่ติดลบ', 'vehicle');
    if (minAge !== null && maxAge !== null && maxAge < minAge) return goError('อายุรถสูงสุดต้องไม่น้อยกว่าอายุรถขั้นต่ำ', 'vehicle');

    const money = (t) => ({ premium: t.hasPrice && t.premiumTotal !== '' ? Number(t.premiumTotal) : null, sum: t.hasSumInsured && t.sumInsuredMax !== '' ? Number(t.sumInsuredMax) : null });
    for (const [i, t] of s.tiers.entries()) {
      const { premium, sum } = money(t);
      const deductible = t.deductibleAmount !== '' ? Number(t.deductibleAmount) : 0;
      const issue = premium !== null && premium < 0 ? 'เบี้ยรวมต้องไม่ติดลบ' : sum !== null && sum < 0 ? 'ทุนประกันต้องไม่ติดลบ' : deductible < 0 ? 'ค่าเสียหายส่วนแรกต้องไม่ติดลบ' : '';
      if (issue) return goError(`ตัวเลือกที่ ${i + 1}: ${issue}`, 'price');
    }

    const status = !window.APP.canPublish && s.workflowStatus === 'published' ? 'in_review' : s.workflowStatus;
    const link = s.documentSourceUrl.trim();
    if (link && !link.startsWith('/api/documents/') && !/^https?:\/\/.+/i.test(link)) return goError('ลิงก์เอกสารภายนอกต้องขึ้นต้นด้วย http:// หรือ https://', 'document');
    if (status === 'published' && !s.documentTitle.trim() && !link) return goError('ตามกฎ Section 8.4 ต้องระบุชื่อเอกสารหรืออัปโหลดไฟล์เอกสารต้นทางอย่างน้อย 1 รายการก่อนเผยแพร่', 'document');

    s.busy = true;
    render();
    const editing = Boolean(s.plan) && !s.isCopy;
    const payload = {
      insurerId: s.insurerId, name: s.name, insuranceType: s.insuranceType, workflowStatus: status,
      effectiveFrom: s.effectiveFrom || null, effectiveTo: s.effectiveTo || null,
      notes: s.saveMode === 'new_version' && editing ? s.notes || `ปรับปรุงข้อมูลจากรุ่นที่ ${s.versionNo}` : s.notes,
      scopeType: s.scopeType, vehicleModelId: s.scopeType === 'specific_model' ? s.vehicleModelId : null,
      minCarAge: minAge, maxCarAge: maxAge, ageBasis: s.ageBasis, usageType: s.usageType, registrationZone: s.registrationZone, inspectionRequired: s.inspectionRequired,
      priceOptions: s.tiers.map((t) => {
        const { premium, sum } = money(t);
        return { ...(editing && s.saveMode !== 'new_version' && t.id ? { id: t.id } : {}), label: t.label.trim() || autoLabel(t.repairType, t.hasSumInsured, t.sumInsuredMax), repairType: t.repairType, priceType: premium !== null ? t.priceType : 'unknown', premiumTotal: premium, sumInsuredMin: sum, sumInsuredMax: sum, deductibleAmount: Number(t.deductibleAmount || 0), ...(t.deductibleTerms ? { deductibleTerms: t.deductibleTerms } : {}), compulsoryIncluded: t.compulsoryIncluded, driverConditions: t.driverConditions || DEFAULT_DRIVER, validFrom: s.effectiveFrom || null, validTo: s.effectiveTo || null };
      }),
      coverages: s.coverages.map((c) => ({ code: c.code, status: c.status, limitAmount: c.limitAmount !== '' ? Number(c.limitAmount) : null, ...(c.limitBasis ? { limitBasis: c.limitBasis } : {}), ...(c.terms ? { terms: c.terms } : {}), ...(c.exclusions ? { exclusions: c.exclusions } : {}) })),
      sourceType: s.sourceType, documentStoragePath: s.documentStoragePath, documentSourceUrl: link || null, documentFileSize: s.documentFileSize, documentMimeType: s.documentMimeType,
      ...(s.documentTitle ? { documentTitle: s.documentTitle } : {}), ...(s.documentRef ? { documentRef: s.documentRef } : {}),
      ...(editing ? { planId: s.plan.id } : {}), ...(editing && s.saveMode === 'update' && s.versionId ? { versionId: s.versionId } : {}),
    };
    try {
      const saved = await App.action('savePlan', payload);
      const copied = s.isCopy;
      dialog.close();
      onSaved(saved.plan.id, copied);
    } catch (err) {
      s.busy = false;
      goError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    }
  }

  function onInput(e) {
    const el = e.target;
    const value = el.type === 'checkbox' ? (el.dataset.invert !== undefined ? !el.checked : el.checked) : el.value;
    if (el.dataset.bind) {
      if (el.type === 'radio' && !el.checked) return;
      s[el.dataset.bind] = value;
    } else if (el.dataset.tier !== undefined) {
      const tier = s.tiers[Number(el.dataset.tier)];
      const previous = tier.label;
      tier[el.dataset.field] = value;
      if (['sumInsuredMax', 'repairType', 'hasSumInsured'].includes(el.dataset.field) && isAutoLabel(previous)) {
        tier.label = autoLabel(tier.repairType, tier.hasSumInsured, tier.sumInsuredMax);
        const labelBox = dialog.querySelector(`[data-tier="${el.dataset.tier}"][data-field="label"]`);
        if (labelBox) labelBox.value = tier.label;
      }
    } else if (el.dataset.cov) {
      s.coverages.find((c) => c.code === el.dataset.cov)[el.dataset.field] = value;
    }
  }

  function onChange(e) {
    const el = e.target;
    if (el.id === 'plan-document-file') {
      if (el.files[0]) upload(el.files[0]);
      return;
    }
    if (el.dataset.bind === 'insuranceType') {
      const reset = !s.plan || confirm(`ต้องการรีเซ็ตตารางความคุ้มครอง ${s.coverageTypes.length} หมวดให้เป็นค่าเริ่มต้นของ "${el.value}" หรือไม่? (กดยกเลิกเพื่อคงค่าที่ปรับแต่งไว้เดิม)`);
      if (reset) s.coverages = coveragePreset(el.value, s.coverageTypes);
    }
    if (el.dataset.rerender !== undefined) render();
  }

  function onClick(e) {
    const on = (selector) => e.target.closest(selector);
    let el;
    if (on('[data-close]')) dialog.close();
    else if ((el = on('[data-tab]'))) { s.tab = el.dataset.tab; render(); }
    else if (on('[data-tier-add]')) {
      const last = s.tiers[s.tiers.length - 1];
      const sum = last && last.hasSumInsured ? Number(last.sumInsuredMax || 0) + 100000 : 100000;
      const premium = last && last.hasPrice ? Number(last.premiumTotal || 0) + 1000 : 6500;
      const repair = last ? last.repairType : 'garage';
      s.tiers.push(blankTier({ label: autoLabel(repair, true, sum), repairType: repair, premiumTotal: premium, sumInsuredMax: sum }));
      render();
    } else if ((el = on('[data-tier-copy]'))) {
      const index = Number(el.dataset.tierCopy);
      const source = s.tiers[index];
      const sum = source.hasSumInsured ? Number(source.sumInsuredMax || 0) + 50000 : '';
      const premium = source.hasPrice ? Number(source.premiumTotal || 0) + 800 : '';
      s.tiers.splice(index + 1, 0, { ...source, id: undefined, label: autoLabel(source.repairType, source.hasSumInsured, sum), sumInsuredMax: sum, premiumTotal: premium });
      render();
    } else if ((el = on('[data-tier-remove]'))) { s.tiers.splice(Number(el.dataset.tierRemove), 1); render(); }
    else if ((el = on('[data-cov-status]'))) { s.coverages.find((c) => c.code === el.dataset.covStatus).status = el.dataset.value; render(); }
    else if ((el = on('[data-preset]'))) { s.coverages = coveragePreset(el.dataset.preset, s.coverageTypes); render(); }
    else if (on('[data-file-pick]')) dialog.querySelector('#plan-document-file').click();
    else if (on('[data-file-clear]')) { Object.assign(s, { documentStoragePath: null, documentSourceUrl: '', documentFileSize: null, documentMimeType: null, uploadedName: '' }); render(); }
    else if (on('[data-drop]') && !s.uploading) dialog.querySelector('#plan-document-file').click();
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'plan-modal-title');
    document.body.append(dialog);
    dialog.addEventListener('input', onInput);
    dialog.addEventListener('change', onChange);
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-drop]')) { e.preventDefault(); dialog.querySelector('#plan-document-file').click(); }
    });
    dialog.addEventListener('dragover', (e) => e.preventDefault());
    dialog.addEventListener('drop', (e) => {
      if (!e.target.closest('[data-drop]')) return;
      e.preventDefault();
      if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
    });
    // Escape is easy to hit by accident and this form can hold a lot of unsaved work.
    dialog.addEventListener('cancel', (e) => {
      if (!s || s.busy || !confirm('ปิดฟอร์มนี้หรือไม่? ข้อมูลที่ยังไม่ได้บันทึกจะหายไป')) e.preventDefault();
    });
  }

  async function open(plan, isCopy) {
    ensureDialog();
    onSaved = (savedId, copied) => {
      if (copied && location.pathname.includes('/plans/') && !location.pathname.includes('/manage/')) { location.href = `${App.base}/plans/${savedId}`; return; }
      if (copied) App.flash('คัดลอกและสร้างแพ็กเกจประกันภัยใหม่เรียบร้อยแล้ว');
      location.reload();
    };
    s = null;
    dialog.innerHTML = '<div role="status" class="bg-white rounded-2xl p-6 text-sm text-slate-700">กำลังโหลดข้อมูลแพ็กเกจ...</div>';
    dialog.showModal();
    try {
      const data = await App.action('planForm', plan ? plan.id : null);
      s = initialState(plan, isCopy, data);
      render();
    } catch (err) {
      dialog.innerHTML = `<div class="bg-white rounded-2xl p-6 text-center space-y-3 max-w-sm"><p role="alert" class="text-sm text-slate-700">${esc(err.message)}</p><button type="button" class="btn btn-soft" data-close>ปิด</button></div>`;
    }
  }

  return { open };
})();
