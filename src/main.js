import { supabase, supabaseConfigured } from './lib/supabase.js';
import { initAuthGate } from './lib/auth-gate.js';
import './style.css';

const app = document.querySelector('#app');
const navItems = [
  ['dashboard','لوحة المعلومات','⌂'],['customers','العملاء','♙'],['projects','المشاريع','▦'],
  ['studio','مكتب التصميم 3D','◇'],['surveys','قياسات المواقع','⌖'],['materials','المستودعات والمواد','▤'],
  ['orders','أوامر التصنيع','⚒'],['production','متابعة الإنتاج','◷'],['delivery','التسليم','✓'],
  ['reports','الحسابات والتقارير','▥']
];
let currentPage = 'dashboard';
let currentUser = null;
let sceneCleanup = null;

app.innerHTML = `
<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="#" aria-label="الرئيسية"><span class="brand-mark">MA</span><span><strong>محمد أسعد</strong><small>للتنجيد والتصميم الهندسي</small></span></a>
    <div class="nav-caption">إدارة الشركة</div>
    <nav class="nav" id="mainNav" aria-label="التنقل الرئيسي"></nav>
    <div class="sidebar-foot"><span class="online-dot"></span> مساحة عمل خاصة وآمنة</div>
  </aside>
  <main class="main-area">
    <header class="topbar">
      <div><div class="eyebrow">نظام الشركة المتكامل</div><h1 id="pageTitle">لوحة المعلومات</h1></div>
      <div class="top-actions"><span class="user-pill" id="userLabel">جارٍ التحقق…</span><button class="btn btn-quiet" id="signOut" type="button">تسجيل الخروج</button></div>
    </header>
    <div id="pageContent" class="page-content"><div class="loading-card">جارٍ تجهيز مساحة العمل…</div></div>
    <footer class="app-footer">محمد أسعد للتنجيد <span>•</span> جميع الأبعاد الهندسية بالملليمتر ما لم يُذكر غير ذلك</footer>
  </main>
</div>`;

const nav = document.querySelector('#mainNav');
nav.innerHTML = navItems.map(([id,label,icon]) => `<button type="button" class="nav-link" data-page="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');
nav.addEventListener('click', e => {
  const button = e.target.closest('[data-page]');
  if (button) navigate(button.dataset.page);
});
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); navigate('dashboard'); });
document.querySelector('#signOut').addEventListener('click', async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  location.reload();
});

initAuthGate(supabase);
if (!supabaseConfigured) {
  document.querySelector('#userLabel').textContent = 'إعدادات الربط ناقصة';
} else {
  supabase.auth.getSession().then(({data}) => {
    currentUser = data?.session?.user || null;
    updateUser();
    if (currentUser) navigate(currentPage);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateUser();
    if (currentUser) navigate(currentPage);
  });
}
function updateUser() {
  document.querySelector('#userLabel').textContent = currentUser?.email || 'غير مسجل الدخول';
}
function esc(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString('ar-JO',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' د.أ';
}
function setContent(title, html) {
  document.querySelector('#pageTitle').textContent = title;
  document.querySelector('#pageContent').innerHTML = html;
  document.querySelectorAll('.nav-link').forEach(b => {
    const active = b.dataset.page === currentPage;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
}
function navigate(page) {
  if (!navItems.some(item => item[0] === page)) return;
  if (sceneCleanup) { sceneCleanup(); sceneCleanup = null; }
  currentPage = page;
  const titles = Object.fromEntries(navItems.map(([id,label]) => [id,label]));
  setContent(titles[page], '<div class="loading-card">جارٍ تحميل البيانات…</div>');
  if (!currentUser) {
    document.querySelector('#pageContent').innerHTML = '<div class="empty-state"><h2>سجّل الدخول للمتابعة</h2><p>بيانات الشركة محمية ولا تظهر إلا بعد تسجيل الدخول.</p></div>';
    return;
  }
  const routes = {
    dashboard: renderDashboard, customers: renderCustomers, projects: renderProjects,
    studio: renderStudio, surveys: renderSurveys, materials: renderMaterials,
    orders: renderOrders, production: renderProduction, delivery: renderDelivery, reports: renderReports
  };
  routes[page]();
}
async function rows(table, columns='*', order='created_at') {
  const {data,error} = await supabase.from(table).select(columns).order(order,{ascending:false}).limit(100);
  if (error) throw error;
  return data || [];
}
function showError(error) {
  const target = document.querySelector('#pageContent');
  target.innerHTML = `<div class="error-card"><strong>تعذر تحميل البيانات</strong><p>${esc(error?.message || 'حدث خطأ غير متوقع')}</p><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div>`;
}
function statCard(label,value,detail) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}
async function renderDashboard() {
  try {
    const [customers,projects,materials,orders] = await Promise.all([
      rows('customers','id'), rows('projects','id,status'), rows('materials','id,quantity,min_quantity'), rows('work_orders','id,status')
    ]);
    const active = projects.filter(p => !['completed','cancelled'].includes(p.status)).length;
    const low = materials.filter(m => Number(m.quantity) <= Number(m.min_quantity)).length;
    setContent('لوحة المعلومات',`
      <section class="welcome-card"><div><span class="welcome-kicker">أهلاً بك في مساحة عملك</span><h2>كل أعمال الشركة في مكان واحد</h2><p>من استقبال العميل ورفع القياسات إلى التصميم والتصنيع والتسليم.</p></div><div class="welcome-mark">MA</div></section>
      <section class="stats-grid">
        ${statCard('العملاء',customers.length,'ملفات العملاء المسجلة')}
        ${statCard('المشاريع النشطة',active,'تحت التنفيذ أو التصميم')}
        ${statCard('المواد بالمستودع',materials.length,'أنواع المواد المسجلة')}
        ${statCard('أوامر التصنيع',orders.length,'أوامر محفوظة')}
      </section>
      <section class="section-card"><div class="section-heading"><div><h2>مسار العمل</h2><p>انتقل بين أقسام النظام حسب مراحل تنفيذ المشروع</p></div></div><div class="workflow-grid">
        ${[['customers','العملاء','تسجيل بيانات العميل'],['projects','المشاريع','فتح مشروع ومتابعته'],['surveys','القياسات','تسجيل أبعاد الموقع'],['studio','التصميم 3D','إنشاء نموذج أولي'],['materials','المستودعات','إدارة المخزون والمواد'],['orders','التصنيع','إصدار أمر عمل']].map(([id,title,desc])=>`<button class="workflow-tile" data-go="${id}"><strong>${title}</strong><span>${desc}</span><b>فتح القسم ←</b></button>`).join('')}
      </div></section>
      <section class="notice-card"><strong>تنبيه هندسي</strong><p>نماذج 3D الحالية مرحلة أولية للمعاينة. لا تعتمد الأبعاد أو قوائم القص للتصنيع قبل مراجعتها واعتمادها هندسياً.</p></section>
    `);
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
  } catch(error) { showError(error); }
}
function tableHtml(headers,body) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}" class="empty-cell">لا توجد بيانات بعد</td></tr>`}</tbody></table></div>`;
}
function pageToolbar(title,desc,buttonLabel,action='new-record') {
  return `<div class="section-heading"><div><h2>${title}</h2><p>${desc}</p></div><button class="btn btn-primary" data-action="${action}">＋ ${buttonLabel}</button></div>`;
}
function openForm(title, fields, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<form class="modal-card"><div class="modal-heading"><h2>${title}</h2><button type="button" class="icon-close" aria-label="إغلاق">×</button></div><div class="form-grid">${fields.map(f=>{
    const label=`<label for="f_${f.name}">${f.label}</label>`;
    if(f.type==='select') return `<div class="form-field">${label}<select id="f_${f.name}" name="${f.name}" ${f.required?'required':''}><option value="">اختر…</option>${(f.options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>`;
    if(f.type==='textarea') return `<div class="form-field full-field">${label}<textarea id="f_${f.name}" name="${f.name}" rows="3"></textarea></div>`;
    return `<div class="form-field">${label}<input id="f_${f.name}" name="${f.name}" type="${f.type||'text'}" ${f.required?'required':''} ${f.min!==undefined?'min="'+f.min+'"':''} step="${f.step||'any'}" placeholder="${esc(f.placeholder||'')}"></div>`;
  }).join('')}</div><p class="form-feedback" role="status"></p><div class="modal-actions"><button type="button" class="btn btn-quiet cancel">إلغاء</button><button class="btn btn-primary" type="submit">حفظ</button></div></form>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.querySelector('.icon-close').onclick=close;
  overlay.querySelector('.cancel').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  overlay.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const button=form.querySelector('[type="submit"]');
    const feedback=form.querySelector('.form-feedback');
    button.disabled=true; feedback.textContent='جارٍ الحفظ…';
    const data=Object.fromEntries(new FormData(form).entries());
    try { await onSave(data); close(); navigate(currentPage); }
    catch(error) { feedback.textContent=error?.message||'تعذر الحفظ'; button.disabled=false; }
  });
}
async function insertRow(table, data) {
  const {error}=await supabase.from(table).insert({...data,owner_id:currentUser.id});
  if(error) throw error;
}
async function renderCustomers() {
  try {
    const data=await rows('customers','id,full_name,phone,email,address,created_at');
    setContent('العملاء',`<section class="section-card">${pageToolbar('سجل العملاء','احفظ بيانات العملاء ووسائل التواصل والعناوين','إضافة عميل')}
      ${tableHtml(['اسم العميل','الهاتف','البريد الإلكتروني','العنوان'],data.map(x=>`<tr><td>${esc(x.full_name)}</td><td dir="ltr">${esc(x.phone||'—')}</td><td>${esc(x.email||'—')}</td><td>${esc(x.address||'—')}</td></tr>`).join(''))}</section>`);
    document.querySelector('[data-action]').onclick=()=>openForm('إضافة عميل',[
      {name:'full_name',label:'اسم العميل',required:true},{name:'phone',label:'رقم الهاتف',type:'tel'},
      {name:'email',label:'البريد الإلكتروني',type:'email'},{name:'address',label:'العنوان'},
      {name:'notes',label:'ملاحظات',type:'textarea'}
    ],d=>insertRow('customers',d));
  } catch(error){showError(error);}
}
async function renderProjects() {
  try {
    const [data,customers]=await Promise.all([rows('projects','id,project_no,customer_id,title,furniture_type,status,estimated_cost,currency,created_at'),rows('customers','id,full_name')]);
    const customerMap=new Map(customers.map(c=>[c.id,c.full_name]));
    const statusMap={draft:'مسودة',design:'قيد التصميم',approved:'معتمد',manufacturing:'قيد التصنيع',completed:'مكتمل',cancelled:'ملغي'};
    setContent('المشاريع',`<section class="section-card">${pageToolbar('ملفات المشاريع','اربط كل مشروع بعميله ونوع الأثاث ومرحلة التنفيذ','مشروع جديد')}
      ${tableHtml(['رقم المشروع','اسم المشروع','العميل','نوع الأثاث','الحالة','التكلفة التقديرية'],data.map(x=>`<tr><td>#${esc(x.project_no)}</td><td>${esc(x.title)}</td><td>${esc(customerMap.get(x.customer_id)||'—')}</td><td>${esc(x.furniture_type||'—')}</td><td><span class="status-tag">${statusMap[x.status]||esc(x.status)}</span></td><td>${x.estimated_cost==null?'—':money(x.estimated_cost)}</td></tr>`).join(''))}</section>`);
    document.querySelector('[data-action]').onclick=()=>openForm('إنشاء مشروع',[
      {name:'title',label:'اسم المشروع',required:true},{name:'customer_id',label:'العميل',type:'select',options:customers.map(c=>({value:c.id,label:c.full_name}))},
      {name:'furniture_type',label:'نوع الأثاث',placeholder:'كنب، مطبخ، غرفة نوم…'},
      {name:'status',label:'الحالة',type:'select',required:true,options:Object.entries(statusMap).map(([value,label])=>({value,label}))},
      {name:'estimated_cost',label:'التكلفة التقديرية (د.أ)',type:'number',min:0},{name:'description',label:'وصف المشروع',type:'textarea'}
    ],d=>insertRow('projects',{...d,customer_id:d.customer_id||null,estimated_cost:d.estimated_cost?Number(d.estimated_cost):null}));
  } catch(error){showError(error);}
}
async function renderMaterials() {
  try {
    const data=await rows('materials','id,sku,name,category,unit,quantity,min_quantity,unit_cost');
    const categories={wood:'خشب',metal:'معادن',foam:'إسفنج',fabric:'أقمشة',hardware:'إكسسوارات',paint:'دهانات',other:'أخرى'};
    setContent('المستودعات والمواد',`<section class="section-card">${pageToolbar('المخزون','تابع الكميات المتوفرة وحد إعادة الطلب وتكلفة الوحدة','إضافة مادة')}
      ${tableHtml(['رمز المادة','اسم المادة','التصنيف','الكمية','حد التنبيه','تكلفة الوحدة','الحالة'],data.map(x=>`<tr><td>${esc(x.sku||'—')}</td><td>${esc(x.name)}</td><td>${categories[x.category]||esc(x.category)}</td><td>${esc(x.quantity)} ${esc(x.unit)}</td><td>${esc(x.min_quantity)}</td><td>${x.unit_cost==null?'—':money(x.unit_cost)}</td><td>${Number(x.quantity)<=Number(x.min_quantity)?'<span class="low-stock">منخفض</span>':'<span class="ok-stock">متوفر</span>'}</td></tr>`).join(''))}</section>`);
    document.querySelector('[data-action]').onclick=()=>openForm('إضافة مادة للمستودع',[
      {name:'name',label:'اسم المادة',required:true},{name:'sku',label:'رمز المادة'},
      {name:'category',label:'التصنيف',type:'select',required:true,options:Object.entries(categories).map(([value,label])=>({value,label}))},
      {name:'unit',label:'وحدة القياس',placeholder:'متر، قطعة، لوح…'},
      {name:'quantity',label:'الكمية الحالية',type:'number',min:0},
      {name:'min_quantity',label:'حد التنبيه',type:'number',min:0},
      {name:'unit_cost',label:'تكلفة الوحدة (د.أ)',type:'number',min:0}
    ],d=>insertRow('materials',{...d,unit:d.unit||'قطعة',quantity:Number(d.quantity||0),min_quantity:Number(d.min_quantity||0),unit_cost:d.unit_cost?Number(d.unit_cost):null}));
  } catch(error){showError(error);}
}
async function renderOrders() {
  try {
    const [data,projects]=await Promise.all([rows('work_orders','id,order_no,project_id,department,status,instructions,created_at'),rows('projects','id,title,project_no')]);
    const map=new Map(projects.map(p=>[p.id,p]));
    const departments={carpentry:'نجارة',metalwork:'حدادة',upholstery:'تنجيد',general:'عام'};
    const statuses={pending:'بانتظار البدء',in_progress:'قيد التنفيذ',blocked:'متوقف',completed:'مكتمل',cancelled:'ملغي'};
    setContent('أوامر التصنيع',`<section class="section-card">${pageToolbar('أوامر العمل','قسّم التصنيع حسب القسم واربط كل أمر بمشروع','إنشاء أمر')}
      ${tableHtml(['رقم الأمر','المشروع','القسم','الحالة','التعليمات'],data.map(x=>`<tr><td>#${x.order_no}</td><td>${esc(map.get(x.project_id)?.title||'مشروع غير معروف')}</td><td>${departments[x.department]||esc(x.department)}</td><td><span class="status-tag">${statuses[x.status]||esc(x.status)}</span></td><td>${esc(x.instructions||'—')}</td></tr>`).join(''))}</section>`);
    document.querySelector('[data-action]').onclick=()=>openForm('إنشاء أمر تصنيع',[
      {name:'project_id',label:'المشروع',type:'select',required:true,options:projects.map(p=>({value:p.id,label:'#'+p.project_no+' — '+p.title}))},
      {name:'department',label:'القسم',type:'select',required:true,options:Object.entries(departments).map(([value,label])=>({value,label}))},
      {name:'instructions',label:'تعليمات التنفيذ',type:'textarea'}
    ],d=>insertRow('work_orders',d));
  } catch(error){showError(error);}
}
async function renderSurveys() {
  try {
    const [data,projects]=await Promise.all([rows('room_surveys','id,project_id,room_name,length_cm,width_cm,height_cm,notes'),rows('projects','id,title,project_no')]);
    const map=new Map(projects.map(p=>[p.id,p]));
    setContent('قياسات المواقع',`<section class="section-card">${pageToolbar('رفع القياسات','سجّل أبعاد الغرف وملاحظات الموقع لكل مشروع','إضافة قياسات')}
      ${tableHtml(['المشروع','الموقع / الغرفة','الطول (سم)','العرض (سم)','الارتفاع (سم)','ملاحظات'],data.map(x=>`<tr><td>${esc(map.get(x.project_id)?.title||'—')}</td><td>${esc(x.room_name)}</td><td>${esc(x.length_cm??'—')}</td><td>${esc(x.width_cm??'—')}</td><td>${esc(x.height_cm??'—')}</td><td>${esc(x.notes||'—')}</td></tr>`).join(''))}</section>`);
    document.querySelector('[data-action]').onclick=()=>openForm('إضافة قياسات موقع',[
      {name:'project_id',label:'المشروع',type:'select',required:true,options:projects.map(p=>({value:p.id,label:'#'+p.project_no+' — '+p.title}))},
      {name:'room_name',label:'اسم الغرفة أو الموقع',required:true},
      {name:'length_cm',label:'الطول (سم)',type:'number',min:0},
      {name:'width_cm',label:'العرض (سم)',type:'number',min:0},
      {name:'height_cm',label:'الارتفاع (سم)',type:'number',min:0},
      {name:'notes',label:'ملاحظات الموقع',type:'textarea'}
    ],d=>insertRow('room_surveys',{...d,length_cm:d.length_cm?Number(d.length_cm):null,width_cm:d.width_cm?Number(d.width_cm):null,height_cm:d.height_cm?Number(d.height_cm):null}));
  } catch(error){showError(error);}
}
function renderProduction() {
  setContent('متابعة الإنتاج',`<section class="section-card"><div class="section-heading"><div><h2>مراحل الإنتاج</h2><p>عرض أوامر التصنيع حسب حالتها ومتابعة الإنجاز</p></div><button class="btn" data-open-orders>فتح أوامر التصنيع</button></div><div class="empty-state"><h3>مركز متابعة الإنتاج</h3><p>أوامر العمل محفوظة في قسم التصنيع. سيتم إضافة مراحل التشغيل، نسب الإنجاز، فحص الجودة وتواريخ التسليم في المرحلة التالية.</p></div></section>`);
  document.querySelector('[data-open-orders]').onclick=()=>navigate('orders');
}
function renderDelivery() {
  setContent('التسليم',`<section class="section-card"><div class="section-heading"><div><h2>التسليم والتركيب</h2><p>تجهيز متابعة تسليم المشاريع للعملاء</p></div></div><div class="empty-state"><h3>سجل التسليم</h3><p>سيتم ربط هذا القسم بالمشاريع المكتملة، مع موعد التسليم، عنوان العميل، محضر الاستلام والملاحظات.</p></div></section>`);
}
async function renderReports() {
  try {
    const [projects,materials,orders]=await Promise.all([rows('projects','id,status,estimated_cost'),rows('materials','id,quantity,min_quantity'),rows('work_orders','id,status')]);
    setContent('الحسابات والتقارير',`<section class="stats-grid">
      ${statCard('قيمة المشاريع التقديرية',money(projects.reduce((s,p)=>s+Number(p.estimated_cost||0),0)),'حسب القيم المدخلة')}
      ${statCard('مواد تحتاج إعادة طلب',materials.filter(m=>Number(m.quantity)<=Number(m.min_quantity)).length,'تحت حد المخزون')}
      ${statCard('أوامر مكتملة',orders.filter(o=>o.status==='completed').length,'من إجمالي '+orders.length)}
    </section><section class="notice-card"><strong>مرحلة الحسابات التفصيلية</strong><p>سيتم بناء المصروفات والمشتريات والفواتير والدفعات والأرباح بعد اعتماد دورة المشروع وأوامر التصنيع، مع سجل مالي واضح لكل مشروع.</p></section>`);
  } catch(error){showError(error);}
}

/* 3D studio: an editable concept model, explicitly not certified manufacturing CAD. */
function renderStudio() {
  setContent('مكتب التصميم 3D',`
    <section class="studio-layout">
      <div class="section-card studio-controls">
        <div class="section-heading"><div><h2>خصائص النموذج</h2><p>عدّل الأبعاد وشاهد أثرها مباشرة</p></div></div>
        <div class="form-field"><label>اسم التصميم</label><input id="modelName" value="كنبة تجريبية"></div>
        <div class="form-field"><label>نوع القطعة</label><select id="modelType"><option value="sofa">كنبة مستقيمة</option><option value="chair">كرسي مفرد</option></select></div>
        <div class="dimension-grid">
          <div class="form-field"><label>العرض (مم)</label><input id="dimW" type="number" min="100" max="5000" value="2200"></div>
          <div class="form-field"><label>العمق (مم)</label><input id="dimD" type="number" min="100" max="3000" value="900"></div>
          <div class="form-field"><label>الارتفاع (مم)</label><input id="dimH" type="number" min="100" max="3000" value="850"></div>
        </div>
        <div class="form-field"><label>لون القماش</label><select id="modelColor"><option value="#71847e">أخضر رمادي</option><option value="#9a806b">بني فاتح</option><option value="#68758b">أزرق رمادي</option><option value="#b5aaa0">بيج</option></select></div>
        <div class="button-row"><button class="btn btn-primary" id="applyModel">تحديث المجسم</button><button class="btn" id="explodeModel">فصل الأجزاء</button><button class="btn" id="resetModel">إعادة التجميع</button></div>
        <div class="form-field"><label>حفظ التصميم ضمن مشروع</label><select id="saveProject"><option value="">اختر مشروعاً…</option></select></div>
        <button class="btn btn-primary btn-wide" id="saveModel">حفظ بيانات التصميم</button>
        <p class="field-note">الأبعاد في هذا النموذج أولية للمعاينة وليست رسومات تصنيع معتمدة أو قائمة قص.</p>
      </div>
      <div class="section-card studio-view"><div class="section-heading"><div><h2>المعاينة ثلاثية الأبعاد</h2><p>اسحب للتدوير واستخدم التكبير للاقتراب</p></div><span class="live-tag">معاينة مباشرة</span></div><div id="modelViewport"></div><div class="studio-legend"><span>● الهيكل</span><span>● الوسائد</span><span>● الأرجل</span></div></div>
    </section>
    <section class="section-card"><h2>مكتبة المراجع القديمة</h2><p class="muted">تم حفظ مكتبات الموديلات والمعرض القديم داخل المستودع كمصادر مرجعية، وسيتم دمجها تدريجياً بعد فحص تراخيص الأصول.</p><div class="legacy-links"><a href="/archive/legacy/library-3d.html" target="_blank" rel="noopener">مكتبة موديلات 3D القديمة ↗</a><a href="/archive/legacy/library-polyhaven.html" target="_blank" rel="noopener">مكتبة Poly Haven ↗</a><a href="/archive/legacy/showroom-2026.html" target="_blank" rel="noopener">معرض الأثاث ↗</a></div></section>
  `);
  initStudio();
}
async function initStudio() {
  const [THREE, controlsModule] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]);
  const { OrbitControls } = controlsModule;
  const projectSelect=document.querySelector('#saveProject');
  try {
    const projects=await rows('projects','id,project_no,title');
    projectSelect.innerHTML='<option value="">اختر مشروعاً…</option>'+projects.map(p=>`<option value="${p.id}">#${p.project_no} — ${esc(p.title)}</option>`).join('');
  } catch(e) { projectSelect.innerHTML='<option value="">تعذر تحميل المشاريع</option>'; }
  const host=document.querySelector('#modelViewport');
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#14232c');
  const camera=new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(4.3,3.1,5.2);
  let renderer,controls,raf=0,parts=[],separated=false;
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,.55,0);
    const draw=()=>{raf=0;controls.update();renderer.render(scene,camera);};
    const request=()=>{if(!raf)raf=requestAnimationFrame(draw);};
    controls.addEventListener('change',request);
    scene.add(new THREE.HemisphereLight(0xddeeff,0x27313a,2));
    const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(4,7,5);scene.add(light);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#182a33',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
    const grid=new THREE.GridHelper(10,20,0x35505b,0x263c46);grid.position.y=-.02;scene.add(grid);
    const group=new THREE.Group();scene.add(group);
    const resize=()=>{if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);request();};
    const observer=new ResizeObserver(resize);observer.observe(host);
    const build=()=>{
      for(const p of [...group.children]){group.remove(p);p.geometry.dispose();p.material.dispose();}
      parts=[]; const w=clamp('dimW',100,5000)/1000,d=clamp('dimD',100,3000)/1000,h=clamp('dimH',100,3000)/1000;
      const isChair=document.querySelector('#modelType').value==='chair';
      const cloth=new THREE.MeshStandardMaterial({color:document.querySelector('#modelColor').value,roughness:.8});
      const wood=new THREE.MeshStandardMaterial({color:'#4d4035'}),foam=new THREE.MeshStandardMaterial({color:'#b8a48f'}),metal=new THREE.MeshStandardMaterial({color:'#596b76',metalness:.55,roughness:.35});
      const add=(name,x,y,z,sx,sy,sz,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat.clone());m.position.set(x,y,z);m.castShadow=true;m.userData.base=m.position.clone();m.userData.partName=name;group.add(m);parts.push(m);};
      const seatY=Math.max(.28,h*.38),seatH=Math.max(.13,h*.19),backH=Math.max(.3,h*.48);
      add('قاعدة الهيكل',0,.18,0,w*.94,.16,d*.88,wood);
      add('وسادة المقعد',0,seatY,0,w*.9,seatH,d*.78,cloth);
      add('مسند الظهر',0,seatY+backH*.47,-d*.38,w*.94,backH,.16,cloth);
      const armW=isChair ? 0.13 : 0.16;
      add('ذراع أيسر',-w*.43,seatY*.48,0,armW,seatY+backH*.2,d*.82,cloth);
      add('ذراع أيمن',w*.43,seatY*.48,0,armW,seatY+backH*.2,d*.82,cloth);
      for(let i=0;i<(isChair?1:3);i++){const x=isChair?0:(i-1)*w*.29;add('وسادة جلوس '+(i+1),x,seatY+.1,.035,w*(isChair?.7:.27),.12,d*.62,foam);}
      for(const xs of [-1,1])for(const zs of [-1,1])add('رجل',xs*w*.4,.09,zs*d*.38,.065,.18,.065,metal);
      separated=false;request();
    };
    const clamp=(id,min,max)=>{const el=document.querySelector('#'+id);const n=Number(el.value);const v=Math.round(Math.max(min,Math.min(max,Number.isFinite(n)?n:min)));el.value=v;return v;};
    document.querySelector('#applyModel').onclick=build;
    document.querySelector('#modelType').onchange=()=>{const chair=document.querySelector('#modelType').value==='chair';document.querySelector('#dimW').value=chair?850:2200;document.querySelector('#dimD').value=850;document.querySelector('#dimH').value=chair?900:850;document.querySelector('#modelName').value=chair?'كرسي تجريبي':'كنبة تجريبية';build();};
    document.querySelector('#modelColor').onchange=build;
    document.querySelector('#explodeModel').onclick=()=>{if(separated)return;parts.forEach((p,i)=>{p.position.y+=.12+(i%3)*.08;p.position.x+=(i%2?1:-1)*.12;});separated=true;request();};
    document.querySelector('#resetModel').onclick=()=>{parts.forEach(p=>p.position.copy(p.userData.base));separated=false;request();};
    document.querySelector('#saveModel').onclick=async()=>{
      const projectId=projectSelect.value;if(!projectId){alert('اختر المشروع أولاً');return;}
      const design={name:document.querySelector('#modelName').value,type:document.querySelector('#modelType').value,dimensions_mm:{width:clamp('dimW',100,5000),depth:clamp('dimD',100,3000),height:clamp('dimH',100,3000)},fabric_color:document.querySelector('#modelColor').value,parts:parts.map(p=>({name:p.userData.partName,position:p.userData.base.toArray()})),status:'concept_not_for_manufacturing'};
      const {data:project,error:readError}=await supabase.from('projects').select('design_data').eq('id',projectId).single();if(readError){alert(readError.message);return;}
      const {error}=await supabase.from('projects').update({design_data:{...(project.design_data||{}),furniture_model:design}}).eq('id',projectId);if(error)alert(error.message);else alert('تم حفظ بيانات التصميم على المشروع.');
    };
    build();resize();
    sceneCleanup=()=>{observer.disconnect();cancelAnimationFrame(raf);controls.dispose();renderer.dispose();renderer.domElement.remove();};
  } catch(error) {host.innerHTML='<div class="scene-fallback">تعذّر تشغيل العرض ثلاثي الأبعاد. تأكد من دعم WebGL في المتصفح.</div>';console.error(error);}
}
