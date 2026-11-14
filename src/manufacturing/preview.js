const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const mm = value => Math.max(0, Number(value || 0) * 1000);
const round = value => Math.round(value * 10) / 10;

function classify(name, geometryType) {
  if (/صورة مرجعية|شكل حر/.test(name) || /Plane|Sphere|Tube/.test(geometryType)) return {group:'مرجع أو شكل غير قابل لجدول القص',material:'غير محدد',cut:false};
  if (/حزام|ياي|سوست|تعليق/.test(name)) return {group:'نظام تعليق ودعم',material:'يحتاج تحديد مواصفة',cut:false};
  if (/إسفنج|حشوة/.test(name)) return {group:'إسفنج وحشوات',material:'حسب كثافة/نوع الإسفنج المختار',cut:false};
  if (/وسادة|مخدة|كسوة|خياطة|قماش/.test(name)) return {group:'تنجيد وكسوة',material:'حسب القماش المختار',cut:false};
  if (/عارضة|خشب|هيكل|دعامة|لوح|كونتر|قاعدة|قائم/.test(name)) return {group:'خشب وألواح',material:'حسب الخشب/اللوح المختار',cut:/BoxGeometry|RoundedBoxGeometry/.test(geometryType)};
  if (/رجل|معدن|مسمار|مفصل|إكسسوار/.test(name)) return {group:'معدن وإكسسوارات',material:'يحتاج تحديد مواصفة',cut:false};
  return {group:'غير مصنف',material:'يلزم تحديد المادة',cut:false};
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function mountManufacturingPreview({parts = [], design = {}} = {}) {
  document.querySelector('#manufacturingPreview')?.remove();
  const rows = parts.map((part, index) => {
    const size = part.userData?.partSize || part.userData?.baseSize;
    const dimensions = size ? {x:mm(size.x), y:mm(size.y), z:mm(size.z)} : {x:0,y:0,z:0};
    const name = part.userData?.partName || 'مكوّن بدون اسم';
    const geometryType = part.geometry?.type || '';
    const category = classify(name, geometryType);
    return {
      id: 'P' + String(index + 1).padStart(3,'0'),
      name, geometryType, ...category,
      x:round(dimensions.x), y:round(dimensions.y), z:round(dimensions.z),
      length:round(Math.max(dimensions.x,dimensions.y,dimensions.z)),
      sectionA:round([...Object.values(dimensions)].sort((a,b)=>b-a)[1] || 0),
      sectionB:round([...Object.values(dimensions)].sort((a,b)=>b-a)[2] || 0)
    };
  });
  const groups = [...new Set(rows.map(row=>row.group))];
  const wood = rows.filter(row=>row.group==='خشب وألواح');
  const cutReady = rows.filter(row=>row.cut);
  const overlay = document.createElement('div');
  overlay.id = 'manufacturingPreview';
  overlay.className = 'manufacturing-preview-backdrop';
  overlay.innerHTML = `
    <section class="manufacturing-preview" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="manufacturingTitle">
      <header class="manufacturing-preview-head">
        <div><span class="manufacturing-kicker">ENGINEERING REVIEW / DRAFT</span><h2 id="manufacturingTitle">معاينة ملف التصنيع</h2><p>${escapeHtml(design.name || 'تصميم الأثاث الحالي')} · جميع الأبعاد بالملليمتر</p></div>
        <button type="button" class="manufacturing-close" aria-label="إغلاق">×</button>
      </header>
      <div class="manufacturing-warning"><strong>مسودة مراجعة — غير معتمدة للتصنيع</strong><p>هذه المعاينة تستخرج الأبعاد الاسمية من المجسم الحالي. لا تشمل بعدُ وصلات النجارة، الثقوب، الزوايا، سماحات القص، اتجاه عروق الخشب، بدلات الخياطة، تعشيق القطع أو قواعد المورد. لا تسلّمها للورشة كأمر قص نهائي.</p></div>
      <div class="manufacturing-summary">
        <article><span>إجمالي المكونات</span><b>${rows.length}</b></article>
        <article><span>عناصر الخشب والألواح</span><b>${wood.length}</b></article>
        <article><span>عناصر مستطيلة قابلة للفرز الأولي</span><b>${cutReady.length}</b></article>
        <article><span>فئات المواد</span><b>${groups.length}</b></article>
      </div>
      <nav class="manufacturing-tabs" aria-label="أقسام المعاينة">
        <button type="button" class="active" data-view="all">كل القطع</button>
        <button type="button" data-view="wood">الخشب والقص الأولي</button>
        <button type="button" data-view="materials">تجهيز المواد</button>
        <button type="button" data-view="checks">فحص الاعتماد</button>
      </nav>
      <div class="manufacturing-table-wrap" id="manufacturingTableWrap"></div>
      <footer class="manufacturing-actions">
        <button type="button" class="manufacturing-export" data-export="csv">تصدير جدول CSV</button>
        <button type="button" class="manufacturing-export" data-export="json">حفظ بيانات JSON</button>
        <button type="button" class="manufacturing-export manufacturing-print" data-export="print">طباعة / حفظ PDF</button>
        <button type="button" class="manufacturing-dismiss">إغلاق المعاينة</button>
      </footer>
    </section>`;
  document.body.appendChild(overlay);
  const wrap = overlay.querySelector('#manufacturingTableWrap');
  const render = view => {
    overlay.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
    let shown = rows;
    if(view==='wood') shown=wood;
    if(view==='materials') shown=rows.filter(row=>row.group!=='مرجع أو شكل غير قابل لجدول القص');
    if(view==='checks') {
      wrap.innerHTML = `<div class="manufacturing-check-list">
        <article><b>تعريف المادة لكل قطعة</b><span>${rows.filter(row=>row.material==='يلزم تحديد المادة'||row.material==='يحتاج تحديد مواصفة').length ? 'ناقص — توجد قطع تحتاج مواصفة مادة دقيقة' : 'مراجعة مطلوبة'}</span></article>
        <article><b>وصلات وثقوب وزوايا التصنيع</b><span>غير معرفة في النموذج الحالي</span></article>
        <article><b>سماحات القص والهدر واتجاه الألياف</b><span>غير محسوبة</span></article>
        <article><b>مراجعة المساقط والتطابق</b><span>لم يتم اعتمادها هندسياً</span></article>
        <article><b>حالة إصدار أمر التصنيع</b><strong>محظور حتى استكمال البيانات والتحقق</strong></article>
      </div>`;
      return;
    }
    if(!shown.length){wrap.innerHTML='<p class="manufacturing-empty">لا توجد عناصر في هذا القسم.</p>';return;}
    wrap.innerHTML = `<table class="manufacturing-table"><thead><tr><th>رقم</th><th>اسم القطعة</th><th>التصنيف</th><th>المادة</th><th>X مم</th><th>Y مم</th><th>Z مم</th><th>طول اسمي مم</th><th>مقطع اسمي مم</th><th>الحالة</th></tr></thead><tbody>${shown.map(row=>`<tr><td>${row.id}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.group)}</td><td>${escapeHtml(row.material)}</td><td>${row.x}</td><td>${row.y}</td><td>${row.z}</td><td>${row.length}</td><td>${row.sectionA} × ${row.sectionB}</td><td><span class="manufacturing-status">${row.cut?'فرز أولي فقط':'مراجعة مطلوبة'}</span></td></tr>`).join('')}</tbody></table>`;
  };
  overlay.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>render(button.dataset.view)));
  overlay.querySelector('.manufacturing-close').addEventListener('click',()=>overlay.remove());
  overlay.querySelector('.manufacturing-dismiss').addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
  overlay.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>{
    const type=button.dataset.export;
    if(type==='csv'){
      const header=['رقم القطعة','اسم القطعة','التصنيف','المادة','X mm','Y mm','Z mm','الطول الاسمي mm','المقطع الاسمي mm','الحالة'];
      const csv=[header,...rows.map(row=>[row.id,row.name,row.group,row.material,row.x,row.y,row.z,row.length,row.sectionA+' x '+row.sectionB,row.cut?'فرز أولي فقط':'مراجعة مطلوبة'])].map(line=>line.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
      download('manufacturing-review-draft.csv','\ufeff'+csv,'text/csv;charset=utf-8');
    }
    if(type==='json') download('manufacturing-review-draft.json',JSON.stringify({status:'draft_not_for_manufacturing',units:'mm',design,parts:rows,checks:{joinery:false,holes:false,cut_allowances:false,fabric_allowances:false,engineering_approval:false}},null,2),'application/json');
    if(type==='print') window.print();
  }));
  render('all');
  const closeOnEscape=event=>{if(event.key==='Escape'){overlay.remove();window.removeEventListener('keydown',closeOnEscape);}};
  window.addEventListener('keydown',closeOnEscape);
  overlay.addEventListener('remove',()=>window.removeEventListener('keydown',closeOnEscape),{once:true});
}
