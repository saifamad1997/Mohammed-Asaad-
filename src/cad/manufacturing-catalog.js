const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const uid = (prefix = 'id') => prefix + '-' + Math.random().toString(36).slice(2, 10);

export async function mountManufacturingCatalog(root, { supabase, user }) {
  if (!root || !supabase || !user) return () => {};
  let projects = [];
  let selected = null;
  let catalog = blankCatalog();
  let dirty = false;
  let displayUnit = 'cm';
  const unitFactor = () => displayUnit === 'cm' ? 10 : 1;
  const fromMm = value => Number((number(value) / unitFactor()).toFixed(displayUnit === 'cm' ? 1 : 0));
  const toMm = value => number(value) * unitFactor();
  const unitLabel = () => displayUnit === 'cm' ? 'سم' : 'مم';

  function blankCatalog() {
    return {
      version: 2,
      assembly: { coordinateSystem: 'origin-bottom-left-back', units: 'mm', placementMode: 'explicit' },
      assemblies: [],
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
    catalog = saved && [1, 2].includes(saved.version) ? JSON.parse(JSON.stringify(saved)) : blankCatalog();
    catalog.version = 2;
    catalog.assembly ||= { coordinateSystem: 'origin-bottom-left-back', units: 'mm', placementMode: 'explicit' };
    catalog.assemblies = (Array.isArray(catalog.assemblies) ? catalog.assemblies : []).map(g => ({ id: g.id || uid('assembly'), name: g.name || 'مجموعة تجميع', type: g.type || 'custom', origin: g.origin || null, state: 'draft' }));
    catalog.parts = (catalog.parts || []).map(part => ({ ...part, position: part.position || null, rotation: part.rotation || { x: 0, y: 0, z: 0 }, orientation: part.orientation || { plane: 'xy' }, joinery: Array.isArray(part.joinery) ? part.joinery : [], hardware: Array.isArray(part.hardware) ? part.hardware : [] }));
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
    if (!(number(catalog.width) > 0 && number(catalog.height) > 0 && number(catalog.depth) > 0)) errors.push('أدخل أبعاد قطعة الأثاث الخارجية كاملة قبل اعتمادها.');
    if (!String(board.material || '').trim()) errors.push('حدد نوع اللوح أو خامته قبل اعتماد الكتالوج.');
    if (!(number(board.thickness) > 0)) errors.push('أدخل سماكة اللوح الفعلية بالملليمتر.');
    for (const part of catalog.parts) {
      const w = number(part.width), h = number(part.height), qty = number(part.qty);
      if (!(w > 0 && h > 0 && Number.isInteger(qty) && qty > 0)) { errors.push('راجع مقاسات القطعة والكمية الصحيحة (عدد صحيح موجب): ' + (part.name || 'بدون اسم')); continue; }
      for (let i = 0; i < qty; i++) parts.push({ name: part.name || 'قطعة', width: w, height: h, grain: part.grain !== false, sourceId: part.id, index: i + 1 });
    }
    if (!parts.length) errors.push('أضف قطعة واحدة على الأقل إلى قائمة القص.');
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
  function assemblyPreview() {
    const parts = catalog.parts.filter(p => number(p.width) > 0 && number(p.height) > 0 && number(p.qty) > 0);
    const missing = parts.filter(p => !p.position || !['x','y','z'].every(k => p.position[k] !== null && p.position[k] !== '' && Number.isFinite(Number(p.position[k]))) || !['xy','xz','yz'].includes(p.orientation?.plane));
    const repeated = parts.filter(p => number(p.qty) !== 1);
    return { parts, missing, repeated, complete: parts.length > 0 && missing.length === 0 && repeated.length === 0 };
  }
  function assemblyMarkup() {
    const a = assemblyPreview();
    const groupsMarkup = '<div class="mfg-assembly-groups"><div class="section-heading"><div><h3>مجموعات التجميع</h3><p>أنشئ مجموعات مثل جسم الخزانة والأبواب والأدراج، ثم اربط كل قطعة بها. لا تُنشأ وصلات تلقائية.</p></div><button type="button" class="btn btn-primary" data-add-assembly>＋ مجموعة جديدة</button></div>' + (catalog.assemblies.map(g => '<div class="mfg-assembly-group" data-assembly="'+esc(g.id)+'"><label>اسم المجموعة<input data-assembly-field="name" value="'+esc(g.name)+'"></label><label>نوع المجموعة<select data-assembly-field="type"><option value="cabinet" '+(g.type==='cabinet'?'selected':'')+'>جسم خزانة</option><option value="doors" '+(g.type==='doors'?'selected':'')+'>أبواب</option><option value="drawers" '+(g.type==='drawers'?'selected':'')+'>أدراج</option><option value="frame" '+(g.type==='frame'?'selected':'')+'>هيكل</option><option value="custom" '+(g.type==='custom'?'selected':'')+'>مخصص</option></select></label><span>الأعضاء: '+catalog.parts.filter(p=>p.assemblyId===g.id).length+'</span><button type="button" class="btn btn-small" data-remove-assembly="'+esc(g.id)+'">حذف المجموعة</button></div>').join('') || '<p class="muted">لا توجد مجموعات بعد.</p>') + '</div>';
    if (!a.complete) return groupsMarkup + `<div class="notice-card"><strong>مواضع التجميع غير مكتملة</strong><p>لا توجد معاينة مركّبة. أدخل X وY وZ لكل قطعة، واجعل كمية كل سجل 1؛ لا نخمن مواقع التركيب ولا نكرر موضعاً واحداً لعدة نسخ.</p><ul>${a.missing.length ? '<li>تحتاج موضعاً: ' + a.missing.map(p => esc(p.name || 'قطعة بلا اسم')).join('، ') + '</li>' : ''}${a.repeated.length ? '<li>افصل النسخ إلى سجلات مستقلة: ' + a.repeated.map(p => esc(p.name || 'قطعة بلا اسم')).join('، ') + '</li>' : ''}</ul></div>`;
    return groupsMarkup + `<div class="notice-card"><strong>مواضع صريحة مدخلة</strong><p>الإحداثيات بالملليمتر وفق نقطة الأصل أسفل-يسار-خلف. هذا تحقق من وجود المواضع فقط، وليس اعتماداً لصحة الوصلات أو الخلوصات أو الإكسسوارات.</p><div class="mfg-exploded-list">${a.parts.map(p => `<div class="mfg-exploded-row"><span>${esc(p.name || 'قطعة')}</span><strong>X ${fromMm(p.position.x)} · Y ${fromMm(p.position.y)} · Z ${fromMm(p.position.z)} ${unitLabel()}</strong><small>دوران Z: ${number(p.rotation?.z)}°</small></div>`).join('')}</div></div>`;
  }
  function markDirty() { dirty = true; catalog.approved = false; }
  function render() {
    const project = selectedProject();
    if (!project) {
      root.innerHTML = `
        <section class="mfg-hero"><div><span class="mfg-kicker">MANUFACTURING WORKSPACE</span><h2>من التصميم إلى ورقة النجار</h2><p>ابدأ قطعة أثاث من الصفر، أو أكمل كتالوج تصنيع محفوظاً داخل مشروع سابق.</p></div></section>
        <section class="section-card mfg-section">
          <div class="section-heading"><div><h2>ابدأ العمل</h2><p>لا تحتاج إلى تسجيل عميل أو إنشاء مشروع مسبقاً من قسم آخر.</p></div></div>
          <form class="mfg-new-project" data-new-project>
            <label>اسم التصميم<input name="title" required maxlength="120" placeholder="مثال: خزانة غرفة النوم"></label>
            <label>نوع الأثاث<input name="furniture_type" required maxlength="80" placeholder="خزانة، مطبخ، مكتب، سرير…"></label>
            <label class="mfg-reference-upload">صورة مرجعية (اختياري)
              <input name="reference_image" type="file" accept="image/png,image/jpeg,image/webp">
              <span>＋ اختر صورة أو رسمة من جهازك</span>
            </label>
            <div class="mfg-reference-preview" data-image-preview hidden></div>
            <button class="btn btn-primary" type="submit">＋ بدء التصميم وتحليل الصورة</button>
            <p class="muted" data-create-feedback>إذا أرفقت صورة، سيحللها مساعد التصميم ويضيف وصفها وملاحظاته الأولية إلى ملف المشروع. الصورة مرجع بصري وليست قياسات تنفيذية.</p>
          </form>
        </section>
        <section class="section-card"><div class="section-heading"><div><h2>فتح مشروع سابق</h2><p>كل مشروع يحتفظ بكتالوجه وبيانات التصنيع الخاصة به.</p></div></div>
          <div class="mfg-project-list">${projects.map(p => `<button class="mfg-project" data-project="${esc(p.id)}"><strong>${esc(projectLabel(p))}</strong><span>${esc(p.furniture_type || 'نوع الأثاث غير محدد')}</span><b>فتح الكتالوج ←</b></button>`).join('') || '<p class="muted">لا توجد مشاريع محفوظة بعد. ابدأ تصميمك الأول من النموذج أعلاه.</p>'}</div>
        </section>`;
      const newForm = root.querySelector('[data-new-project]');
      const imagePicker = newForm.querySelector('[name="reference_image"]');
      const imagePreview = newForm.querySelector('[data-image-preview]');
      imagePicker.addEventListener('change', () => {
        const file = imagePicker.files?.[0];
        imagePreview.hidden = !file;
        imagePreview.textContent = file ? 'الصورة المختارة: ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)' : '';
      });
      root.querySelectorAll('[data-project]').forEach(b => b.onclick = () => { selected = b.dataset.project; hydrate(selectedProject()); render(); });
      root.querySelector('[data-new-project]').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const feedback = form.querySelector('[data-create-feedback]');
        const values = Object.fromEntries(new FormData(form).entries());
        const imageFile = form.elements.namedItem('reference_image')?.files?.[0] || null;
        button.disabled = true;
        button.textContent = imageFile ? 'جارٍ تحليل الصورة…' : 'جارٍ إنشاء التصميم…';
        feedback.textContent = imageFile ? 'مساعد التصميم يفحص الصورة؛ لا تعتمد أي قياس مستنتج منها.' : 'يتم إنشاء ملف التصميم…';
        try {
          let imageAnalysis = '';
          if (imageFile) {
            if (!['image/png','image/jpeg','image/webp'].includes(imageFile.type)) throw new Error('صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WEBP.');
            if (imageFile.size > 5 * 1024 * 1024) throw new Error('حجم الصورة أكبر من 5 ميغابايت.');
            const imageData = await new Promise((resolve,reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('تعذرت قراءة الصورة.'));
              reader.readAsDataURL(imageFile);
            });
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error('انتهت جلسة الدخول. سجّل الدخول من جديد.');
            const response = await fetch('/api/design-assistant', {
              method:'POST',
              headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
              body:JSON.stringify({messages:[{role:'user',content:'حلل الصورة المرجعية لهذا التصميم: '+String(values.title||'').trim()+'، النوع: '+String(values.furniture_type||'').trim()+'. صف الشكل الظاهر والتقسيمات والخامات المحتملة، وافصل بوضوح بين ما تراه وما تستنتجه. لا تخترع أي قياسات. أعطني ملخصاً عملياً وأسئلة المقاسات الناقصة.'}],image:imageData})
            });
            const result = await response.json().catch(()=>({}));
            if (!response.ok) throw new Error(result.error || 'تعذر تحليل الصورة حالياً.');
            imageAnalysis = String(result.reply || '').trim();
            if (!imageAnalysis) throw new Error('لم يصل تحليل واضح للصورة.');
          }
          const description = [
            'تم إنشاء المشروع مباشرة من قسم التصميم الهندسي والتصنيع.',
            imageFile ? 'اسم الصورة المرجعية: '+imageFile.name : '',
            imageAnalysis ? 'تحليل الصورة المرجعية (وصف أولي غير معتمد هندسياً):\\n'+imageAnalysis : ''
          ].filter(Boolean).join('\\n\\n');
          const { data, error } = await supabase.from('projects').insert({
            owner_id: user.id,
            title: String(values.title || '').trim(),
            furniture_type: String(values.furniture_type || '').trim(),
            status: 'design',
            description
          }).select('id,project_no,title,furniture_type,status,design_data,created_at').single();
          if (error) throw error;
          if (!data?.id) throw new Error('لم يرجع النظام ملف المشروع بعد الإنشاء.');
          projects.unshift(data);
          selected = data.id;
          hydrate(data);
          if (imageAnalysis) {
            catalog.notes = 'تحليل الصورة المرجعية — وصف أولي غير معتمد هندسياً:\\n'+imageAnalysis;
            dirty = true;
          }
          render();
        } catch (error) {
          feedback.textContent = 'تعذر بدء التصميم: ' + (error?.message || 'خطأ غير معروف');
          button.disabled = false;
          button.textContent = '＋ بدء التصميم وتحليل الصورة';
        }
      });
      return;
    }
    const layout = computeLayout();
    const totalParts = catalog.parts.reduce((sum, p) => sum + Math.max(0, Math.floor(number(p.qty))), 0);
    const board = catalog.board;
    const available = Math.max(0, Math.floor(number(board.available)));
    const sheetCount = layout.sheets.length;
    root.innerHTML = `
      <section class="mfg-hero"><div><span class="mfg-kicker">PROJECT #${esc(project.project_no)}</span><h2>${esc(project.title)}</h2><p>كتالوج تصنيع مستقل محفوظ داخل ملف المشروع. أدخل بيانات الألواح والقطع الفعلية قبل اعتماد خطة القص.</p></div><button class="btn" data-back>كل المشاريع</button></section>
      <div class="mfg-toolbar"><span class="mfg-save-state">${dirty ? '● تغييرات غير محفوظة' : '✓ آخر نسخة محفوظة'}</span><div><button class="btn" data-save>حفظ الكتالوج</button><button class="btn" data-export-cuts>تنزيل جدول القص CSV</button><button class="btn btn-primary" data-print>طباعة ورقة النجار</button></div></div>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>1. بيانات التصميم</h2><p>اختر وحدة العرض؛ تُحفظ المقاسات داخلياً بالملليمتر لضمان دقة الحسابات.</p></div><label class="mfg-unit-control">وحدة القياس<select data-display-unit><option value="cm" ${displayUnit === 'cm' ? 'selected' : ''}>سنتيمتر (سم)</option><option value="mm" ${displayUnit === 'mm' ? 'selected' : ''}>ملليمتر (مم)</option></select></label></div>
        <div class="mfg-fields">
          <label>اسم الكتالوج<input data-field="title" value="${esc(catalog.title)}"></label>
          <label>نوع القطعة<input data-field="itemType" value="${esc(catalog.itemType)}"></label>
          <label>العرض (${unitLabel()})<input type="number" min="0.1" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-field="width" value="${fromMm(catalog.width)}"></label>
          <label>الارتفاع (${unitLabel()})<input type="number" min="0.1" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-field="height" value="${fromMm(catalog.height)}"></label>
          <label>العمق (${unitLabel()})<input type="number" min="0.1" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-field="depth" value="${fromMm(catalog.depth)}"></label>
        </div>
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>2. مواصفات اللوح المتوفر</h2><p>أدخل المقاس والسماكة والهدر المتاح من واقع المستودع؛ لا يتم خصم أي مخزون تلقائياً.</p></div></div>
        <div class="mfg-fields">
          <label>نوع / لون اللوح<input data-board="material" value="${esc(board.material)}" placeholder="مثال: MDF ميلامين أبيض"></label>
          <label>عرض اللوح (${unitLabel()})<input type="number" min="0.1" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-board="width" value="${fromMm(board.width)}"></label>
          <label>طول اللوح (${unitLabel()})<input type="number" min="0.1" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-board="height" value="${fromMm(board.height)}"></label>
          <label>السماكة (${unitLabel()})<input type="number" min="0.1" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-board="thickness" value="${fromMm(board.thickness)}"></label>
          <label>عرض شفرة المنشار (${unitLabel()})<input type="number" min="0" step="${displayUnit === 'cm' ? '0.1' : '1'}" data-board="kerf" value="${fromMm(board.kerf)}"></label>
          <label>ألواح متوفرة حالياً<input type="number" min="0" step="1" data-board="available" value="${available}"></label>
          <label>اتجاه العروق<select data-board="grain"><option value="locked" ${board.grain !== 'free' ? 'selected' : ''}>ثابت — يمنع تدوير القطع</option><option value="free" ${board.grain === 'free' ? 'selected' : ''}>غير مقيّد — يسمح بالتدوير</option></select></label>
        </div>
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>3. قائمة القطع</h2><p>أدخل كل قطعة كما يجب أن تُقص، مع العدد والمقاسات الصافية.</p></div><button class="btn btn-primary" data-add-part>＋ إضافة قطعة</button></div>
        <div class="table-wrap"><table class="mfg-parts"><thead><tr><th>اسم القطعة</th><th>مجموعة التجميع</th><th>الدور</th><th>مستوى اللوح</th><th>العرض (${unitLabel()})</th><th>الطول (${unitLabel()})</th><th>العدد</th><th>اتجاه العروق</th><th>موضع X / Y / Z (${unitLabel()})</th><th>دوران Z (°)</th><th></th></tr></thead><tbody>
          ${catalog.parts.map(p => `<tr data-part="${esc(p.id)}"><td><input data-part-field="name" value="${esc(p.name)}"></td><td><select data-part-field="assemblyId"><option value="">بدون مجموعة</option>${catalog.assemblies.map(g=>`<option value="${esc(g.id)}" ${p.assemblyId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></td><td><select data-part-field="role"><option value="custom" ${(p.role||'custom')==='custom'?'selected':''}>مخصص</option><option value="side" ${p.role==='side'?'selected':''}>جانب</option><option value="top" ${p.role==='top'?'selected':''}>سقف</option><option value="bottom" ${p.role==='bottom'?'selected':''}>قاعدة</option><option value="shelf" ${p.role==='shelf'?'selected':''}>رف</option><option value="back" ${p.role==='back'?'selected':''}>ظهر</option><option value="door" ${p.role==='door'?'selected':''}>باب</option><option value="drawer" ${p.role==='drawer'?'selected':''}>درج</option><option value="front" ${p.role==='front'?'selected':''}>واجهة</option></select></td><td><select data-part-field="plane"><option value="xy" ${(p.orientation?.plane||'xy')==='xy'?'selected':''}>XY — أمامي</option><option value="xz" ${p.orientation?.plane==='xz'?'selected':''}>XZ — أفقي</option><option value="yz" ${p.orientation?.plane==='yz'?'selected':''}>YZ — جانبي</option></select></td><td><input type="number" min="1" data-part-field="width" value="${fromMm(p.width)}" step="${displayUnit === 'cm' ? '0.1' : '1'}"></td><td><input type="number" min="1" data-part-field="height" value="${fromMm(p.height)}" step="${displayUnit === 'cm' ? '0.1' : '1'}"></td><td><input type="number" min="1" step="1" data-part-field="qty" value="${number(p.qty)}"></td><td><select data-part-field="grain"><option value="true" ${p.grain !== false ? 'selected' : ''}>ثابت</option><option value="false" ${p.grain === false ? 'selected' : ''}>مسموح تدويرها</option></select></td><td><div class="mfg-position-fields"><input type="number" step="${displayUnit === 'cm' ? '0.1' : '1'}" placeholder="X" aria-label="موضع X" data-position="x" value="${p.position && p.position.x != null ? fromMm(p.position.x) : ''}"><input type="number" step="${displayUnit === 'cm' ? '0.1' : '1'}" placeholder="Y" aria-label="موضع Y" data-position="y" value="${p.position && p.position.y != null ? fromMm(p.position.y) : ''}"><input type="number" step="${displayUnit === 'cm' ? '0.1' : '1'}" placeholder="Z" aria-label="موضع Z" data-position="z" value="${p.position && p.position.z != null ? fromMm(p.position.z) : ''}"></div></td><td><input type="number" step="1" aria-label="دوران Z بالدرجات" data-rotation="z" value="${number(p.rotation?.z)}"></td><td><button class="btn btn-small" data-remove-part="${esc(p.id)}">حذف</button></td></tr>`).join('') || '<tr><td colspan="11" class="empty-cell">أضف القطع المطلوبة لبدء حساب الألواح.</td></tr>'}
        </tbody></table></div>
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>4. ملخص الألواح وخطة القص الأولية</h2><p>ترتيب مستطيلات أولي يراعي kerf واتجاه العروق المسجل؛ ليس تحسين قص احترافياً معتمداً.</p></div></div>
        <div class="mfg-summary"><article><span>إجمالي القطع</span><strong>${totalParts}</strong></article><article><span>الألواح المحسوبة</span><strong>${sheetCount}</strong></article><article><span>المتوفر المدخل</span><strong>${available}</strong></article><article><span>العجز التقديري</span><strong>${Math.max(0, sheetCount - available)}</strong></article></div>
        ${layout.errors.length ? '<div class="notice-card"><strong>تنبيهات الخطة</strong><ul>' + layout.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div>' : ''}
        <div class="mfg-sheets">${layout.sheets.map((sheet, i) => `
          <article class="mfg-sheet"><h3>لوح رقم ${i + 1} · ${fromMm(board.width)} × ${fromMm(board.height)} ${unitLabel()}</h3>
            <svg viewBox="0 0 ${Math.max(1,number(board.width))} ${Math.max(1,number(board.height))}" role="img" aria-label="مخطط توزيع القطع على اللوح">
              <rect x="0" y="0" width="${number(board.width)}" height="${number(board.height)}" fill="#f7faf8" stroke="#68877a" stroke-width="8"/>
              ${sheet.placements.map((p, pi) => { const fs = Math.max(14, Math.min(44, Math.min(p.w, p.h) / 7)); const cx=p.x+p.w/2, cy=p.y+p.h/2; return `<g><title>قطعة ${pi+1}: ${esc(p.name)} — ${fromMm(p.w)} × ${fromMm(p.h)} ${unitLabel()}${p.rotated ? " — مدوّرة" : ""}</title><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${pi % 2 ? '#dceee8' : '#e8f0e8'}" stroke="#367e70" stroke-width="5"/><text x="${cx}" y="${cy-fs*0.55}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="800" fill="#234b41">#${pi+1} ${esc(p.name)}</text><text x="${cx}" y="${cy+fs*0.65}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(12,fs*0.68)}" fill="#234b41">${fromMm(p.w)} × ${fromMm(p.h)} ${unitLabel()}</text>${p.grain ? `<path d="M ${p.x+10} ${p.y+Math.min(p.h/2,24)} l ${Math.min(p.w-20,35)} 0 m -8 -6 l 8 6 -8 6" stroke="#387e70" stroke-width="3" fill="none"/>` : ""}</g>`; }).join('')}
            </svg>
            <div class="mfg-sheet-meta">
              <span>قطع: <strong>${sheet.placements.length}</strong></span>
              <span>المساحة المستخدمة: <strong>${(sheet.placements.reduce((s,p)=>s+p.w*p.h,0)/Math.max(1,number(board.width)*number(board.height))*100).toFixed(1)}%</strong></span>
              <span>المتبقي المساحي النظري: <strong>${(Math.max(0, number(board.width)*number(board.height)-sheet.placements.reduce((s,p)=>s+p.w*p.h,0))/Math.pow(unitFactor(),2)).toFixed(displayUnit === "cm" ? 2 : 0)} ${unitLabel()}²</strong></span>
            </div>
            <p>الأرقام داخل اللوح تطابق ترتيب القطع في القائمة؛ السهم يوضح اتجاه العروق المسجل للقطعة. المساحة خارجها هي المتبقي قبل احتساب مسار المنشار الفعلي، ويجب مراجعة اتجاه العروق والقص قبل التنفيذ.</p>
          </article>`).join('') || '<p class="muted">أدخل قطعاً صالحة لتظهر خريطة القص.</p>'}
      </section>
      <section class="section-card mfg-section mfg-assembly"><div class="section-heading"><div><h2>5. مواضع القطع والتجميع المبدئي</h2><p>تظهر هنا إحداثيات القطع التي أدخلتها صراحةً. لا يتم توليد شكل خزانة افتراضي أو افتراض نقاط تثبيت وخلوصات وإكسسوارات.</p></div></div>
        ${assemblyMarkup()}
      </section>
      <section class="section-card mfg-section"><div class="section-heading"><div><h2>6. ملاحظات التصنيع والاعتماد</h2><p>التصميم لا يُعتمد قبل مراجعة الحواف والثقوب والإكسسوارات وطريقة التجميع.</p></div><span class="status-tag">${catalog.approved ? 'معتمد للمراجعة النهائية' : 'مسودة غير معتمدة'}</span></div>
        <label class="mfg-notes">ملاحظات النجار / الحواف / المفصلات / السكك / التجميع<textarea data-notes rows="4">${esc(catalog.notes)}</textarea></label>
        <div class="mfg-approval"><button class="btn" data-approve>اعتماد بيانات الكتالوج للمراجعة</button><small>الاعتماد هنا لا يخصم المخزون ولا يحوّل الخطة الأولية إلى مخطط تصنيع نهائي.</small></div>
      </section>
    `;
    root.querySelector('[data-display-unit]').onchange = e => { displayUnit = e.target.value === 'mm' ? 'mm' : 'cm'; render(); };
    root.querySelector('[data-back]').onclick = () => { selected = null; render(); };
    root.querySelectorAll('[data-field]').forEach(el => el.addEventListener('change', () => { const key = el.dataset.field; catalog[key] = ['width','height','depth'].includes(key) ? toMm(el.value) : el.value; markDirty(); render(); }));
    root.querySelectorAll('[data-board]').forEach(el => el.addEventListener('change', () => { const key = el.dataset.board; catalog.board[key] = ['width','height','thickness','kerf'].includes(key) ? toMm(el.value) : key === 'available' ? number(el.value) : el.value; markDirty(); render(); }));
    root.querySelectorAll('[data-part-field]').forEach(el => el.addEventListener('change', () => { const row = el.closest('[data-part]'); const part = catalog.parts.find(p => p.id === row.dataset.part); const key = el.dataset.partField; if (key === 'plane') { part.orientation ||= { plane: 'xy' }; part.orientation.plane = el.value; } else { part[key] = ['width','height'].includes(key) ? toMm(el.value) : key === 'qty' ? number(el.value) : key === 'grain' ? el.value === 'true' : el.value; } markDirty(); render(); }));
    root.querySelectorAll('[data-position]').forEach(el => el.addEventListener('change', () => {
      const row = el.closest('[data-part]');
      const part = catalog.parts.find(p => p.id === row.dataset.part);
      part.position ||= { x: null, y: null, z: null };
      const raw = el.value.trim();
      part.position[el.dataset.position] = raw === '' ? null : toMm(raw);
      if (['x','y','z'].every(k => part.position[k] === null)) part.position = null;
      markDirty(); render();
    }));
    root.querySelectorAll('[data-rotation]').forEach(el => el.addEventListener('change', () => {
      const row = el.closest('[data-part]');
      const part = catalog.parts.find(p => p.id === row.dataset.part);
      part.rotation ||= { x: 0, y: 0, z: 0 };
      part.rotation.z = number(el.value);
      markDirty(); render();
    }));
    root.querySelectorAll('[data-assembly-field]').forEach(el => el.addEventListener('change', () => { const group = catalog.assemblies.find(g => g.id === el.closest('[data-assembly]').dataset.assembly); group[el.dataset.assemblyField] = el.value; markDirty(); render(); }));
    root.querySelectorAll('[data-remove-assembly]').forEach(el => el.onclick = () => { const id = el.dataset.removeAssembly; catalog.assemblies = catalog.assemblies.filter(g => g.id !== id); catalog.parts.forEach(p => { if (p.assemblyId === id) p.assemblyId = ''; }); markDirty(); render(); });
    const addAssembly = root.querySelector('[data-add-assembly]'); if (addAssembly) addAssembly.onclick = () => { catalog.assemblies.push({ id: uid('assembly'), name: 'مجموعة جديدة', type: 'custom', origin: null, state: 'draft' }); markDirty(); render(); };
    root.querySelectorAll('[data-remove-part]').forEach(el => el.onclick = () => { catalog.parts = catalog.parts.filter(p => p.id !== el.dataset.removePart); markDirty(); render(); });
    root.querySelector('[data-add-part]').onclick = () => { catalog.parts.push({ id: uid('part'), assemblyId: '', name: 'قطعة جديدة', role: 'custom', width: 0, height: 0, qty: 1, grain: true, position: null, orientation: { plane: 'xy' }, rotation: { x: 0, y: 0, z: 0 }, joinery: [], hardware: [] }); markDirty(); render(); };
    root.querySelector('[data-notes]').addEventListener('change', e => { catalog.notes = e.target.value; markDirty(); });
    root.querySelector('[data-save]').onclick = save;
    root.querySelector('[data-export-cuts]').onclick = () => {
      const rows = [['رقم اللوح','رقم القطعة','اسم القطعة','العرض ' + unitLabel(),'الطول ' + unitLabel(),'اتجاه العروق','تدوير']];
      layout.sheets.forEach((sheet, si) => sheet.placements.forEach((p, pi) => rows.push([
        si + 1, pi + 1, p.name, fromMm(p.w), fromMm(p.h),
        p.grain ? 'ثابت' : 'غير مقيّد', p.rotated ? 'نعم' : 'لا'
      ])));
      const csv = '\uFEFF' + rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
      saveBlob('cut-list-' + (catalog.title || 'project') + '.csv', csv, 'text/csv;charset=utf-8');
    };
    root.querySelector('[data-print]').onclick = () => window.print();
    root.querySelector('[data-approve]').onclick = () => {
      const check = computeLayout();
      if (check.errors.length || !catalog.parts.length || !assemblyPreview().complete || catalog.assemblies.some(g => !String(g.name || '').trim())) {
        alert('لا يمكن اعتماد بيانات الكتالوج للمراجعة بعد. أكمل الأبعاد وحدد XYZ لكل قطعة واجعل كمية كل سجل 1. هذا لا يثبت صحة الوصلات أو الإكسسوارات.');
        return;
      }
      markDirty(); catalog.approved = true; save();
    };
  }
  async function save() {
    const project = selectedProject();
    if (!project) return;
    const button = root.querySelector('[data-save]');
    if (button) { button.disabled = true; button.textContent = 'جارٍ الحفظ…'; }
    try {
      const nextDesignData = { ...(project.design_data || {}), manufacturing_catalog: { ...catalog, updated_at: new Date().toISOString() } };
      const { data, error } = await supabase.from('projects').update({ design_data: nextDesignData }).eq('id', project.id).eq('owner_id', user.id).select('id,design_data').single();
      if (error) throw error;
      if (!data || data.id !== project.id || !data.design_data?.manufacturing_catalog) throw new Error('لم يتم تأكيد حفظ بيانات الكتالوج في المشروع. تحقق من صلاحيات قاعدة البيانات.');
      project.design_data = data.design_data;
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
