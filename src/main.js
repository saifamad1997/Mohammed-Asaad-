import { supabase, supabaseConfigured } from './lib/supabase.js';
import { initAuthGate } from './lib/auth-gate.js';
import './style.css';

const app = document.querySelector('#app');
const navItems = [
  ['dashboard','لوحة المعلومات','⌂'],['customers','العملاء','♙'],['projects','المشاريع','▦'],
  ['studio','مكتب التصميم 3D','◇'],['surveys','قياسات المواقع','⌖'],['materials','المستودعات والمواد','▤'],
  ['orders','أوامر التصنيع','⚒'],['production','متابعة الإنتاج','◷'],['delivery','التسليم','✓'],
  ['reports','الحسابات والتقارير','▥'],['sweet-home-3d','Sweet Home 3D','⌂']
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
      <div class="top-actions"><span class="user-pill" id="userLabel">جارٍ التحقق…</span><button class="btn btn-primary install-app-btn" id="installApp" type="button">تثبيت التطبيق</button><button class="btn btn-quiet" id="signOut" type="button">تسجيل الخروج</button></div>
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
  const button = document.querySelector('#signOut');
  button.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    location.reload();
  } catch (error) {
    button.disabled = false;
    alert(error?.message || 'تعذر تسجيل الخروج. حاول مرة أخرى.');
  }
});

let installPrompt = null;
const installButton = document.querySelector('#installApp');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
  installButton.textContent = 'تم تثبيت التطبيق';
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    alert('لتثبيت البرنامج: افتح قائمة المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».');
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => console.warn('PWA worker:', error)));
}
initAuthGate(supabase);
if (!supabaseConfigured) {
  document.querySelector('#userLabel').textContent = 'إعدادات الربط ناقصة';
} else {
  supabase.auth.getSession().then(({data,error}) => {
    if (error) throw error;
    currentUser = data?.session?.user || null;
    updateUser();
    if (currentUser) navigate(currentPage);
  }).catch(error => {
    updateUser();
    showError(error);
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
    studio: renderStudio, 'sweet-home-3d': renderSweetHome3D, surveys: renderSurveys, materials: renderMaterials,
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
async function renderProduction() {
  try {
    const [orders, projects] = await Promise.all([
      rows('work_orders','id,order_no,project_id,department,status,instructions,created_at'),
      rows('projects','id,title,project_no')
    ]);
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const departments = {carpentry:'نجارة',metalwork:'حدادة',upholstery:'تنجيد',general:'عام'};
    const statuses = {pending:'بانتظار البدء',in_progress:'قيد التنفيذ',blocked:'متوقف',completed:'مكتمل',cancelled:'ملغي'};
    const counts = Object.fromEntries(Object.keys(statuses).map(key => [key, orders.filter(o => o.status === key).length]));
    setContent('متابعة الإنتاج',`
      <section class="stats-grid">
        ${statCard('بانتظار البدء',counts.pending,'أوامر لم يبدأ تنفيذها')}
        ${statCard('قيد التنفيذ',counts.in_progress,'أوامر داخل الورشة')}
        ${statCard('متوقفة',counts.blocked,'تحتاج معالجة')}
        ${statCard('مكتملة',counts.completed,'أنهت مرحلة التصنيع')}
      </section>
      <section class="section-card">
        <div class="section-heading"><div><h2>متابعة أوامر الورشة</h2><p>غيّر حالة كل أمر بعد تحديث العمل الفعلي في الورشة</p></div><button class="btn" data-open-orders>إدارة أوامر التصنيع</button></div>
        ${tableHtml(['رقم الأمر','المشروع','القسم','التعليمات','الحالة الحالية','تحديث الحالة'],orders.map(o=>{
          const project=projectMap.get(o.project_id);
          return `<tr>
            <td>#${esc(o.order_no)}</td>
            <td>${esc(project ? '#'+project.project_no+' — '+project.title : 'مشروع غير معروف')}</td>
            <td>${esc(departments[o.department]||o.department)}</td>
            <td>${esc(o.instructions||'—')}</td>
            <td><span class="status-tag">${esc(statuses[o.status]||o.status)}</span></td>
            <td><div class="inline-status"><select data-order-status="${esc(o.id)}">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${o.status===value?'selected':''}>${label}</option>`).join('')}</select><button class="btn btn-small" data-save-order="${esc(o.id)}">حفظ</button></div></td>
          </tr>`;
        }).join(''))}
        ${orders.length ? '' : '<div class="empty-state"><h3>لا توجد أوامر تصنيع بعد</h3><p>أنشئ أمر عمل من قسم أوامر التصنيع ليظهر هنا.</p></div>'}
      </section>
      <section class="notice-card"><strong>ملاحظة تشغيلية</strong><p>تحديث الحالة يسجل المرحلة الحالية لأمر العمل. نسب الإنجاز وفحص الجودة وتواريخ التسليم التفصيلية ستكون ضمن توسعة دورة الإنتاج التالية.</p></section>
    `);
    document.querySelector('[data-open-orders]').onclick=()=>navigate('orders');
    document.querySelectorAll('[data-save-order]').forEach(button=>{
      button.addEventListener('click',async()=>{
        const id=button.dataset.saveOrder;
        const select=document.querySelector(`[data-order-status="${id}"]`);
        const status=select?.value;
        if(!status || !Object.hasOwn(statuses,status)) return;
        button.disabled=true;
        button.textContent='جارٍ الحفظ…';
        try {
          const {error}=await supabase.from('work_orders').update({status}).eq('id',id).eq('owner_id',currentUser.id);
          if(error) throw error;
          await renderProduction();
        } catch(error) {
          button.disabled=false;
          button.textContent='حفظ';
          alert(error?.message||'تعذر تحديث حالة أمر العمل');
        }
      });
    });
  } catch(error) { showError(error); }
}
async function renderDelivery() {
  try {
    const projects = await rows('projects','id,project_no,customer_id,title,status,estimated_cost,description,design_data,created_at');
    const customers = await rows('customers','id,full_name,phone,address');
    const customerMap = new Map(customers.map(c=>[c.id,c]));
    const deliveryStatus = {ready:'جاهز للتسليم',scheduled:'تم تحديد الموعد',delivered:'تم التسليم',hold:'مؤجل'};
    const deliveryFrom = project => project.design_data?.delivery || {};
    const deliveryRows = projects
      .filter(p => !['cancelled','draft'].includes(p.status))
      .map(p => {
        const customer = customerMap.get(p.customer_id);
        const d = deliveryFrom(p);
        const status = d.status || (p.status === 'completed' ? 'ready' : 'hold');
        return `<tr>
          <td>#${esc(p.project_no)}</td>
          <td>${esc(p.title)}</td>
          <td>${esc(customer?.full_name || '—')}</td>
          <td>${esc(customer?.phone || '—')}</td>
          <td>${esc(d.date || 'غير محدد')}</td>
          <td><span class="status-tag">${esc(deliveryStatus[status] || status)}</span></td>
          <td><button class="btn btn-small" data-delivery-project="${esc(p.id)}">تحديث</button></td>
        </tr>`;
      }).join('');

    setContent('التسليم',`
      <section class="section-card">
        <div class="section-heading">
          <div><h2>التسليم والتركيب</h2><p>متابعة المشاريع الجاهزة، موعد التسليم، عنوان العميل ومحضر الاستلام.</p></div>
          <button class="btn" data-delivery-print>طباعة السجل</button>
        </div>
        ${tableHtml(['المشروع','اسم المشروع','العميل','الهاتف','موعد التسليم','الحالة','إجراء'],deliveryRows)}
      </section>
      <section class="notice-card">
        <strong>طريقة العمل</strong>
        <p>يُحفظ سجل التسليم داخل ملف المشروع نفسه، لذلك لا توجد بيانات منفصلة قد تضيع عن المشروع. حدّث الموعد والحالة من زر «تحديث».</p>
      </section>
    `);

    document.querySelector('[data-delivery-print]')?.addEventListener('click',()=>window.print());
    document.querySelectorAll('[data-delivery-project]').forEach(button=>{
      button.addEventListener('click',()=>{
        const project=projects.find(p=>p.id===button.dataset.deliveryProject);
        if(!project) return;
        const customer=customerMap.get(project.customer_id);
        const d=deliveryFrom(project);
        openForm('تحديث تسليم المشروع',[
          {name:'status',label:'حالة التسليم',type:'select',required:true,options:Object.entries(deliveryStatus).map(([value,label])=>({value,label}))},
          {name:'date',label:'موعد التسليم',type:'date'},
          {name:'address',label:'عنوان التسليم',placeholder:customer?.address||''},
          {name:'received_by',label:'المستلم'},
          {name:'notes',label:'ملاحظات ومحضر الاستلام',type:'textarea'}
        ],async formData=>{
          const nextDelivery={...d,...formData,updated_at:new Date().toISOString()};
          const nextDesignData={...(project.design_data||{}),delivery:nextDelivery};
          const {error}=await supabase.from('projects')
            .update({design_data:nextDesignData})
            .eq('id',project.id)
            .eq('owner_id',currentUser.id);
          if(error) throw error;
        });
        setTimeout(()=>{
          const form=document.querySelector('.modal-backdrop form');
          if(!form) return;
          for(const [key,value] of Object.entries({status:d.status||'ready',date:d.date||'',address:d.address||customer?.address||'',received_by:d.received_by||'',notes:d.notes||''})){
            const field=form.elements.namedItem(key);
            if(field) field.value=value;
          }
        },0);
      });
    });
  } catch(error) { showError(error); }
}
async function renderReports() {
  try {
    const [projects,materials,orders,finance]=await Promise.all([
      rows('projects','id,project_no,title,status,estimated_cost'),
      rows('materials','id,quantity,min_quantity'),
      rows('work_orders','id,status'),
      rows('project_finances','id,project_id,type,amount,description,paid_at')
    ]);
    const projectMap=new Map(projects.map(p=>[p.id,p]));
    const expenses=finance.filter(x=>x.type==='expense');
    const payments=finance.filter(x=>x.type==='payment');
    const invoices=finance.filter(x=>x.type==='invoice');
    const totalEstimated=projects.reduce((s,p)=>s+Number(p.estimated_cost||0),0);
    const totalExpenses=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
    const totalPayments=payments.reduce((s,x)=>s+Number(x.amount||0),0);
    const totalInvoices=invoices.reduce((s,x)=>s+Number(x.amount||0),0);
    const outstanding=Math.max(0,totalInvoices-totalPayments);
    setContent('الحسابات والتقارير',`
      <section class="stats-grid">
        ${statCard('قيمة المشاريع التقديرية',money(totalEstimated),'حسب القيم المدخلة')}
        ${statCard('المصروفات',money(totalExpenses),'مصروفات مسجلة')}
        ${statCard('الدفعات المحصلة',money(totalPayments),'دفعات العملاء')}
        ${statCard('المتبقي على الفواتير',money(outstanding),'فواتير ناقص الدفعات')}
      </section>
      <section class="section-card">
        ${pageToolbar('السجل المالي','أضف مصروفاً أو فاتورة أو دفعة واربطها بالمشروع','إضافة حركة مالية','new-finance')}
        ${tableHtml(['التاريخ','المشروع','النوع','البيان','المبلغ'],finance.map(x=>`<tr><td>${esc(new Date(x.paid_at||x.created_at).toLocaleDateString('ar-JO'))}</td><td>#${esc(projectMap.get(x.project_id)?.project_no||'—')} — ${esc(projectMap.get(x.project_id)?.title||'—')}</td><td>${esc({expense:'مصروف',payment:'دفعة',invoice:'فاتورة'}[x.type]||x.type)}</td><td>${esc(x.description||'—')}</td><td>${money(x.amount)}</td></tr>`).join(''))}
      </section>
      <section class="section-card">
        <div class="section-heading"><div><h2>حالة التشغيل</h2><p>ملخص سريع للأعمال والمخزون والتصنيع.</p></div></div>
        <div class="stats-grid">
          ${statCard('مواد تحتاج إعادة طلب',materials.filter(m=>Number(m.quantity)<=Number(m.min_quantity)).length,'تحت حد المخزون')}
          ${statCard('أوامر مكتملة',orders.filter(o=>o.status==='completed').length,'من إجمالي '+orders.length)}
        </div>
      </section>
    `);
    document.querySelector('[data-action="new-finance"]').onclick=()=>openForm('إضافة حركة مالية',[
      {name:'project_id',label:'المشروع',type:'select',required:true,options:projects.map(p=>({value:p.id,label:'#'+p.project_no+' — '+p.title}))},
      {name:'type',label:'نوع الحركة',type:'select',required:true,options:[{value:'expense',label:'مصروف'},{value:'payment',label:'دفعة'},{value:'invoice',label:'فاتورة'}]},
      {name:'amount',label:'المبلغ بالدينار',type:'number',min:0.01,required:true},
      {name:'paid_at',label:'التاريخ',type:'date'},
      {name:'description',label:'البيان',type:'textarea'}
    ],async data=>{
      await insertRow('project_finances',{project_id:data.project_id,type:data.type,amount:Number(data.amount),description:data.description||null,paid_at:data.paid_at?new Date(data.paid_at).toISOString():new Date().toISOString()});
    });
  } catch(error){showError(error);}
}

/* Optional Sweet Home 3D workspace. Kept separate from the native furniture studio. */
function renderSweetHome3D() {
  const onlineUrl = 'https://www.sweethome3d.com/SweetHome3DJSOnline.jsp';
  setContent('Sweet Home 3D', `
    <section class="section-card" dir="rtl" style="display:grid;gap:16px">
      <div class="section-heading">
        <div>
          <h2>Sweet Home 3D</h2>
          <p>مساحة اختيارية لتخطيط الغرف وتجربة توزيع الأثاث وعرضه ثنائي وثلاثي الأبعاد.</p>
        </div>
        <a class="btn btn-primary" href="${onlineUrl}" target="_blank" rel="noopener noreferrer">فتح البرنامج بنافذة مستقلة ↗</a>
      </div>
      <div style="overflow:hidden;border:1px solid #e1e9e3;border-radius:16px;background:#f7faf8">
        <iframe
          title="Sweet Home 3D Online"
          src="${onlineUrl}"
          loading="lazy"
          allow="fullscreen; clipboard-read; clipboard-write"
          referrerpolicy="strict-origin-when-cross-origin"
          style="display:block;width:100%;height:78vh;min-height:620px;border:0;background:#fff"
        ></iframe>
      </div>
      <div class="notice-card">
        <strong>ملاحظة مهمة</strong>
        <p>هذه أداة خارجية مستقلة وليست جزءاً من حفظ مشاريع محمد أسعد. قد تحتاج إلى التسجيل في Sweet Home 3D لحفظ تصاميمك على خدمتهم. إذا لم يظهر البرنامج داخل الصفحة بسبب قيود المتصفح، استخدم زر «فتح البرنامج بنافذة مستقلة» أعلاه.</p>
      </div>
    </section>
  `);
}

/* 3D studio: an editable concept model, explicitly not certified manufacturing CAD. */
function renderStudio() {
  setContent('مكتب التصميم 3D',`
    <section class="model-office" dir="rtl">
      <header class="model-office-head">
        <div class="model-office-brand"><span class="model-office-mark">MA</span><div><strong>محمد أسعد للتنجيد</strong><small>مكتب الموديل ثلاثي الأبعاد</small></div></div>
        <div class="model-office-status"><i></i> مساحة التصميم جاهزة</div>
      </header>
      <div class="model-office-workspace">
        <aside class="model-office-panel">
          <div class="model-panel-title"><span>01 / الخصائص</span><h2>بيانات القطعة</h2><p>تحكم بالأبعاد والخامات وشاهد التغييرات مباشرة</p></div>
          <div class="model-office-field"><label for="modelName">اسم التصميم</label><input id="modelName" value="كنبة تجريبية"></div>
          <div class="model-office-field"><label for="modelType">نوع القطعة</label><select id="modelType"><option value="sofa">كنبة مستقيمة</option><option value="corner">كنبة زاوية L</option><option value="chair">كرسي مفرد</option></select></div>
          <div class="model-office-divider"></div>
          <div class="model-panel-subtitle">الأبعاد الهندسية <span>MM</span></div>
          <div class="model-dimension-grid">
            <div class="model-office-field"><label for="dimW">العرض</label><div class="model-input-unit"><input id="dimW" type="number" min="100" max="5000" value="2200"><span>مم</span></div></div>
            <div class="model-office-field"><label for="dimD">العمق</label><div class="model-input-unit"><input id="dimD" type="number" min="100" max="3000" value="900"><span>مم</span></div></div>
            <div class="model-office-field"><label for="dimH">الارتفاع</label><div class="model-input-unit"><input id="dimH" type="number" min="100" max="3000" value="850"><span>مم</span></div></div>
          </div>
          <div class="model-office-divider"></div>
          <div class="model-office-field"><label for="modelColor">لون القماش</label><select id="modelColor"><option value="#71847e">أخضر رمادي</option><option value="#9a806b">بني فاتح</option><option value="#68758b">أزرق رمادي</option><option value="#b5aaa0">بيج</option><option value="#34383c">فحمي</option><option value="#b6a18a">جملي</option></select></div>
          <div class="model-office-divider"></div>
          <div class="model-panel-subtitle">الخامات والتنجيد <span>مواد فعلية</span></div>
          <div class="model-office-field"><label for="modelWood">خشب الهيكل</label><select id="modelWood"><option value="beech">زان صلب</option><option value="pine">سويد / صنوبر</option><option value="plywood">كونتر مقاوم</option></select></div>
          <div class="model-office-field"><label for="modelBoard">ألواح القاعدة</label><select id="modelBoard"><option value="plywood18">كونتر 18 مم</option><option value="plywood15">كونتر 15 مم</option><option value="mdf18">MDF 18 مم</option></select></div>
          <div class="model-office-field"><label for="modelFoam">نوع الإسفنج</label><select id="modelFoam"><option value="hr35">HR كثافة 35</option><option value="hr40">HR كثافة 40</option><option value="soft28">ناعم كثافة 28</option><option value="firm45">قاسي كثافة 45</option></select></div>
          <div class="model-office-field"><label for="modelFabric">نوع القماش</label><select id="modelFabric"><option value="linen">كتان منسوج</option><option value="velvet">مخمل</option><option value="chenille">شنيل</option><option value="boucle">بوكلية</option><option value="leather">جلد</option></select></div>
          <div class="model-office-field"><label for="modelSupport">نظام التعليق</label><select id="modelSupport"><option value="webbing">أحزمة تنجيد</option><option value="spring">يايات + أحزمة</option><option value="plywood">قاعدة خشب كونتر</option></select></div>
          <div class="model-office-actions"><button class="model-action-primary" id="applyModel">⟳ تحديث المجسم</button><div><button id="explodeModel">فصل الأجزاء</button><button id="resetModel">إعادة التجميع</button></div></div>
          <div class="model-office-divider"></div>
          <div class="model-office-field"><label for="saveProject">ربط التصميم بمشروع</label><select id="saveProject"><option value="">اختر المشروع…</option></select></div>
          <button class="model-save-button" id="saveModel">حفظ التصميم في المشروع <span>↙</span></button>
          <p class="model-office-note">تنبيه: هذا النموذج للمعاينة الأولية، والأبعاد لا تُعتمد للتصنيع قبل مراجعتها هندسياً.</p>
        </aside>
        <main class="model-office-stage">
          <div class="model-stage-toolbar"><div><span class="model-stage-kicker">3D WORKSPACE / LIVE VIEW</span><h2>معاينة النموذج</h2><p>اسحب لتدوير القطعة · استخدم عجلة التكبير للاقتراب</p></div><span class="model-live-pill"><i></i> عرض مباشر</span></div>
          <div id="modelViewport" class="model-viewport-dark"><div class="model-loading-hint">جارٍ تجهيز مساحة العرض ثلاثية الأبعاد…</div></div>
          <div class="model-stage-footer"><div class="model-material-legend"><span><i class="legend-frame"></i> الهيكل</span><span><i class="legend-fabric"></i> القماش والوسائد</span><span><i class="legend-metal"></i> الأرجل</span></div><span class="model-unit-label">الوحدات: ملليمتر</span></div>
        </main>
      </div>
    </section>
    <section class="model-reference-links"><div><h3>مكتبة المراجع</h3><p>روابط المكتبات المحفوظة داخل النظام</p></div><div class="legacy-links"><a href="/archive/legacy/library-3d.html" target="_blank" rel="noopener">مكتبة موديلات 3D ↗</a><a href="/library.html" target="_blank" rel="noopener">مكتبة الخامات ↗</a><a href="/archive/legacy/showroom-2026.html" target="_blank" rel="noopener">معرض الأثاث ↗</a></div></section>
  `);
  initStudio();
}
async function initStudio() {
  let THREE, controlsModule, roundedModule;
  const host = document.querySelector('#modelViewport');
  try {
    [THREE, controlsModule, roundedModule] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/geometries/RoundedBoxGeometry.js')]);
  } catch (error) {
    if (host) host.innerHTML = '<div class="scene-fallback">تعذّر تحميل مكتبة العرض ثلاثي الأبعاد. تحقق من الاتصال ثم أعد فتح المكتب.</div>';
    console.error(error);
    return;
  }
  const { OrbitControls } = controlsModule;
  const { RoundedBoxGeometry } = roundedModule;
  const projectSelect=document.querySelector('#saveProject');
  try {
    const projects=await rows('projects','id,project_no,title,design_data');
    projectSelect.innerHTML='<option value="">اختر مشروعاً…</option>'+projects.map(p=>`<option value="${p.id}" data-design="${esc(JSON.stringify(p.design_data?.furniture_model || {}))}">#${p.project_no} — ${esc(p.title)}</option>`).join('');
  } catch(e) { projectSelect.innerHTML='<option value="">تعذر تحميل المشاريع</option>'; }
  if (!host || !host.isConnected) return;
  const officePanel=document.querySelector('.model-office-panel');
  const partsBox=document.createElement('div');
  partsBox.className='model-office-field';
  partsBox.innerHTML='<label>مكونات القطعة — اختر مكوّناً لتعديله</label><div id="modelPartsList" class="model-parts-list"><span>سيتم تحديث القائمة بعد بناء النموذج.</span></div><div id="modelPartEditor" class="model-part-editor"><p>اختر أحد المكونات لعرض أبعاده وتعديل موضعه.</p></div>';
  const dimensionBox=document.createElement('div');
  dimensionBox.className='model-dimension-tools';
  dimensionBox.innerHTML='<button type="button" id="toggleDimensions">إخفاء الأبعاد</button><button type="button" id="loadSavedModel">تحميل تصميم المشروع</button>';
  officePanel?.insertBefore(partsBox, officePanel.querySelector('.model-office-note'));
  officePanel?.insertBefore(dimensionBox, officePanel.querySelector('.model-office-note'));
  host.style.position='relative';
  const dimensionOverlay=document.createElement('div');
  dimensionOverlay.className='model-dimension-overlay';
  dimensionOverlay.innerHTML='<span class="dimension-width"></span><span class="dimension-depth"></span><span class="dimension-height"></span>';
  host.appendChild(dimensionOverlay);
  let dimensionsVisible=true;
  document.querySelector('#toggleDimensions').onclick=()=>{
    dimensionsVisible=!dimensionsVisible;
    dimensionOverlay.hidden=!dimensionsVisible;
    document.querySelector('#toggleDimensions').textContent=dimensionsVisible?'إخفاء الأبعاد':'إظهار الأبعاد';
  };
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#14232c');
  const camera=new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(3.9,2.65,4.8);
  let renderer,controls,raf=0,parts=[],separated=false;
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const loadingHint=host.querySelector('.model-loading-hint'); if(loadingHint) loadingHint.remove();
    controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,.55,0);
    const draw=()=>{raf=0;controls.update();renderer.render(scene,camera);};
    const request=()=>{if(!raf)raf=requestAnimationFrame(draw);};
    controls.addEventListener('change',request);
    scene.add(new THREE.HemisphereLight(0xe5f4f4,0x26333a,2.1));
    const light=new THREE.DirectionalLight(0xfff3df,3.0);light.position.set(4,7,5);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-5;light.shadow.camera.right=5;light.shadow.camera.top=5;light.shadow.camera.bottom=-5;scene.add(light);
    const fillLight=new THREE.PointLight(0x55bdb5,1.0,12);fillLight.position.set(-3,2.5,-2);scene.add(fillLight);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#765b45',roughness:.82}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
    const floorLines=new THREE.Group();scene.add(floorLines);
    const plankMatA=new THREE.MeshStandardMaterial({color:'#8b6a50',roughness:.78}),plankMatB=new THREE.MeshStandardMaterial({color:'#6f513d',roughness:.82});
    for(let i=-9;i<=9;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(19.8,.012,.018),i%2?plankMatA:plankMatB);plank.position.set(0,-.027,i*.48);floorLines.add(plank);}
    const rug=new THREE.Mesh(new THREE.CircleGeometry(2.1,64),new THREE.MeshStandardMaterial({color:'#31454a',roughness:1}));rug.rotation.x=-Math.PI/2;rug.scale.set(1.25,.72,1);rug.position.set(0,-.018,.25);rug.receiveShadow=true;scene.add(rug);
    const grid=new THREE.GridHelper(10,20,0x45616a,0x30454d);grid.position.y=-.012;grid.material.transparent=true;grid.material.opacity=.16;scene.add(grid);
    const group=new THREE.Group();scene.add(group);
    const resize=()=>{if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);request();};
    const observer=new ResizeObserver(resize);observer.observe(host);
    const build=()=>{
      for(const p of [...group.children]){group.remove(p);p.geometry.dispose();p.material.dispose();}
      parts=[]; const w=clamp('dimW',100,5000)/1000,d=clamp('dimD',100,3000)/1000,h=clamp('dimH',100,3000)/1000;
      const type=document.querySelector('#modelType').value;
      const isChair=type==='chair',isCorner=type==='corner';
      dimensionOverlay.querySelector('.dimension-width').textContent='العرض: '+Math.round(w*1000)+' مم';
      dimensionOverlay.querySelector('.dimension-depth').textContent='العمق: '+Math.round(d*1000)+' مم';
      dimensionOverlay.querySelector('.dimension-height').textContent='الارتفاع: '+Math.round(h*1000)+' مم';
      const makeTexture=(kind)=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
        const ctx=canvas.getContext('2d');
        if(kind==='wood'){
          ctx.fillStyle='#a47a52';ctx.fillRect(0,0,256,256);
          for(let i=0;i<95;i++){ctx.strokeStyle=i%3?'rgba(65,35,15,.12)':'rgba(235,190,130,.2)';ctx.lineWidth=1+(i%4);ctx.beginPath();const y=i*2.8;ctx.moveTo(0,y);ctx.bezierCurveTo(65,y-8,150,y+9,256,y-3);ctx.stroke();}
          for(let i=0;i<14;i++){ctx.strokeStyle='rgba(65,35,15,.12)';ctx.beginPath();ctx.ellipse((i*47)%256,(i*71)%256,10,3,0,0,Math.PI*2);ctx.stroke();}
        }else{
          ctx.fillStyle='#aaa';ctx.fillRect(0,0,256,256);
          const step=kind==='boucle'?5:kind==='velvet'?3:4;
          for(let y=0;y<256;y+=step)for(let x=0;x<256;x+=step){
            const v=110+Math.floor(Math.random()*90);ctx.fillStyle='rgba('+v+','+v+','+v+','+(kind==='velvet'?.22:.32)+')';
            if(kind==='boucle'){ctx.beginPath();ctx.arc(x+2,y+2,1.6,0,Math.PI*2);ctx.fill();}
            else ctx.fillRect(x,y,kind==='linen'?1:2,kind==='linen'?3:1);
          }
        }
        const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(kind==='wood'?2:3,kind==='wood'?1:3);return tex;
      };
      const woodKind=document.querySelector('#modelWood').value;
      const boardKind=document.querySelector('#modelBoard').value;
      const foamKind=document.querySelector('#modelFoam').value;
      const fabricKind=document.querySelector('#modelFabric').value;
      const woodTexture=makeTexture('wood'),fabricTexture=makeTexture(fabricKind==='boucle'?'boucle':fabricKind==='velvet'?'velvet':'fabric');
      const woodColors={beech:'#a8794d',pine:'#c39a69',plywood:'#b58a5b'};
      const cloth=new THREE.MeshStandardMaterial({color:document.querySelector('#modelColor').value,map:fabricTexture,bumpMap:fabricTexture,bumpScale:fabricKind==='boucle'?.018:.006,roughness:fabricKind==='leather'?.48:fabricKind==='velvet'?.88:.96,metalness:0});
      const wood=new THREE.MeshStandardMaterial({color:woodColors[woodKind],map:woodTexture,bumpMap:woodTexture,bumpScale:.025,roughness:.78});
      const board=new THREE.MeshStandardMaterial({color:boardKind==='mdf18'?'#987653':'#c39a72',map:woodTexture,roughness:.86});
      const foamColor=foamKind==='firm45'?'#d8c4a6':'#e5d6bc';
      const foam=new THREE.MeshStandardMaterial({color:foamColor,roughness:1});
      const metal=new THREE.MeshStandardMaterial({color:'#929b9c',metalness:.72,roughness:.28});
      const add=(name,x,y,z,sx,sy,sz,mat,rounded=true)=>{
        const min=Math.min(sx,sy,sz),radius=rounded?Math.max(.003,Math.min(.045,min*.16)):0;
        const geometry=rounded?new RoundedBoxGeometry(sx,sy,sz,3,radius):new THREE.BoxGeometry(sx,sy,sz);
        const m=new THREE.Mesh(geometry,mat.clone());m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;
        m.userData.base=m.position.clone();m.userData.baseSize=new THREE.Vector3(sx,sy,sz);m.userData.baseScale=m.scale.clone();m.userData.partName=name;m.userData.partSize=new THREE.Vector3(sx,sy,sz);m.userData.originalEmissive=m.material.emissive?m.material.emissive.getHex():0x000000;
        group.add(m);parts.push(m);return m;
      };
      const legH=Math.max(.11,h*.13),seatY=Math.max(.34,h*.43),seatH=Math.max(.12,h*.17),armW=isChair?.12:.16;
      const railH=.075,railT=.04,frameY=legH+railH/2;
      // Structural timber frame: solid rails, cross braces and plywood deck, all dimensioned in metres.
      add('عارضة خشب أمامية 40×80 مم',0,frameY,d*.39,w*.9,.08,.04,wood,false);
      add('عارضة خشب خلفية 40×80 مم',0,frameY,-d*.39,w*.9,.08,.04,wood,false);
      add('عارضة جانبية يسرى 40×80 مم',-w*.44,frameY,0,.04,.08,d*.78,wood,false);
      add('عارضة جانبية يمنى 40×80 مم',w*.44,frameY,0,.04,.08,d*.78,wood,false);
      for(let i=1;i<=2;i++)add('دعامة عرضية للهيكل',0,frameY,(i-1.5)*d*.34,.04,.07,.68*d,wood,false);
      const boardThickness=boardKind==='plywood15'?.015:.018;
      add('لوح قاعدة '+(boardKind==='mdf18'?'MDF':'كونتر')+' '+Math.round(boardThickness*1000)+' مم',0,legH+railH+.012,0,w*.84,boardThickness,d*.72,board,false);
      // Upholstery support system beneath the foam.
      const support=document.querySelector('#modelSupport').value;
      if(support==='webbing'||support==='spring'){
        for(let i=0;i<6;i++)add('حزام تنجيد عرضي',-w*.34+i*w*.136,legH+railH+.035,0,.025,.012,d*.66,metal,false);
        if(support==='spring')for(let i=0;i<5;i++){
          const x=-w*.3+i*w*.15;
          const pts=[];for(let j=0;j<=20;j++){const t=j/20;pts.push(new THREE.Vector3(x+Math.sin(t*Math.PI*6)*.018,legH+railH+.07+t*.075,-d*.27+t*d*.54));}
          const curve=new THREE.CatmullRomCurve3(pts);const coil=new THREE.Mesh(new THREE.TubeGeometry(curve,48,.006,6,false),metal.clone());coil.userData.partName='ياي معدني';coil.userData.base=coil.position.clone();coil.userData.baseSize=new THREE.Vector3(.012,.012,.012);coil.userData.baseScale=coil.scale.clone();coil.userData.partSize=coil.userData.baseSize.clone();coil.userData.originalEmissive=0;group.add(coil);parts.push(coil);
        }
      }
      // Legs: tapered, slightly splayed wooden feet.
      for(const x of [-1,1])for(const z of [-1,1]){
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(.025,.038,legH,12),wood.clone());leg.position.set(x*w*.39,legH/2,z*d*.34);leg.rotation.z=x*.09;leg.castShadow=true;leg.userData.partName='رجل خشب';leg.userData.base=leg.position.clone();leg.userData.baseSize=new THREE.Vector3(.07,legH,.07);leg.userData.baseScale=leg.scale.clone();leg.userData.partSize=leg.userData.baseSize.clone();leg.userData.originalEmissive=0;group.add(leg);parts.push(leg);
      }
      // Foam deck and separate upholstered seat cushions.
      add('طبقة إسفنج أساسية',0,seatY-.06,0,w*.83,.12,d*.7,foam);
      const cushionCount=isChair?1:(isCorner?3:Math.max(2,Math.min(3,Math.round(w/0.75))));
      for(let i=0;i<cushionCount;i++){
        const cw=isCorner?w*.28:w*.82/cushionCount;
        const cx=isCorner?-w*.27+i*cw*1.02:(i-(cushionCount-1)/2)*cw;
        add('وسادة مقعد مكسوة قماش '+(i+1),cx,seatY+.035,0,cw*.96,seatH,d*.68,cloth);
      }
      // Back cushions are plump and softly rounded, not hard cuboids.
      const backCount=isChair?1:(isCorner?3:cushionCount);
      for(let i=0;i<backCount;i++){
        const bw=isCorner?w*.27:w*.84/backCount;
        const bx=isCorner?-w*.27+i*bw*1.02:(i-(backCount-1)/2)*bw;
        const pillow=add('مخدة ظهر محشوة '+(i+1),bx,seatY+seatH*.78,-d*.32,bw*.94,h*.29,.19,cloth);
        pillow.rotation.x=-.1;
      }
      // Arms are upholstered over timber cores; add inner/outer padding separately.
      for(const side of [-1,1]){
        const x=side*(w*.43);
        add(side<0?'هيكل ذراع خشبي أيسر':'هيكل ذراع خشبي أيمن',x,seatY*.55,0,armW*.72,seatY+ h*.12,d*.72,wood);
        add(side<0?'حشوة الذراع اليسرى':'حشوة الذراع اليمنى',x,seatY*.68,0,armW,seatY+h*.16,d*.78,foam);
        add(side<0?'كسوة قماش الذراع اليسرى':'كسوة قماش الذراع اليمنى',x,seatY*.68,0,armW*.94,seatY+h*.15,d*.76,cloth);
      }
      if(isCorner){
        add('امتداد قاعدة الزاوية',w*.27,frameY,d*.18,w*.42,.08,d*.43,wood,false);
        add('لوح كونتر امتداد الزاوية',w*.27,legH+railH+.012,d*.18,w*.4,boardThickness,d*.4,board,false);
        add('وسادة مقعد امتداد الزاوية',w*.27,seatY+.035,d*.18,w*.4,seatH,d*.4,cloth);
        add('وسادة ظهر امتداد الزاوية',w*.27,seatY+seatH*.78,d*.02,w*.4,h*.29,.18,cloth);
      }
      separated=false;
      const list=document.querySelector('#modelPartsList');
      if(list) list.innerHTML=parts.map((p,i)=>'<button type="button" class="model-part-choice" data-part-index="'+i+'" aria-pressed="false"><b>'+(i+1)+'</b> '+esc(p.userData.partName)+'</button>').join('');
      list?.querySelectorAll('[data-part-index]').forEach(button=>button.addEventListener('click',()=>selectPart(Number(button.dataset.partIndex))));
      selectedPartIndex=-1;
      const editor=document.querySelector('#modelPartEditor');
      if(editor) editor.innerHTML='<p>اختر أحد المكونات لعرض أبعاده وتعديل موضعه.</p>';
      request();
    };
    let selectedPartIndex=-1;
    const clamp=(id,min,max)=>{const el=document.querySelector('#'+id);const n=Number(el.value);const v=Math.round(Math.max(min,Math.min(max,Number.isFinite(n)?n:min)));el.value=v;return v;};
    const selectPart=index=>{
      const part=parts[index]; if(!part) return;
      selectedPartIndex=index;
      parts.forEach((item,i)=>{if(item.material?.emissive)item.material.emissive.setHex(i===index?0x1b7772:item.userData.originalEmissive);});
      document.querySelectorAll('.model-part-choice').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      const editor=document.querySelector('#modelPartEditor');
      const pos=part.position, size=part.userData.partSize;
      editor.innerHTML=`<strong>${esc(part.userData.partName)}</strong><div class="model-part-edit-grid">
        <label>الموضع X <input data-part-value="x" type="number" step="1" value="${Math.round(pos.x*1000)}"></label>
        <label>الموضع Y <input data-part-value="y" type="number" step="1" value="${Math.round(pos.y*1000)}"></label>
        <label>الموضع Z <input data-part-value="z" type="number" step="1" value="${Math.round(pos.z*1000)}"></label>
        <label>العرض X <input data-part-value="sx" type="number" min="10" step="1" value="${Math.max(10,Math.round(size.x*1000))}"></label>
        <label>الارتفاع Y <input data-part-value="sy" type="number" min="10" step="1" value="${Math.max(10,Math.round(size.y*1000))}"></label>
        <label>العمق Z <input data-part-value="sz" type="number" min="10" step="1" value="${Math.max(10,Math.round(size.z*1000))}"></label>
      </div><small>جميع القيم بالملليمتر. التعديلات تخص هذا المكوّن فقط.</small>`;
      editor.querySelectorAll('[data-part-value]').forEach(input=>input.addEventListener('change',()=>{
        const value=Math.max(input.dataset.partValue==='x'||input.dataset.partValue==='y'||input.dataset.partValue==='z'?-5000:10,Math.min(5000,Number(input.value)||0));
        input.value=value;
        const key=input.dataset.partValue;
        if(key==='x'||key==='y'||key==='z'){
          part.position[key==='x'?'x':key==='y'?'y':'z']=value/1000;
          part.userData.base=part.position.clone();
        }else{
          const axis=key==='sx'?'x':key==='sy'?'y':'z';
          part.userData.partSize[axis]=value/1000;
          part.scale[axis]=part.userData.partSize[axis]/part.userData.baseSize[axis];
          part.userData.baseScale=part.scale.clone();
        }
        request();
      }));
    };
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let pointerStart=null;
    renderer.domElement.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
    renderer.domElement.addEventListener('pointerup',event=>{
      if(!pointerStart)return;
      const moved=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);
      pointerStart=null;
      if(moved>5)return;
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
      pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects(parts,false)[0];
      if(hit){const index=parts.indexOf(hit.object);if(index>=0)selectPart(index);}
    });
    document.querySelector('#applyModel').onclick=build;
    document.querySelector('#modelType').onchange=()=>{const type=document.querySelector('#modelType').value;const chair=type==='chair';document.querySelector('#dimW').value=chair?850:2200;document.querySelector('#dimD').value=type==='corner'?1700:850;document.querySelector('#dimH').value=chair?900:850;document.querySelector('#modelName').value=chair?'كرسي مفرد':type==='corner'?'كنبة زاوية L':'كنبة مستقيمة';build();};
    ['#modelColor','#modelWood','#modelBoard','#modelFoam','#modelFabric','#modelSupport'].forEach(selector=>document.querySelector(selector).onchange=build);
    document.querySelector('#explodeModel').onclick=()=>{if(separated)return;parts.forEach((p,i)=>{p.position.y+=.12+(i%3)*.08;p.position.x+=(i%2?1:-1)*.12;});separated=true;request();};
    document.querySelector('#resetModel').onclick=()=>{parts.forEach(p=>{p.position.copy(p.userData.base);p.scale.copy(p.userData.baseScale);});separated=false;request();};
    const applySavedDesign=design=>{
      if(!design || !design.dimensions_mm) return;
      document.querySelector('#modelName').value=design.name || 'تصميم محفوظ';
      document.querySelector('#modelType').value=design.type || 'sofa';
      document.querySelector('#dimW').value=design.dimensions_mm.width || 2200;
      document.querySelector('#dimD').value=design.dimensions_mm.depth || 900;
      document.querySelector('#dimH').value=design.dimensions_mm.height || 850;
      if(design.fabric_color) document.querySelector('#modelColor').value=design.fabric_color;
      build();
      if(Array.isArray(design.parts)){
        design.parts.forEach((saved,index)=>{
          const part=parts[index]; if(!part) return;
          if(Array.isArray(saved.position)&&saved.position.length===3){
            part.position.fromArray(saved.position);
            part.userData.base=part.position.clone();
          }
          if(Array.isArray(saved.size)&&saved.size.length===3){
            part.userData.partSize.fromArray(saved.size);
            part.scale.set(
              part.userData.partSize.x/part.userData.baseSize.x,
              part.userData.partSize.y/part.userData.baseSize.y,
              part.userData.partSize.z/part.userData.baseSize.z
            );
            part.userData.baseScale=part.scale.clone();
          }
        });
        request();
      }
    };
    const loadSelectedDesign=async()=>{
      const projectId=projectSelect.value;
      if(!projectId) return;
      try{
        const {data,error}=await supabase.from('projects').select('design_data').eq('id',projectId).eq('owner_id',currentUser.id).single();
        if(error) throw error;
        const design=data?.design_data?.furniture_model;
        if(design?.dimensions_mm) applySavedDesign(design);
      }catch(error){ alert(error?.message||'تعذر تحميل التصميم المحفوظ.'); }
    };
    projectSelect.onchange=loadSelectedDesign;
    document.querySelector('#loadSavedModel').onclick=loadSelectedDesign;
    document.querySelector('#saveModel').onclick=async()=>{
      const button=document.querySelector('#saveModel');
      const projectId=projectSelect.value;
      if(!projectId){alert('اختر المشروع أولاً');return;}
      button.disabled=true;
      const design={
        name:document.querySelector('#modelName').value.trim()||'تصميم جديد',
        type:document.querySelector('#modelType').value,
        dimensions_mm:{width:clamp('dimW',100,5000),depth:clamp('dimD',100,3000),height:clamp('dimH',100,3000)},
        fabric_color:document.querySelector('#modelColor').value,
        materials:{wood:document.querySelector('#modelWood').value,board:document.querySelector('#modelBoard').value,foam:document.querySelector('#modelFoam').value,fabric:document.querySelector('#modelFabric').value,support:document.querySelector('#modelSupport').value},
        parts:parts.map(p=>({name:p.userData.partName,position:p.userData.base.toArray(),size:p.userData.partSize.toArray()})),
        status:'concept_not_for_manufacturing'
      };
      try {
        const {data:project,error:readError}=await supabase.from('projects').select('design_data').eq('id',projectId).eq('owner_id',currentUser.id).single();
        if(readError) throw readError;
        const {error}=await supabase.from('projects').update({design_data:{...(project.design_data||{}),furniture_model:design}}).eq('id',projectId).eq('owner_id',currentUser.id);
        if(error) throw error;
        alert('تم حفظ بيانات التصميم على المشروع.');
      } catch(error) {
        alert(error?.message||'تعذر حفظ التصميم. حاول مرة أخرى.');
      } finally {
        button.disabled=false;
      }
    };
    build();resize();
    sceneCleanup=()=>{
      observer.disconnect();
      cancelAnimationFrame(raf);
      controls.dispose();
      scene.traverse(object=>{
        if(object.geometry) object.geometry.dispose();
        if(object.material){
          const materials=Array.isArray(object.material)?object.material:[object.material];
          materials.forEach(material=>{
            Object.values(material).forEach(value=>{if(value?.isTexture)value.dispose();});
            material.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  } catch(error) {host.innerHTML='<div class="scene-fallback">تعذّر تشغيل العرض ثلاثي الأبعاد. تأكد من دعم WebGL في المتصفح.</div>';console.error(error);}
}
