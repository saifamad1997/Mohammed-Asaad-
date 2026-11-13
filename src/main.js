import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

document.querySelector('#app').innerHTML = `
<div class="app">
  <aside class="sidebar">
    <div class="brand"><strong>محمد أسعد للتنجيد</strong><span>نظام التصميم والتصنيع</span></div>
    <div><div class="nav-label">مسار العمل</div><nav class="nav">
      <button>لوحة المعلومات</button><button>العملاء</button><button>المشاريع</button>
      <button class="active">مكتب الموديل 3D</button><button>موارد المستودع</button>
      <button>أوامر التصنيع</button><button>الإنتاج</button><button>التسليم</button>
    </nav></div>
  </aside>
  <main class="main">
    <header class="top"><div><div class="eyebrow">التصميم الهندسي للأثاث</div><h1>مكتب الموديل ثلاثي الأبعاد</h1></div><div class="status">نسخة تطوير أولية</div></header>
    <section class="workspace">
      <div class="panel">
        <h2>خصائص القطعة</h2>
        <div class="field"><label for="piece">نوع الأثاث</label><select id="piece"><option value="sofa">كنبة مستقيمة</option><option value="chair">كرسي مفرد</option></select></div>
        <div class="field"><label>اسم التصميم</label><input id="designName" value="كنبة تجريبية" /></div>
        <div class="field"><label>الأبعاد الكلية (ملم)</label><div class="dimensions">
          <div><input id="width" type="number" min="100" max="5000" value="2200"><span class="unit">العرض</span></div>
          <div><input id="depth" type="number" min="100" max="3000" value="900"><span class="unit">العمق</span></div>
          <div><input id="height" type="number" min="100" max="3000" value="850"><span class="unit">الارتفاع</span></div>
        </div></div>
        <div class="field"><label for="fabric">لون القماش</label><select id="fabric"><option value="#71847e">أخضر رمادي</option><option value="#9a806b">بني فاتح</option><option value="#68758b">أزرق رمادي</option><option value="#b5aaa0">بيج</option></select></div>
        <div class="actions"><button class="btn primary" id="update">تحديث المجسم</button><button class="btn" id="explode">فصل الأجزاء</button><button class="btn" id="reset">إرجاع التجميع</button></div>
        <div class="notice">هذه معاينة هندسية أولية قابلة لتغيير الأبعاد وفصل مكونات المجسم. القياسات الحالية للعرض التجريبي فقط، وليست مخططات تصنيع معتمدة.</div>
      </div>
      <div class="panel viewer">
        <div class="viewer-head"><h2>المعاينة ثلاثية الأبعاد</h2><span>اسحب للتدوير · قرّب بإصبعين أو عجلة الفأرة</span></div>
        <div id="scene"></div>
        <div class="legend"><span><i class="dot"></i> الهيكل</span><span><i class="dot" style="background:#b4a18b"></i> الوسائد</span><span><i class="dot" style="background:#8799a7"></i> الأرجل</span></div>
      </div>
    </section>
    <section class="bottom-grid"><div class="metric"><span>وحدة القياس</span><strong>ملليمتر</strong></div><div class="metric"><span>حالة التصميم</span><strong>مسودة تجريبية</strong></div><div class="metric"><span>الاعتماد للتصنيع</span><strong>غير معتمد</strong></div></section>
  </main>
</div>`;

const host = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#14232c');
const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 100);
camera.position.set(4.3, 3.1, 5.2);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .07; controls.target.set(0, .55, 0);
scene.add(new THREE.HemisphereLight(0xddeeff, 0x27313a, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(4, 7, 5); key.castShadow = true; scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), new THREE.MeshStandardMaterial({color:'#182a33',roughness:.9}));
floor.rotation.x = -Math.PI/2; floor.position.y = -.035; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(10,20,0x35505b,0x263c46); grid.position.y = -.02; scene.add(grid);
const model = new THREE.Group(); scene.add(model);
let separated = false;
const mat = (color, roughness=.72) => new THREE.MeshStandardMaterial({color,roughness});
function block(parent,w,h,d,x,y,z,material,name){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.base=m.position.clone();m.userData.partName=name;parent.add(m);return m}
function build(){
  while(model.children.length) { const c=model.children.pop(); c.geometry?.dispose(); }
  const w=Number(document.querySelector('#width').value)/1000;
  const d=Number(document.querySelector('#depth').value)/1000;
  const h=Number(document.querySelector('#height').value)/1000;
  const fabric=document.querySelector('#fabric').value;
  const wood=mat('#4d4035'), cloth=mat(fabric), cushion=mat('#b8a48f'), feet=mat('#596b76',.35);
  const seatY=Math.max(.28,h*.38), seatH=Math.max(.13,h*.19), backH=Math.max(.3,h*.48);
  block(model,w*.94,.16,d*.88,0,.18,0,wood,'قاعدة الهيكل');
  block(model,w*.9,seatH,d*.78,0,seatY,0,cloth,'وسادة المقعد');
  block(model,w*.94,backH,.16,0,seatY+backH*.47,-d*.38,cloth,'مسند الظهر');
  block(model,.16,seatY+backH*.2,d*.82,-w*.43,seatY*.48,0,cloth,'ذراع أيسر');
  block(model,.16,seatY+backH*.2,d*.82,w*.43,seatY*.48,0,cloth,'ذراع أيمن');
  for(let i=0;i<3;i++){const px=(i-1)*w*.29;block(model,w*.27,.12,d*.62,px,seatY+.10,.035,cushion,'وسادة جلوس '+(i+1));}
  for(const x of [-1,1]) for(const z of [-1,1]) block(model,.065,.18,.065,x*w*.4,.09,z*d*.38,feet,'رجل');
  separated=false;
}
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)} animate();
function resize(){const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)} new ResizeObserver(resize).observe(host);
document.querySelector('#update').addEventListener('click',()=>{build();});
document.querySelector('#piece').addEventListener('change',()=>{const chair=document.querySelector('#piece').value==='chair';document.querySelector('#width').value=chair?850:2200;document.querySelector('#depth').value=chair?850:900;document.querySelector('#height').value=chair?900:850;document.querySelector('#designName').value=chair?'كرسي تجريبي':'كنبة تجريبية';build();});
document.querySelector('#fabric').addEventListener('change',build);
document.querySelector('#explode').addEventListener('click',()=>{if(separated)return;model.children.forEach((m,i)=>{m.position.y+=.12+(i%3)*.08;m.position.x+=(i%2?1:-1)*.12});separated=true;});
document.querySelector('#reset').addEventListener('click',()=>{model.children.forEach(m=>m.position.copy(m.userData.base));separated=false;});
build();