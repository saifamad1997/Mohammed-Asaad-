import { supabase, supabaseConfigured } from './lib/supabase.js';
import { initAuthGate } from './lib/auth-gate.js';
import './style.css';
import { renderDesignAssistant } from './cad/design-assistant.js';
import './cad/design-assistant.css';
import { mountManufacturingCatalog } from './cad/manufacturing-catalog.js';
import { renderCadWorkspace } from './cad/cad-workspace.js';
import './cad/cad-workspace.css';
import './cad/manufacturing-catalog.css';

window.__maSupabase = supabase;
const app = document.querySelector('#app');
const navItems = [
  ['dashboard','لوحة المعلومات','⌂'],['designAssistant','مساعد التصميم الذكي','✧'],['customers','العملاء','♙'],['projects','المشاريع','▦'],
['sketchup','SketchUp','◩'],['library','مكتبة الموديلات 3D','▣'],['surveys','قياسات المواقع','⌖'],['materials','المستودعات والمواد','▤'],
  ['cad','CAD الهندسي','▱'],['manufacturing','التصميم الهندسي والتصنيع','▧'],['orders','أوامر التصنيع','⚒'],['production','متابعة الإنتاج','◷'],['delivery','التسليم','✓'],
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
      <div class="top-actions"><span class="user-pill" id="userLabel">جارٍ التحقق…</span><button class="btn btn-primary" id="signIn" type="button" hidden>تسجيل الدخول</button><button class="btn btn-primary install-app-btn" id="installApp" type="button">تثبيت التطبيق</button><button class="btn btn-quiet" id="signOut" type="button" hidden>تسجيل الخروج</button></div>
    </header>
    <p class="auth-action-feedback" id="authActionFeedback" role="status" aria-live="polite"></p>
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
document.querySelector('#signIn').addEventListener('click', () => {
  window.dispatchEvent(new Event('open-auth-gate'));
});
document.querySelector('#signOut').addEventListener('click', async () => {
  if (!supabase || !currentUser) return;
  const button = document.querySelector('#signOut');
  const feedback = document.querySelector('#authActionFeedback');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'جارٍ تسجيل الخروج…';
  feedback.textContent = '';
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentUser = null;
    updateUser();
    navigate(currentPage);
    feedback.textContent = 'تم تسجيل الخروج بأمان.';
  } catch (error) {
    feedback.textContent = error?.message || 'تعذر تسجيل الخروج. حاول مرة أخرى.';
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
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
  updateUser();
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
    navigate(currentPage);
  });
}
function updateUser() {
  const label = document.querySelector('#userLabel');
  const signIn = document.querySelector('#signIn');
  const signOut = document.querySelector('#signOut');
  label.textContent = currentUser?.email || (supabaseConfigured ? 'زائر — الدخول مطلوب' : 'إعدادات الربط ناقصة');
  signIn.hidden = Boolean(currentUser) || !supabaseConfigured;
  signOut.hidden = !currentUser;
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
    dashboard: renderDashboard, designAssistant: renderDesignAssistant, cad: renderCadWorkspace, customers: renderCustomers, projects: renderProjects,
    sketchup: renderSketchup, library: renderFurnitureLibrary, manufacturing: renderManufacturing, surveys: renderSurveys, materials: renderMaterials,
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
        ${[['customers','العملاء','تسجيل بيانات العميل'],['projects','المشاريع','فتح مشروع ومتابعته'],['surveys','القياسات','تسجيل أبعاد الموقع'],['materials','المستودعات','إدارة المخزون والمواد'],['orders','التصنيع','إصدار أمر عمل']].map(([id,title,desc])=>`<button class="workflow-tile" data-go="${id}"><strong>${title}</strong><span>${desc}</span><b>فتح القسم ←</b></button>`).join('')}
      </div></section>
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

async function renderManufacturing() {
  setContent('كتالوج التصنيع', '<div id="manufacturingRoot"></div>');
  const root = document.querySelector('#manufacturingRoot');
  const cleanup = await mountManufacturingCatalog(root, { supabase, user: currentUser });
  if (currentPage === 'manufacturing') sceneCleanup = cleanup;
}

function renderFurnitureLibrary() {
  setContent('مكتبة الموديلات 3D', `
    <section class="section-card">
      <div class="section-heading">
        <div><h2>مكتبة التصاميم والنماذج ثلاثية الأبعاد</h2><p>نماذج مرخّصة CC0 ومفاهيم أصلية قابلة للتخصيص البصري.</p></div>
        <a class="btn btn-primary" href="/library-3d.html" target="_blank" rel="noopener noreferrer">فتح المكتبة في نافذة مستقلة ↗</a>
      </div>
      <iframe title="مكتبة موديلات الأثاث ثلاثية الأبعاد" src="/library-3d.html" loading="lazy" style="width:100%;height:calc(100vh - 245px);min-height:720px;border:1px solid #29434c;border-radius:12px;background:#f5f8fb"></iframe>
    </section>
  `);
}
async function renderSketchup() {
  try {
    const [projects, surveys] = await Promise.all([
      rows('projects','id,project_no,title,furniture_type,status,description,design_data,created_at'),
      rows('room_surveys','id,project_id,room_name,length_cm,width_cm,height_cm,notes')
    ]);
    const statusMap = {draft:'مسودة',design:'قيد التصميم',approved:'معتمد',manufacturing:'قيد التصنيع',completed:'مكتمل',cancelled:'ملغي'};
    const cards = projects.map(project => {
      const projectSurveys = surveys.filter(s => s.project_id === project.id);
      return `<article class="sketchup-project-card">
        <div class="sketchup-project-head"><div><span class="eyebrow">المشروع #${esc(project.project_no)}</span><h3>${esc(project.title)}</h3></div><span class="status-tag">${esc(statusMap[project.status] || project.status || '—')}</span></div>
        <p>${esc(project.furniture_type || 'نوع الأثاث غير محدد')} · ${projectSurveys.length} سجل قياسات</p>
        <div class="sketchup-actions">
          <button class="btn btn-primary" type="button" data-sketchup-open="${esc(project.id)}">فتح SketchUp Web</button>
          <button class="btn" type="button" data-sketchup-export="${esc(project.id)}">تصدير بيانات المشروع</button>
        </div>
      </article>`;
    }).join('');
    setContent('SketchUp', `
      <section class="sketchup-intro">
        <div><span class="welcome-kicker">مساحة التصميم ثلاثي الأبعاد الخارجية</span><h2>اربط ملفات SketchUp بمشاريع الشركة</h2>
        <p>للكمبيوتر: ثبّت إضافة جسر الشركة داخل SketchUp Desktop ثم استورد ملف JSON لتوليد مكونات ألواح منفصلة. للويب: افتح ملفات SKP أو صيغ 3D المدعومة حسب اشتراكك.</p></div>
        <div class="sketchup-actions">
          <a class="btn btn-primary" href="https://app.sketchup.com/app" target="_blank" rel="noopener noreferrer">تشغيل SketchUp Web ↗</a>
          <a class="btn" href="https://github.com/saifamad1997/Mohammed-Asaad-/tree/feature/sketchup-workflow/sketchup-extension" target="_blank" rel="noopener noreferrer">ملفات إضافة الكمبيوتر ↗</a>
        </div>
      </section>
      <section class="notice-card"><strong>حدود الإصدار الأول</strong><p>إضافة الكمبيوتر تنشئ حالياً مكونات منفصلة من أبعاد قائمة القص وسماكة اللوح. لا تنشئ بعد خزانة مركبة أو مواقع ثقوب ومفصلات وسكك؛ يلزم إضافة بيانات التموضع والتجميع لكل نوع أثاث قبل اعتماد رسومات الورشة. ملفات SKP لا تُرفع تلقائياً إلى قاعدة بيانات الشركة.</p></section>
      <section class="section-card">
        <div class="section-heading"><div><h2>مشاريع الشركة</h2><p>اختر المشروع لتجهيز بياناته وقياساته قبل العمل عليه في SketchUp.</p></div></div>
        <div class="sketchup-project-grid">${cards || '<div class="empty-state"><h3>لا توجد مشاريع بعد</h3><p>أنشئ مشروعاً أولاً من قسم المشاريع ليظهر هنا.</p></div>'}</div>
      </section>
      <section class="notice-card"><strong>ما الذي يصدره النظام؟</strong><p>ملف JSON يحتوي بيانات المشروع وسجلات القياسات المسجلة. هو ورقة تسليم معلوماتية للمصمم، وليس ملف SKP أو مخطط تصنيع نهائياً.</p></section>
    `);
    document.querySelectorAll('[data-sketchup-open]').forEach(button => button.addEventListener('click', () => {
      window.open('https://app.sketchup.com/app', '_blank', 'noopener,noreferrer');
    }));
    document.querySelectorAll('[data-sketchup-export]').forEach(button => button.addEventListener('click', () => {
      const project = projects.find(p => p.id === button.dataset.sketchupExport);
      if (!project) return;
      const payload = {
        company: 'محمد أسعد للتنجيد والتصميم الهندسي',
        export_type: 'project_handoff_brief',
        note: 'بيانات مرجعية للمصمم؛ ليست ملف SketchUp ولا تتضمن أبعاداً غير مسجلة.',
        exported_at: new Date().toISOString(),
        project: {
          project_no: project.project_no,
          title: project.title,
          furniture_type: project.furniture_type,
          status: statusMap[project.status] || project.status,
          description: project.description,
          design_data: project.design_data || {},
          manufacturing_catalog: project.design_data?.manufacturing_catalog || null
        },
        surveys: surveys.filter(s => s.project_id === project.id).map(s => ({
          room_name: s.room_name,
          length_cm: s.length_cm,
          width_cm: s.width_cm,
          height_cm: s.height_cm,
          notes: s.notes
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project-${project.project_no || 'brief'}-sketchup-brief.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }));
  } catch(error) { showError(error); }
}
