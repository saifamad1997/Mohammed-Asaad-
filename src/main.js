import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { supabase, supabaseConfigured } from './lib/supabase.js';
import { initAuthGate } from './lib/auth-gate.js';
import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
<div class="app">
  <aside class="sidebar">
    <div class="brand"><strong>محمد أسعد للتنجيد</strong><span>نظام التصميم والتصنيع</span></div>
    <div>
      <div class="nav-label">مسار العمل</div>
      <nav class="nav" aria-label="مسار العمل">
        <button disabled title="قريباً">لوحة المعلومات</button>
        <button disabled title="قريباً">العملاء</button>
        <button disabled title="قريباً">المشاريع</button>
        <button class="active" aria-current="page">مكتب الموديل 3D</button>
        <button disabled title="قريباً">موارد المستودع</button>
        <button disabled title="قريباً">أوامر التصنيع</button>
        <button disabled title="قريباً">الإنتاج</button>
        <button disabled title="قريباً">التسليم</button>
      </nav>
    </div>
  </aside>
  <main class="main">
    <header class="top">
      <div><div class="eyebrow">التصميم الهندسي للأثاث</div><h1>مكتب الموديل ثلاثي الأبعاد</h1></div>
      <div id="backendStatus" class="status" data-state="warn" role="status">جارٍ فحص اتصال قاعدة البيانات…</div>
    </header>
    <section class="workspace">
      <div class="panel">
        <h2>خصائص القطعة</h2>
        <div class="field"><label for="piece">نوع الأثاث</label><select id="piece"><option value="sofa">كنبة مستقيمة</option><option value="chair">كرسي مفرد</option></select></div>
        <div class="field"><label for="designName">اسم التصميم</label><input id="designName" value="كنبة تجريبية" maxlength="80" /></div>
        <div class="field"><label>الأبعاد الكلية (ملم)</label><div class="dimensions">
          <div><input id="width" type="number" min="100" max="5000" value="2200" aria-label="العرض"><span class="unit">العرض</span></div>
          <div><input id="depth" type="number" min="100" max="3000" value="900" aria-label="العمق"><span class="unit">العمق</span></div>
          <div><input id="height" type="number" min="100" max="3000" value="850" aria-label="الارتفاع"><span class="unit">الارتفاع</span></div>
        </div></div>
        <div class="field"><label for="fabric">لون القماش</label><select id="fabric"><option value="#71847e">أخضر رمادي</option><option value="#9a806b">بني فاتح</option><option value="#68758b">أزرق رمادي</option><option value="#b5aaa0">بيج</option></select></div>
        <div class="actions"><button class="btn primary" id="update" type="button">تحديث المجسم</button><button class="btn" id="explode" type="button">فصل الأجزاء</button><button class="btn" id="reset" type="button">إرجاع التجميع</button></div>
        <div class="notice">هذه معاينة هندسية أولية. الأبعاد المعروضة نسبية للتجربة وليست قياسات تصنيع معتمدة أو قائمة قص للورشة.</div>
      </div>
      <div class="panel viewer">
        <div class="viewer-head"><h2>المعاينة ثلاثية الأبعاد</h2><span>اسحب للتدوير · قرّب بإصبعين أو عجلة الفأرة</span></div>
        <div id="scene" aria-label="معاينة ثلاثية الأبعاد للأثاث"></div>
        <div class="legend"><span><i class="dot"></i> الهيكل</span><span><i class="dot" style="background:#b4a18b"></i> الوسائد</span><span><i class="dot" style="background:#8799a7"></i> الأرجل</span></div>
      </div>
    </section>
    <section class="bottom-grid">
      <div class="metric"><span>وحدة القياس</span><strong>ملليمتر</strong></div>
      <div class="metric"><span>حالة التصميم</span><strong>مسودة تجريبية</strong></div>
      <div class="metric"><span>الاعتماد للتصنيع</span><strong>غير معتمد</strong></div>
    </section>
  </main>
</div>`;

initAuthGate(supabase);

async function checkBackend() {
  const badge = document.querySelector('#backendStatus');
  if (!supabaseConfigured || !supabase) {
    badge.textContent = 'إعدادات Supabase ناقصة';
    badge.dataset.state = 'warn';
    return;
  }
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      badge.textContent = 'يلزم تسجيل الدخول';
      badge.dataset.state = 'warn';
      return;
    }
    const { error: dbError } = await supabase.from('projects').select('id').limit(1);
    if (dbError) throw dbError;
    badge.textContent = 'قاعدة البيانات متصلة';
    badge.dataset.state = 'ok';
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    const message = String(error?.message || '');
    const isDatabasePermissionError =
      error?.code === '42501' ||
      /permission denied for table projects/i.test(message);
    if (isDatabasePermissionError) {
      badge.textContent = 'الاتصال بقاعدة البيانات يعمل · يلزم تسجيل الدخول';
      badge.dataset.state = 'warn';
    } else {
      badge.textContent = 'تعذر الاتصال بقاعدة البيانات';
      badge.dataset.state = 'warn';
    }
  }
}
checkBackend();
window.addEventListener('supabase-auth-change', checkBackend);

const host = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#14232c');
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(4.3, 3.1, 5.2);

let renderer = null;
let controls = null;
let rafId = 0;
function requestRender() {
  if (renderer && !rafId) rafId = requestAnimationFrame(renderFrame);
}
function renderFrame() {
  rafId = 0;
  if (!renderer) return;
  controls?.update();
  renderer.render(scene, camera);
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 0.55, 0);
  controls.addEventListener('change', requestRender);
} catch (error) {
  console.error('WebGL initialization failed:', error);
  host.innerHTML = '<div class="scene-fallback">تعذّر تشغيل العرض ثلاثي الأبعاد على هذا المتصفح أو الجهاز.<br>يمكنك تجربة متصفح حديث يدعم WebGL.</div>';
}

scene.add(new THREE.HemisphereLight(0xddeeff, 0x27313a, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: '#182a33', roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.035;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(10, 20, 0x35505b, 0x263c46);
grid.position.y = -0.02;
scene.add(grid);

const model = new THREE.Group();
scene.add(model);
let separated = false;
let materials = [];
const material = (color, roughness = 0.72) => {
  const item = new THREE.MeshStandardMaterial({ color, roughness });
  materials.push(item);
  return item;
};

function clearModel() {
  for (const child of [...model.children]) {
    model.remove(child);
    child.geometry?.dispose();
  }
  materials.forEach((item) => item.dispose());
  materials = [];
}

const LIMITS = { width: [100, 5000], depth: [100, 3000], height: [100, 3000] };
const DEFAULTS = {
  sofa: { width: 2200, depth: 900, height: 850 },
  chair: { width: 850, depth: 850, height: 900 }
};
function readDimension(id) {
  const input = document.querySelector('#' + id);
  const [min, max] = LIMITS[id];
  const raw = input.value.trim() === '' ? NaN : Number(input.value);
  const fallback = DEFAULTS[document.querySelector('#piece').value][id];
  const value = Math.round(Math.min(max, Math.max(min, Number.isFinite(raw) ? raw : fallback)));
  input.value = String(value);
  return value;
}
function addBlock(parent, width, height, depth, x, y, z, mat, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.base = mesh.position.clone();
  mesh.userData.partName = name;
  parent.add(mesh);
  return mesh;
}

function buildModel() {
  clearModel();
  const width = readDimension('width') / 1000;
  const depth = readDimension('depth') / 1000;
  const height = readDimension('height') / 1000;
  const fabric = document.querySelector('#fabric').value;
  const wood = material('#4d4035');
  const cloth = material(fabric);
  const cushion = material('#b8a48f');
  const feet = material('#596b76', 0.35);
  const seatY = Math.max(0.28, height * 0.38);
  const seatH = Math.max(0.13, height * 0.19);
  const backH = Math.max(0.3, height * 0.48);

  addBlock(model, width * 0.94, 0.16, depth * 0.88, 0, 0.18, 0, wood, 'قاعدة الهيكل');
  addBlock(model, width * 0.9, seatH, depth * 0.78, 0, seatY, 0, cloth, 'وسادة المقعد');
  addBlock(model, width * 0.94, backH, 0.16, 0, seatY + backH * 0.47, -depth * 0.38, cloth, 'مسند الظهر');
  addBlock(model, 0.16, seatY + backH * 0.2, depth * 0.82, -width * 0.43, seatY * 0.48, 0, cloth, 'ذراع أيسر');
  addBlock(model, 0.16, seatY + backH * 0.2, depth * 0.82, width * 0.43, seatY * 0.48, 0, cloth, 'ذراع أيمن');
  for (let index = 0; index < 3; index += 1) {
    const x = (index - 1) * width * 0.29;
    addBlock(model, width * 0.27, 0.12, depth * 0.62, x, seatY + 0.1, 0.035, cushion, 'وسادة جلوس ' + (index + 1));
  }
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      addBlock(model, 0.065, 0.18, 0.065, xSign * width * 0.4, 0.09, zSign * depth * 0.38, feet, 'رجل');
    }
  }
  separated = false;
  requestRender();
}

function resizeScene() {
  if (!renderer) return;
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  requestRender();
}
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resizeScene).observe(host);
} else {
  window.addEventListener('resize', resizeScene, { passive: true });
}
resizeScene();

document.querySelector('#update').addEventListener('click', buildModel);
document.querySelector('#piece').addEventListener('change', () => {
  const isChair = document.querySelector('#piece').value === 'chair';
  const dimensions = DEFAULTS[isChair ? 'chair' : 'sofa'];
  for (const [id, value] of Object.entries(dimensions)) document.querySelector('#' + id).value = String(value);
  document.querySelector('#designName').value = isChair ? 'كرسي تجريبي' : 'كنبة تجريبية';
  buildModel();
});
document.querySelector('#fabric').addEventListener('change', buildModel);
['width', 'depth', 'height'].forEach((id) => {
  document.querySelector('#' + id).addEventListener('change', () => readDimension(id));
});
document.querySelector('#explode').addEventListener('click', () => {
  if (separated) return;
  model.children.forEach((part, index) => {
    part.position.y += 0.12 + (index % 3) * 0.08;
    part.position.x += (index % 2 ? 1 : -1) * 0.12;
  });
  separated = true;
  requestRender();
});
document.querySelector('#reset').addEventListener('click', () => {
  model.children.forEach((part) => part.position.copy(part.userData.base));
  separated = false;
  requestRender();
});
buildModel();
