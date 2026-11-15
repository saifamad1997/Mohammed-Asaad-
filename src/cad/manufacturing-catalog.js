const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const uid = () => 'part-' + Math.random().toString(36).slice(2, 10);

export async function mountManufacturingCatalog(root, { supabase, user }) {
  if (!root || !supabase || !user) return () => {};
  let projects = [];
  let selected = null;
  let catalog = blankCatalog();
  let dirty = false;

  function blankCatalog() {
    return {
      version: 1,
      title: '',
      itemType: 'خزانة',
      width: 0, height: 0, depth: 0,
      board: { material: '', width: 0, height: 0, thickness: 0, kerf: 0, available: 0, grain: 'locked' },
      parts: [],
      notes: '',
      approved: false
    };
  }
  const saveBlob = (name, content, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };
  const projectLabel = p => '#' + (p.project_no ?? '—') + ' · ' + p.title;

  root.innerHTML = '<div class="mfg-loading">جارٍ تحميل كتالوجات التصنيع…</div>';
  try {
    const { data, error } = await supabase.from('projects')
      .select('id,project_no,title,furniture_type,status,design_data,created_at')
      .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    projects = data || [];
  } catch (error) {
    root.innerHTML = '<div class="error-card"><strong>تعذر تحميل المشاريع</strong><p>' + esc(error.message) + '</p></div>';
    return () => {};
  }

  function selectedProject() { return projects.find(p => p.id === selected); }
  function hydrate(project) {
    const saved = project?.design_data?.manufacturing_catalog;
    catalog = saved && saved.version === 1 ? JSON.parse(JSON.stringify(saved)) : blankCatalog();
    catalog.title ||= project?.title || '';
    catalog.itemType ||= project?.furniture_type || 'قطعة أثاث';
    dirty = false;
  }
  function computeLayout() {
    const board = catalog.board;
    const bw = number(board.width), bh = number(board.height), kerf = Math.max(0, number(board.kerf));
    if (!(bw > 0 && bh > 0)) return { sheets: [], errors: ['أدخل مقاس اللوح أولاً.'] };
    const parts = [];
    const errors = [];
    if (!String(board.material || '').trim()) errors.push('حدد نوع اللوح أو خامته قبل اعتماد الكتالوج.');
    if (!(number(board.thickness) > 0)) errors.push('أدخل سماكة اللوح الفعلية بالملليمتر.');
    for (const part of catalog.parts) {
      const w = number(part.width), h = number(part.height), qty = Math.floor(number(part.qty));
      if (!(w > 0 && h > 0 && qty > 0)) { errors.push('راجع مقاسات أو كمية القطعة: ' + (part.name || 'بدون اسم')); continue; }
      for (let i = 0; i < qty; i++) parts.push({ name: part.name || 'قطعة', width: w, height: h, grain: part.grain !== false, sourceId: part.id, index: i + 1 });
    }
    parts.sort((a, b) => b.width * b.height - a.width * a.height);
    const sheets = [];
    for (const part of parts) {
      let placed = false;
      const orientations = board.grain === 'free' || !part.grain
        ? [{w: part.width, h: part.height, rotated: false}, {w: part.height, h: part.width, rotated: true}]
        : [{w: part.width, h: part.height, rotated: false}];
      for (let si = 0; si < sheets.length && !placed; si++) {
        const sheet = sheets[si];
        for (const o of orientations) {
          if (o.w > bw || o.h > bh) continue;
          let row = sheet.rows[sheet.rows.length - 1];
          if (row && o.h <= row.height && row.x + o.w + (row.x ? kerf : 0) <= bw) {
            const x = row.x + (row.x ? kerf : 0);
            sheet.placements.push({ ...part, x, y: row.y, w: o.w, h: o.h, rotated: o.rotated });
            row.x = x + o.w; placed = true; break;
          }
          const y = row ? row.y + row.height + kerf : 0;
          if (y + o.h <= bh) {
            sheet.rows.push({ y, height: o.h, x: o.w });
            sheet.placements.push({ ...part, x: 0, y, w: o.w, h: o.h, rotated: o.rotated });
            placed = true; break;
          }
        }
      }
      if (!placed) {
        const sheet = { rows: [], placements: [] };
        for (const o of orientations) {
          if (o.w <= bw && o.h <= bh) {
            sheet.rows.push({ y: 0, height: o.h, x: o.w });
            sheet.placements.push({ ...part, x: 0, y: 0, w: o.w, h: o.h, rotated: o.rotated });
            placed = true; break;
          }
        }
        if (placed) sheets.push(sheet);
        else errors.push('القطعة «' + part.name + '» (' + part.width + '×' + part.height + ' مم) لا تدخل في اللوح المحدد.');
      }
    }
    return { sheets, errors };
  }
  function markDirty() { dirty = true; catalog.approved = false; }
  function render() {
    const project = selectedProject();
    if (!project) {
      root.innerHTML = `
        <section class="mfg-hero"><div><span class="mfg-kicker">MANUFACTURING CATALOG</span><h2>من التصميم إلى ورقة النجار</h2><p>اختر مشروعاً لفتح كتالوج التصنيع الخاص به، أو ابدأ بمشروع جديد من قسم المشاريع.</p></div></section>
        <section class="section-card"><div class="section-heading"><div><h2>مشاريع الشركة</h2><p>كل مشروع يحتفظ بكتالوجه وبيانات التصنيع.</p></div></div>
          <div class="mfg-project-list">${projects.map(p => `<button class="mfg-project" data-project="${esc(p.id)}"><strong>${esc(projectLabel(p))}</strong><span>${esc(p.furniture_type || 'نوع الأثاث غير محدد')}</span><b>فتح الكتالوج ←</b></button>`).join('') || '<p class="muted">لا توجد مشاريع. أنشئ مشروعاً أولاً.</p>'}</div>
        </section>`;
      root.querySelectorAll('[data-project]').forEach(b => b.onclick = () => { selected = b.dataset.project; hydrate(selectedProject()); render(); });
      return;
    }
    const layout = computeLayout();
    const totalParts = catalog.parts.reduce((sum, p) => sum + Math.max(0, Math.floor(number(p.qty))), 0);
    const board = catalog.board;
    const available = Math.max(0, Math.floor(number(board.available)));
    const sheetCount = layout.sheets.length;
    root.innerHTML = `
      <section class="mfg-hero"><div><span class="mfg-kicker">PROJECT #${esc(project.project_no)}</span><h2>${esc(project.title)}</h2><p>كتالوج تصنيع مستقل محفوظ داخل ملف المشروع. أدخل بيانات الألواح والقطع الفعلية قبل اعتماد خطة القص.</p></div><button class="btn" data-back>كل المشاريع</button></section>
      <div class="mfg-toolbar"><span class="mfg-save-state">${dirty ? '● تغييرات غير محفوظة' : '✓ آخر نسخة محفوظة'}</span><div><button class="btn" data-save>حفظ الكتالوج</button><button class="btn btn-primary" data-print>طباعة ورقة النجار</button></div></div>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>1. بيانات التصميم</h2><p>المقاسات الخارجية بالملليمتر.</p></div></div>
        <div class="mfg-fields">
          <label>اسم الكتالوج<input data-field="title" value="${esc(catalog.title)}"></label>
          <label>نوع القطعة<input data-field="itemType" value="${esc(catalog.itemType)}"></label>
          <label>العرض (مم)<input type="number" min="1" data-field="width" value="${number(catalog.width)}"></label>
          <label>الارتفاع (مم)<input type="number" min="1" data-field="height" value="${number(catalog.height)}"></label>
          <label>العمق (مم)<input type="number" min="1" data-field="depth" value="${number(catalog.depth)}"></label>
        </div>
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>2. مواصفات اللوح المتوفر</h2><p>أدخل المقاس والسماكة والهدر المتاح من واقع المستودع؛ لا يتم خصم أي مخزون تلقائياً.</p></div></div>
        <div class="mfg-fields">
          <label>نوع / لون اللوح<input data-board="material" value="${esc(board.material)}" placeholder="مثال: MDF ميلامين أبيض"></label>
          <label>عرض اللوح (مم)<input type="number" min="1" data-board="width" value="${number(board.width)}"></label>
          <label>طول اللوح (مم)<input type="number" min="1" data-board="height" value="${number(board.height)}"></label>
          <label>السماكة (مم)<input type="number" min="1" data-board="thickness" value="${number(board.thickness)}"></label>
          <label>عرض شفرة المنشار (مم)<input type="number" min="0" step="0.1" data-board="kerf" value="${number(board.kerf)}"></label>
          <label>ألواح متوفرة حالياً<input type="number" min="0" step="1" data-board="available" value="${available}"></label>
          <label>اتجاه العروق<select data-board="grain"><option value="locked" ${board.grain !== 'free' ? 'selected' : ''}>ثابت — يمنع تدوير القطع</option><option value="free" ${board.grain === 'free' ? 'selected' : ''}>غير مقيّد — يسمح بالتدوير</option></select></label>
        </div>
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>3. قائمة القطع</h2><p>أدخل كل قطعة كما يجب أن تُقص، مع العدد والمقاسات الصافية.</p></div><button class="btn btn-primary" data-add-part>＋ إضافة قطعة</button></div>
        <div class="table-wrap"><table class="mfg-parts"><thead><tr><th>اسم القطعة</th><th>العرض مم</th><th>الطول مم</th><th>العدد</th><th>اتجاه العروق</th><th></th></tr></thead><tbody>
          ${catalog.parts.map(p => `<tr data-part="${esc(p.id)}"><td><input data-part-field="name" value="${esc(p.name)}"></td><td><input type="number" min="1" data-part-field="width" value="${number(p.width)}"></td><td><input type="number" min="1" data-part-field="height" value="${number(p.height)}"></td><td><input type="number" min="1" step="1" data-part-field="qty" value="${number(p.qty)}"></td><td><select data-part-field="grain"><option value="true" ${p.grain !== false ? 'selected' : ''}>ثابت</option><option value="false" ${p.grain === false ? 'selected' : ''}>مسموح تدويرها</option></select></td><td><button class="btn btn-small" data-remove-part="${esc(p.id)}">حذف</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">أضف القطع المطلوبة لبدء حساب الألواح.</td></tr>'}
        </tbody></table></div>
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>4. ملخص الألواح وخطة القص الأولية</h2><p>ترتيب مستطيلات أولي يراعي kerf واتجاه العروق المسجل؛ ليس تحسين قص احترافياً معتمداً.</p></div></div>
        <div class="mfg-summary"><article><span>إجمالي القطع</span><strong>${totalParts}</strong></article><article><span>الألواح المحسوبة</span><strong>${sheetCount}</strong></article><article><span>المتوفر المدخل</span><strong>${available}</strong></article><article><span>العجز التقديري</span><strong>${Math.max(0, sheetCount - available)}</strong></article></div>
        ${layout.errors.length ? '<div class="notice-card"><strong>تنبيهات الخطة</strong><ul>' + layout.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div>' : ''}
        <div class="mfg-sheets">${layout.sheets.map((sheet, i) => `
          <article class="mfg-sheet"><h3>لوح رقم ${i + 1} · ${number(board.width)} × ${number(board.height)} مم</h3>
            <svg viewBox="0 0 ${Math.max(1,number(board.width))} ${Math.max(1,number(board.height))}" role="img" aria-label="مخطط توزيع القطع على اللوح">
              <rect x="0" y="0" width="${number(board.width)}" height="${number(board.height)}" fill="#f7faf8" stroke="#68877a" stroke-width="8"/>
              ${sheet.placements.map((p, pi) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${pi % 2 ? '#dceee8' : '#e8f0e8'}" stroke="#367e70" stroke-width="5"/><text x="${p.x + p.w/2}" y="${p.y + p.h/2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(22,Math.min(64,Math.min(p.w,p.h)/5))}" fill="#234b41">${esc(p.name)}</text>`).join('')}
            </svg>
            <p>${sheet.placements.length} قطعة موضوعة · المساحات غير المرسومة متبقية / هدر قص محتمل</p>
          </article>`).join('') || '<p class="muted">أدخل قطعاً صالحة لتظهر خريطة القص.</p>'}
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>5. ملاحظات التصنيع والاعتماد</h2><p>التصميم لا يُعتمد قبل مراجعة الحواف والثقوب والإكسسوارات وطريقة التجميع.</p></div><span class="status-tag">${catalog.approved ? 'معتمد للمراجعة النهائية' : 'مسودة غير معتمدة'}</span></div>
        <label class="mfg-notes">ملاحظات النجار / الحواف / المفصلات / السكك / التجميع<textarea data-notes rows="4">${esc(catalog.notes)}</textarea></label>
        <div class="mfg-approval"><button class="btn" data-approve>اعتماد بيانات الكتالوج للمراجعة</button><small>الاعتماد هنا لا يخصم المخزون ولا يحوّل الخطة الأولية إلى مخطط تصنيع نهائي.</small></div>
      </section>
    `;
    root.querySelector('[data-back]').onclick = () => { selected = null; render(); };
    root.querySelectorAll('[data-field]').forEach(el => el.addEventListener('change', () => { const key = el.dataset.field; catalog[key] = ['width','height','depth'].includes(key) ? number(el.value) : el.value; markDirty(); render(); }));
    root.querySelectorAll('[data-board]').forEach(el => el.addEventListener('change', () => { const key = el.dataset.board; catalog.board[key] = ['width','height','thickness','kerf','available'].includes(key) ? number(el.value) : el.value; markDirty(); render(); }));
    root.querySelectorAll('[data-part-field]').forEach(el => el.addEventListener('change', () => { const row = el.closest('[data-part]'); const part = catalog.parts.find(p => p.id === row.dataset.part); const key = el.dataset.partField; part[key] = ['width','height','qty'].includes(key) ? number(el.value) : key === 'grain' ? el.value === 'true' : el.value; markDirty(); render(); }));
    root.querySelectorAll('[data-remove-part]').forEach(el => el.onclick = () => { catalog.parts = catalog.parts.filter(p => p.id !== el.dataset.removePart); markDirty(); render(); });
    root.querySelector('[data-add-part]').onclick = () => { catalog.parts.push({ id: uid(), name: 'قطعة جديدة', width: 0, height: 0, qty: 1, grain: true }); markDirty(); render(); };
    root.querySelector('[data-notes]').addEventListener('change', e => { catalog.notes = e.target.value; markDirty(); });
    root.querySelector('[data-save]').onclick = save;
    root.querySelector('[data-print]').onclick = () => window.print();
    root.querySelector('[data-approve]').onclick = () => { markDirty(); catalog.approved = true; save(); };
  }
  async function save() {
    const project = selectedProject();
    if (!project) return;
    const button = root.querySelector('[data-save]');
    if (button) { button.disabled = true; button.textContent = 'جارٍ الحفظ…'; }
    try {
      const nextDesignData = { ...(project.design_data || {}), manufacturing_catalog: { ...catalog, updated_at: new Date().toISOString() } };
      const { error } = await supabase.from('projects').update({ design_data: nextDesignData }).eq('id', project.id).eq('owner_id', user.id);
      if (error) throw error;
      project.design_data = nextDesignData;
      dirty = false;
      render();
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = 'إعادة المحاولة'; }
      alert('تعذر حفظ الكتالوج: ' + (error.message || 'خطأ غير معروف'));
    }
  }
  render();
  return () => {};
}
