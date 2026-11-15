import { createKernelBoxPreview, createSofaAssemblyPreview } from './occt-kernel.js';

export function mountCadKernelLab() {
  document.querySelector('#cadKernelLab')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'cadKernelLab';
  overlay.className = 'cad-kernel-backdrop';
  overlay.innerHTML = `
    <section class="cad-kernel-dialog" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="cadKernelTitle">
      <header class="cad-kernel-head">
        <div><span class="cad-kernel-kicker">OPEN CASCADE / WEBASSEMBLY</span><h2 id="cadKernelTitle">المهندس الذكي 3D</h2><p>مساحة التصميم الهندسي الذكي داخل نظام الشركة</p></div>
        <button type="button" class="cad-kernel-close" aria-label="إغلاق">×</button>
      </header>
      <div class="cad-kernel-notice"><strong>مرحلة تطوير — لا تعتمد مخرجاتها للتصنيع بعد</strong><span>أدخل أبعاد الأثاث بالسنتيمتر؛ يحولها النظام تلقائيًا إلى ملليمتر قبل إنشاء الأجسام الهندسية داخل Open CASCADE.</span></div>
      <section class="cad-voice-panel" aria-labelledby="cadVoiceTitle">
        <div class="cad-voice-heading"><div><b id="cadVoiceTitle">تحدّث مع المهندس الذكي</b><span>أوامر صوتية أو كتابية باللغة العربية</span></div><span class="cad-voice-state" id="cadVoiceState">جاهز</span></div>
        <div class="cad-voice-actions">
          <button type="button" id="cadVoiceMic" class="cad-voice-mic"><span aria-hidden="true">🎙</span> ابدأ التحدث</button>
          <button type="button" id="cadVoiceStop" class="cad-voice-stop" disabled>إيقاف الاستماع</button>
          <label class="cad-voice-speak"><input type="checkbox" id="cadVoiceSpeak" checked> اقرأ الرد بصوت</label>
        </div>
        <label class="cad-voice-input-label" for="cadVoiceInput">ما الذي تريد تصميمه أو تعديله؟</label>
        <textarea id="cadVoiceInput" rows="2" placeholder="مثال: صمم كنبة عرضها 220 سم وعمقها 90 سم وارتفاعها 85 سم، ثلاثة مقاعد."></textarea>
        <div class="cad-voice-bottom"><button type="button" id="cadVoiceSend" class="cad-kernel-build">إرسال الطلب للمهندس</button><span id="cadVoiceSupport">سيطلب المتصفح إذن الميكروفون عند بدء التحدث.</span></div>
        <div id="cadVoiceReply" class="cad-voice-reply" role="status" aria-live="polite">أنا جاهز. اكتب طلبك أو اضغط الميكروفون. راجع أي مقاسات قبل إنشاء المجسم.</div>
      </section>
      <div class="cad-sofa-section">
        <div class="cad-sofa-heading"><div><b>أول نموذج أثاث — كنبة مستقيمة</b><span>تكوين مبدئي من قطع B-Rep مستقلة ينشئها محرك Open CASCADE</span></div><span class="cad-sofa-count">خشب · إسفنج · قماش · أرجل</span></div>
        <div class="cad-sofa-controls">
          <label>الطول الكلي (سم)<input id="cadSofaWidth" type="number" min="50" max="400" step="1" value="220"></label>
          <label>العرض / العمق (سم)<input id="cadSofaDepth" type="number" min="50" max="400" step="1" value="90"></label>
          <label>الارتفاع الكلي (سم)<input id="cadSofaHeight" type="number" min="50" max="400" step="1" value="85"></label>
          <label>عدد المقاعد<select id="cadSofaSeats"><option value="2">مقعدين</option><option value="3" selected>3 مقاعد</option><option value="4">4 مقاعد</option></select></label>
          <button type="button" id="cadSofaBuild" class="cad-kernel-build">إنشاء الكنبة بالمحرك الهندسي</button>
        </div>
        <section class="cad-fabric-library" aria-label="مكتبة عينات الأقمشة والجلود">
          <div class="cad-fabric-head"><div><b>مكتبة عينات التنجيد</b><span>اختر نوع الخامة ثم اللون لتطبيقه على وسائد الكنبة في المعاينة</span></div><span id="cadFabricCount">112 عينة لونية أولية</span></div>
          <div class="cad-fabric-families" id="cadFabricFamilies">
            <button type="button" class="is-active" data-family="chenille">شانيل</button>
            <button type="button" data-family="linen">كتان</button>
            <button type="button" data-family="velvet">مخمل</button>
            <button type="button" data-family="leather">جلد</button>
            <button type="button" data-family="synthetic">جلد صناعي</button>
            <button type="button" data-family="suede">شمواه</button>
            <button type="button" data-family="jacquard">جاكار</button>
            <button type="button" data-family="cotton">قطن</button>
          </div>
          <div class="cad-fabric-grid" id="cadFabricGrid"></div>
          <div class="cad-fabric-custom"><label for="cadFabricCustomColor">اختر أي درجة لون بنفسك</label><input type="color" id="cadFabricCustomColor" value="#818985"><span>تطبيق اللون المخصص على خامة العائلة المختارة</span></div>
          <div class="cad-fabric-selected" id="cadFabricSelected">العينة الافتراضية: شانيل — رمادي حجري</div>
        </section>
        <div class="cad-sofa-parts" id="cadSofaParts"><span>بعد الإنشاء ستظهر هنا قائمة القطع المستقلة وأبعاد كل قطعة.</span></div>
      </div>
      <div class="cad-kernel-layout">
        <aside class="cad-kernel-controls">
          <h3>أبعاد الجسم التجريبي</h3>
          <label>العرض X (مم)<input id="cadKernelWidth" type="number" min="1" max="10000" value="800"></label>
          <label>الارتفاع Y (مم)<input id="cadKernelHeight" type="number" min="1" max="10000" value="500"></label>
          <label>العمق Z (مم)<input id="cadKernelDepth" type="number" min="1" max="10000" value="400"></label>
          <button type="button" id="cadKernelBuild" class="cad-kernel-build">إنشاء الجسم بالمحرك الهندسي</button>
          <p id="cadKernelStatus" class="cad-kernel-status" aria-live="polite">المحرك لم يُحمّل بعد. سيبدأ التحميل عند الضغط على إنشاء.</p>
          <div class="cad-kernel-proof"><b>ما الذي نتحقق منه؟</b><span>تحميل OCCT WebAssembly</span><span>إنشاء مجسم B-Rep</span><span>توليد شبكة عرض GLB</span><span>عرض المجسم داخل النظام</span></div>
        </aside>
        <div class="cad-kernel-viewport" id="cadKernelViewport"><div class="cad-kernel-empty">سيظهر المجسم الهندسي هنا</div></div>
      </div>
      <footer class="cad-kernel-footer"><span>Open CASCADE Technology · WebAssembly</span><button type="button" class="cad-kernel-close-secondary">إغلاق المختبر</button></footer>
    </section>`;
  document.body.appendChild(overlay);

  let renderer, controls, observer, frame = 0, model = null, objectUrl = null, closed = false;
  const viewport = overlay.querySelector('#cadKernelViewport');
  const status = overlay.querySelector('#cadKernelStatus');
  const buildButton = overlay.querySelector('#cadKernelBuild');
  const close = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    controls?.dispose();
    if (model) {
      model.traverse(item => {
        item.geometry?.dispose?.();
        if (Array.isArray(item.material)) item.material.forEach(material => material.dispose?.());
        else item.material?.dispose?.();
      });
    }
    renderer?.dispose();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    overlay.remove();
  };
  overlay.querySelectorAll('.cad-kernel-close,.cad-kernel-close-secondary').forEach(button => button.addEventListener('click', close));
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  const escapeHandler = event => { if (event.key === 'Escape' && !closed) close(); };
  window.addEventListener('keydown', escapeHandler, { once: true });

  const setStatus = message => { if (!closed) status.textContent = message; };
  const ensureViewer = async () => {
    if (renderer) return;
    const [THREE, controlsModule, loaderModule, roundedModule] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js')
    ]);
    const { RoundedBoxGeometry } = roundedModule;
    const { OrbitControls } = controlsModule;
    const { GLTFLoader } = loaderModule;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8eef2');
    // OCCT furniture dimensions are X=width, Y=depth, Z=height.
    // Keep the Three.js scene Z-up so the model, floor grid and dimensions agree.
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50000);
    camera.up.set(0, 0, 1);
    camera.position.set(1400, 1100, 1500);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    viewport.innerHTML = '';
    viewport.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x73808a, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(1200, 1800, 2400);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: 0xf5f7f8, roughness: 0.96, metalness: 0 })
    );
    // Keep the construction grid strictly below the furniture footprint.
    floor.position.z = -2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(5000, 50, 0x82939e, 0xcbd5db);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -1.5;
    scene.add(grid);
    const loader = new GLTFLoader();
    const resize = () => {
      if (closed || !renderer) return;
      const width = viewport.clientWidth, height = viewport.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    observer = new ResizeObserver(resize);
    observer.observe(viewport);
    const render = () => {
      if (closed) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return {
      THREE, RoundedBoxGeometry, scene, camera, controls, loader,
      fit(object, { sitOnFloor = false } = {}) {
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        // A furniture model must sit on Z=0. Centering all three axes puts
        // half the sofa below the floor/grid, which made the seat and legs vanish.
        if (sitOnFloor) {
          object.position.x -= center.x;
          object.position.y -= center.y;
          object.position.z -= bounds.min.z;
        } else {
          object.position.sub(center);
        }
        const targetZ = sitOnFloor ? Math.max(1, size.z * 0.5) : 0;
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const distance = maxDim * 2.05;
        camera.position.set(distance, distance * .82, targetZ + distance * .82);
        camera.near = Math.max(.1, maxDim / 1000);
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, targetZ);
        controls.update();
      },
      load(url) {
        return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
      },
      add(object) { scene.add(object); }
    };
  };

  let viewerPromise;
  const fabricFamilies = {
    chenille: { label: 'شانيل', texture: 'woven', samples: [['عاجي دافئ','#e8dfcf'],['كريمي','#d9cbb5'],['بيج رملي','#c7b397'],['جملي','#aa8663'],['بني موكا','#715747'],['رمادي فاتح','#b9bdba'],['رمادي حجري','#818985'],['فحمي','#41494a'],['أسود','#252729'],['أزرق بترولي','#315d68'],['كحلي','#293b55'],['أخضر زيتوني','#68735a'],['أخضر زمردي','#31594a'],['وردي غباري','#b98483'],['عنابي','#713e49'],['خردلي','#b08a3e']] },
    linen: { label: 'كتان', texture: 'linen', samples: [['أبيض طبيعي','#eee9dd'],['عاجي','#ded4c1'],['بيج فاتح','#d2c2a8'],['بيج داكن','#ae9a7d'],['رمادي لؤلؤي','#c5c6c0'],['رمادي متوسط','#929792'],['رمادي داكن','#555b59'],['بني ترابي','#806b57'],['أزرق سماوي','#91aeb7'],['أزرق رمادي','#647e89'],['أخضر مريمي','#9aa58b'],['زيتي','#68745d'],['طوبي','#a55e4c'],['وردي باهت','#d0a7a0'],['أسود','#292c2b'],['كحلي','#35465b']] },
    velvet: { label: 'مخمل', texture: 'velvet', samples: [['أبيض لؤلؤي','#e7e1d8'],['شامبين','#cbb99b'],['بيج كراميل','#b58d68'],['بني شوكولا','#50382f'],['رمادي فضي','#b4b6b7'],['رصاصي','#62696d'],['أسود عميق','#202326'],['أزرق ملكي','#315b91'],['كحلي ليلي','#202f4d'],['تركواز','#397f80'],['أخضر غامق','#285443'],['زمردي','#17644e'],['خمري','#713548'],['أحمر ياقوتي','#8e343e'],['وردي غباري','#b77e88'],['بنفسجي','#64516f']] },
    leather: { label: 'جلد طبيعي', texture: 'leather', samples: [['عاجي','#e5d9c5'],['بيج طبيعي','#c9ad88'],['كونياك','#a9653d'],['عسلي','#9a633b'],['بني جوزي','#684733'],['بني داكن','#3d2b23'],['أسود','#202020'],['رمادي فاتح','#aaa9a2'],['رمادي فحمي','#45494a'],['أحمر نبيذي','#642f35'],['أخضر غامق','#344c40'],['أزرق داكن','#2c4054']] },
    synthetic: { label: 'جلد صناعي', texture: 'leather', samples: [['أبيض','#f0eee8'],['كريمي','#e0d5c2'],['بيج','#c6ad8f'],['جملي','#a77a53'],['بني','#684a36'],['أسود','#242526'],['رمادي فاتح','#b8b9b5'],['رمادي غامق','#565b5c'],['أحمر','#8c3439'],['أزرق','#345a78'],['أخضر','#46604c'],['عنابي','#63333d']] },
    suede: { label: 'شمواه', texture: 'suede', samples: [['عاجي','#e4dac9'],['رملي','#c8b394'],['جملي','#aa805a'],['بني','#74543d'],['موكا','#594437'],['رمادي فاتح','#b6b7b1'],['رمادي متوسط','#858984'],['فحمي','#45494a'],['أسود','#252626'],['أزرق دخاني','#5d7480'],['أخضر مريمي','#8a987e'],['وردي ترابي','#b58d86']] },
    jacquard: { label: 'جاكار', texture: 'jacquard', samples: [['عاجي منقوش','#e8dfcf'],['بيج منقوش','#cbb99f'],['ذهبي هادئ','#b59a69'],['بني كلاسيكي','#80664f'],['رمادي فضي','#b7b8b3'],['رصاصي','#686d6c'],['أزرق ملكي','#405b80'],['كحلي','#2c3b54'],['أخضر زيتوني','#697256'],['خمري','#713d48'],['وردي معتق','#b78d91'],['أسود منقوش','#303132']] },
    cotton: { label: 'قطن', texture: 'woven', samples: [['أبيض ناصع','#f1f0e9'],['أوف وايت','#e6e0d4'],['بيج','#d0c0a7'],['رمادي فاتح','#c2c5c1'],['رمادي','#8e9693'],['فحمي','#4d5554'],['أسود','#252729'],['أزرق فاتح','#a0b9c6'],['أزرق','#547b9a'],['كحلي','#33465e'],['أخضر فاتح','#a7b39c'],['أخضر غامق','#4b6653'],['أصفر خردلي','#c3a14f'],['وردي','#d1a5a5'],['أحمر','#a94b4d'],['بني','#80614b']] }
  };
  let selectedFabric = { family: 'chenille', name: 'رمادي حجري', color: '#818985' };
  const fabricGrid = overlay.querySelector('#cadFabricGrid');
  const renderFabricSamples = familyKey => {
    const family = fabricFamilies[familyKey] || fabricFamilies.chenille;
    overlay.querySelectorAll('#cadFabricFamilies button').forEach(button => button.classList.toggle('is-active', button.dataset.family === familyKey));
    fabricGrid.innerHTML = family.samples.map(([name,color], index) =>
      '<button type="button" class="cad-fabric-swatch' + (selectedFabric.family === familyKey && selectedFabric.name === name ? ' is-selected' : '') + '" data-family="' + familyKey + '" data-name="' + name + '" data-color="' + color + '" aria-label="' + family.label + ' ' + name + '">' +
      '<span class="cad-fabric-chip cad-texture-' + family.texture + '" style="--swatch:' + color + '"></span><b>' + name + '</b><small>' + family.label + ' · ' + String(index + 1).padStart(2,'0') + '</small></button>'
    ).join('');
    overlay.querySelector('#cadFabricCount').textContent = family.samples.length + ' عينة في ' + family.label;
  };
  const makeFabricTexture = (THREE, familyKey, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0,0,256,256);
    const family = fabricFamilies[familyKey];
    if (family.texture === 'woven' || family.texture === 'linen' || family.texture === 'jacquard') {
      for (let i=0;i<256;i+=4) {
        ctx.fillStyle = i % 8 ? 'rgba(255,255,255,.10)' : 'rgba(30,30,30,.09)';
        ctx.fillRect(i,0,1,256);
        ctx.fillRect(0,i,256,1);
      }
      if (family.texture === 'jacquard') {
        ctx.strokeStyle='rgba(255,255,255,.13)'; ctx.lineWidth=2;
        for(let y=12;y<256;y+=32){ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=256;x+=16)ctx.lineTo(x,y+Math.sin(x/12)*5);ctx.stroke();}
      }
    } else if (family.texture === 'velvet' || family.texture === 'suede') {
      const gradient=ctx.createLinearGradient(0,0,256,220);
      gradient.addColorStop(0,'rgba(255,255,255,.20)');gradient.addColorStop(.48,'rgba(255,255,255,.02)');gradient.addColorStop(1,'rgba(0,0,0,.22)');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
      for(let i=0;i<1800;i++){const x=Math.random()*256,y=Math.random()*256;ctx.fillStyle=Math.random()>.5?'rgba(255,255,255,.035)':'rgba(0,0,0,.035)';ctx.fillRect(x,y,1,3);}
    } else if (family.texture === 'leather') {
      for(let i=0;i<1800;i++){const x=Math.random()*256,y=Math.random()*256,r=Math.random()*1.5+.3;ctx.fillStyle=Math.random()>.5?'rgba(255,255,255,.12)':'rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(x,y,r*1.5,r,Math.random(),0,Math.PI*2);ctx.fill();}
      const shine=ctx.createLinearGradient(0,0,256,256);shine.addColorStop(0,'rgba(255,255,255,.12)');shine.addColorStop(.5,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(0,0,0,.12)');ctx.fillStyle=shine;ctx.fillRect(0,0,256,256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2,2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  };
  const applyFabricToModel = () => {
    if (!model) return;
    const family = fabricFamilies[selectedFabric.family];
    const THREE = viewerPromise && window.__cadThree;
    if (!THREE) return;
    model.traverse(item => {
      if (!item.isMesh || !item.userData.isUpholstery) return;
      const texture = makeFabricTexture(THREE, selectedFabric.family, selectedFabric.color);
      item.material.map?.dispose?.();
      item.material.map = texture;
      item.material.color.set('#ffffff');
      item.material.roughness = family.texture === 'leather' ? 0.42 : family.texture === 'velvet' ? 0.88 : 0.82;
      item.material.metalness = 0;
      item.material.needsUpdate = true;
    });
    overlay.querySelector('#cadFabricSelected').textContent = 'العينة المختارة: ' + family.label + ' — ' + selectedFabric.name + ' (' + selectedFabric.color + ')';
  };
  overlay.querySelector('#cadFabricFamilies').addEventListener('click', event => {
    const button = event.target.closest('button[data-family]');
    if (button) renderFabricSamples(button.dataset.family);
  });
  fabricGrid.addEventListener('click', event => {
    const button = event.target.closest('button[data-color]');
    if (!button) return;
    selectedFabric = { family: button.dataset.family, name: button.dataset.name, color: button.dataset.color };
    renderFabricSamples(selectedFabric.family);
    applyFabricToModel();
  });
  renderFabricSamples('chenille');
  overlay.querySelector('#cadFabricCustomColor').addEventListener('input', event => {
    selectedFabric = { family: selectedFabric.family, name: 'لون مخصص', color: event.target.value };
    applyFabricToModel();
    fabricGrid.querySelectorAll('.cad-fabric-swatch').forEach(button => button.classList.remove('is-selected'));
  });
  buildButton.addEventListener('click', async () => {
    buildButton.disabled = true;
    try {
      const dimensions = {
        width: Number(overlay.querySelector('#cadKernelWidth').value),
        height: Number(overlay.querySelector('#cadKernelHeight').value),
        depth: Number(overlay.querySelector('#cadKernelDepth').value)
      };
      const viewer = await (viewerPromise ||= ensureViewer());
      if (model) {
        viewer.scene.remove(model);
        model.traverse(item => {
          item.geometry?.dispose?.();
          if (Array.isArray(item.material)) item.material.forEach(material => material.dispose?.());
          else item.material?.dispose?.();
        });
        model = null;
      }
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      const result = await createKernelBoxPreview(dimensions, setStatus);
      objectUrl = result.url;
      setStatus('تم إنشاء جسم B-Rep. جارٍ تحميل ملف العرض…');
      const gltf = await viewer.load(result.url);
      model = gltf.scene;
      viewer.add(model);
      viewer.fit(model);
      URL.revokeObjectURL(result.url);
      objectUrl = null;
      setStatus(`نجح الاختبار: جسم OCCT بأبعاد ${dimensions.width} × ${dimensions.height} × ${dimensions.depth} مم.`);
    } catch (error) {
      console.error('Open CASCADE test failed:', error);
      setStatus('تعذر تشغيل المحرك: ' + (error?.message || 'خطأ غير معروف') + ' — راجع سجل البناء والتشغيل.');
    } finally {
      buildButton.disabled = false;
    }
  });


  // Arabic voice input: native browser speech recognition where available, with a typing fallback.
  const voiceMic = overlay.querySelector('#cadVoiceMic');
  const voiceStop = overlay.querySelector('#cadVoiceStop');
  const voiceInput = overlay.querySelector('#cadVoiceInput');
  const voiceState = overlay.querySelector('#cadVoiceState');
  const voiceReply = overlay.querySelector('#cadVoiceReply');
  const voiceSupport = overlay.querySelector('#cadVoiceSupport');
  const voiceSend = overlay.querySelector('#cadVoiceSend');
  const voiceSpeak = overlay.querySelector('#cadVoiceSpeak');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let pendingSofaBuild = false;
  const sayReply = message => {
    voiceReply.textContent = message;
    if (voiceSpeak.checked && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ar-JO';
      utterance.rate = 0.96;
      window.speechSynthesis.speak(utterance);
    }
  };
  if (!SpeechRecognition) {
    voiceMic.disabled = true;
    voiceMic.title = 'الإملاء الصوتي غير مدعوم في هذا المتصفح';
    voiceSupport.textContent = 'الإملاء الصوتي غير متاح في هذا المتصفح؛ يمكنك كتابة الطلب هنا واستخدام الإرسال.';
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = 'ar-JO';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => {
      listening = true;
      voiceState.textContent = 'أستمع إليك…';
      voiceMic.disabled = true;
      voiceStop.disabled = false;
    };
    recognition.onresult = event => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interimText += event.results[i][0].transcript;
      }
      if (finalText) voiceInput.value = (voiceInput.value ? voiceInput.value.trim() + ' ' : '') + finalText.trim();
      voiceState.textContent = interimText ? 'أسمع: ' + interimText : 'تم التقاط الكلام';
    };
    recognition.onerror = event => {
      voiceState.textContent = 'تعذر الاستماع';
      voiceSupport.textContent = event.error === 'not-allowed'
        ? 'لم يُسمح باستخدام الميكروفون. فعّل إذن الميكروفون من إعدادات المتصفح.'
        : 'حدث خطأ في الإملاء الصوتي (' + event.error + '). يمكنك كتابة الطلب بدلًا من ذلك.';
    };
    recognition.onend = () => {
      listening = false;
      voiceMic.disabled = false;
      voiceStop.disabled = true;
      if (!closed && voiceState.textContent === 'أستمع إليك…') voiceState.textContent = 'انتهى الاستماع';
    };
    voiceMic.addEventListener('click', () => {
      try { recognition.start(); }
      catch (error) { voiceSupport.textContent = 'الميكروفون يعمل بالفعل أو يحتاج إعادة المحاولة.'; }
    });
    voiceStop.addEventListener('click', () => {
      if (listening) recognition.stop();
      voiceState.textContent = 'تم إيقاف الاستماع';
    });
  }
  const normalizeArabicDigits = value => value
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const parseDimension = (text, terms) => {
    const names = terms.join('|');
    const match = text.match(new RegExp('(?:' + names + ')[^0-9]{0,12}(\\d+(?:\\.\\d+)?)'));
    if (!match) return null;
    const value = Number(match[1]);
    return /(?:مم|ملليمتر|millimeters?|mm)/i.test(text) ? value / 10 : value;
  };
  voiceSend.addEventListener('click', () => {
    const request = normalizeArabicDigits(voiceInput.value.trim());
    if (!request) { sayReply('اكتب طلبك أو اضغط الميكروفون أولاً.'); return; }
    const asksSofa = /كنب|كنبة|أريكة|sofa/i.test(request);
    const width = parseDimension(request, ['العرض','عرضها','عرضه','عرض']);
    const depth = parseDimension(request, ['العمق','عمقها','عمقه','عمق']);
    const height = parseDimension(request, ['الارتفاع','ارتفاعها','ارتفاعه','ارتفاع']);
    const seatsMatch = request.match(/(\d+)\s*(?:مقاعد|مقعد|كرسي)/);
    if (asksSofa) {
      if (width) overlay.querySelector('#cadSofaWidth').value = width;
      if (depth) overlay.querySelector('#cadSofaDepth').value = depth;
      if (height) overlay.querySelector('#cadSofaHeight').value = height;
      if (seatsMatch) overlay.querySelector('#cadSofaSeats').value = Math.max(2, Math.min(4, Number(seatsMatch[1])));
      pendingSofaBuild = true;
      const changed = [width && 'الطول ' + width + ' سم', depth && 'العمق ' + depth + ' سم', height && 'الارتفاع ' + height + ' سم'].filter(Boolean);
      sayReply(changed.length
        ? 'فهمت أنك تريد كنبة. جهزت المقاسات التالية: ' + changed.join('، ') + '. راجع الحقول ثم اضغط «إنشاء الكنبة بالمحرك الهندسي» لتأكيد إنشاء المعاينة.'
        : 'فهمت أنك تريد تصميم كنبة. حدد العرض والعمق والارتفاع وعدد المقاعد في حقول الكنبة، ثم اضغط زر إنشاء الكنبة.');
      voiceState.textContent = 'تم تحليل الطلب';
    } else {
      pendingSofaBuild = false;
      sayReply('وصلني طلبك: «' + request + '». أستطيع حاليًا تنفيذ أوامر إعداد معاينة الكنبة المستقيمة المحددة فقط. بقية أنواع الأثاث والأوامر الحوارية تحتاج ربط محرك فهم الأوامر قبل تنفيذها.');
      voiceState.textContent = 'تم استلام النص';
    }
  });
  overlay.querySelector('#cadSofaBuild').addEventListener('click', () => { pendingSofaBuild = false; });

  const createPillowGeometry = (THREE, width, depth, thickness, thicknessAxis = 'z') => {
    // Soft, restrained upholstery volume. It is intentionally centered so the
    // engineering part position from OCCT remains authoritative.
    const geometry = new THREE.BufferGeometry();
    const uSteps=36, vSteps=24, positions=[], indices=[], uvs=[];
    const hw=width*0.5, hd=depth*0.5, ht=thickness*0.5;
    const crown=Math.min(thickness*0.16,22);
    const bulge=(u,v)=>crown*Math.pow(Math.max(0,1-u*u),0.65)*Math.pow(Math.max(0,1-v*v),0.65);
    const addSurface=(sign)=>{
      const base=positions.length/3;
      for(let j=0;j<=vSteps;j++){
        const v=-1+2*j/vSteps;
        for(let i=0;i<=uSteps;i++){
          const u=-1+2*i/uSteps;
          const b=bulge(u,v);
          if(thicknessAxis==='y') positions.push(hw*u, sign*(ht+b), hd*v);
          else positions.push(hw*u, hd*v, sign*(ht+b));
          uvs.push((u+1)/2,(v+1)/2);
        }
      }
      return base;
    };
    const top=addSurface(1), bottom=addSurface(-1);
    for(let j=0;j<vSteps;j++) for(let i=0;i<uSteps;i++){
      const a=top+j*(uSteps+1)+i,b=a+1,c=a+uSteps+1,d=c+1;
      const e=bottom+j*(uSteps+1)+i,f=e+1,g=e+uSteps+1,h=g+1;
      indices.push(a,c,b,b,c,d);
      indices.push(e,f,g,f,h,g);
    }
    const boundary=[];
    for(let i=0;i<=uSteps;i++) boundary.push(i);
    for(let j=1;j<=vSteps;j++) boundary.push(j*(uSteps+1)+uSteps);
    for(let i=uSteps-1;i>=0;i--) boundary.push(vSteps*(uSteps+1)+i);
    for(let j=vSteps-1;j>0;j--) boundary.push(j*(uSteps+1));
    for(let k=0;k<boundary.length;k++){
      const n=(k+1)%boundary.length;
      indices.push(top+boundary[k],top+boundary[n],bottom+boundary[k],
                   top+boundary[n],bottom+boundary[n],bottom+boundary[k]);
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  };

  const createArmGeometry = (THREE, width, depth, height) => {
    // Upholstered arm with a rounded/tapered profile, centered around its local
    // origin so the original OCCT part position remains the exact placement.
    const geometry = new THREE.BufferGeometry();
    const along = 36, around = 32, positions = [], indices = [], uvs = [];
    for (let j = 0; j <= along; j++) {
      const t = j / along;
      const y = (t - 0.5) * depth;
      const endRadius = 0.88 + 0.12 * Math.sin(Math.PI * t);
      const rx = width * 0.50 * endRadius;
      const rz = height * 0.50 * (0.94 + 0.06 * Math.sin(Math.PI * t));
      for (let i = 0; i <= around; i++) {
        const a = (Math.PI * 2 * i) / around;
        const cs = Math.cos(a), sn = Math.sin(a);
        // Slightly flatter inner/outer side profile than a raw ellipse.
        const sx = Math.sign(cs) * Math.pow(Math.abs(cs), 0.86);
        const sz = Math.sign(sn) * Math.pow(Math.abs(sn), 0.86);
        positions.push(sx * rx, y, sz * rz);
        uvs.push(i / around, t);
      }
    }
    for (let j = 0; j < along; j++) {
      for (let i = 0; i < around; i++) {
        const a = j * (around + 1) + i;
        const b = a + 1, c = a + around + 1, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };
  const sofaBuildButton = overlay.querySelector('#cadSofaBuild');
  sofaBuildButton.addEventListener('click', async () => {
    sofaBuildButton.disabled = true;
    buildButton.disabled = true;
    try {
      const dimensions = {
        width: Number(overlay.querySelector('#cadSofaWidth').value) * 10,
        depth: Number(overlay.querySelector('#cadSofaDepth').value) * 10,
        height: Number(overlay.querySelector('#cadSofaHeight').value) * 10,
        seats: Number(overlay.querySelector('#cadSofaSeats').value)
      };
      const viewer = await (viewerPromise ||= ensureViewer());
      if (model) {
        viewer.scene.remove(model);
        model.traverse(item => {
          item.geometry?.dispose?.();
          if (Array.isArray(item.material)) item.material.forEach(material => material.dispose?.());
          else item.material?.dispose?.();
        });
        model = null;
      }
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      const result = await createSofaAssemblyPreview(dimensions, setStatus);
      objectUrl = result.url;
      setStatus('تم بناء قطع الكنبة الصلبة. جارٍ تحميل التجميعة ثلاثية الأبعاد…');
      const gltf = await viewer.load(result.url);
      model = gltf.scene;
      const palette = { wood: 0x805b3f, foam: 0xd7c7a5, fabric: 0xffffff, metal: 0x34434d };
      let meshIndex = 0;
      model.traverse(item => {
        if (!item.isMesh) return;
        const part = result.parts[Math.min(meshIndex, result.parts.length - 1)];
        item.userData.isUpholstery = part?.category === 'fabric' || part?.category === 'foam';
        // Keep OCCT dimensions/solids as the engineering source, but render each
        // visible component with softened, furniture-like radii instead of sharp toy blocks.
        item.geometry.computeBoundingBox();
        const localBounds = item.geometry.boundingBox;
        const localSize = localBounds.getSize(new viewer.THREE.Vector3());
        const localCenter = localBounds.getCenter(new viewer.THREE.Vector3());
        const smallestSide = Math.max(1, Math.min(localSize.x, localSize.y, localSize.z));
        const cornerRadius = Math.min(
          part?.category === 'fabric' ? 42 : part?.category === 'foam' ? 58 : 12,
          smallestSide * 0.42
        );
        const partSize = {
          x: Math.max(1, localSize.x),
          y: Math.max(1, localSize.y),
          z: Math.max(1, localSize.z)
        };
        const softened = part?.id?.startsWith('arm-')
          ? createArmGeometry(viewer.THREE, partSize.x, partSize.y, partSize.z)
          : part?.category === 'fabric'
            ? createPillowGeometry(
                viewer.THREE,
                partSize.x,
                part?.id?.startsWith('back-cushion-') ? partSize.z : partSize.y,
                part?.id?.startsWith('back-cushion-') ? partSize.y : partSize.z,
                part?.id?.startsWith('back-cushion-') ? 'y' : 'z'
              )
            : new viewer.RoundedBoxGeometry(partSize.x, partSize.y, partSize.z, 10, cornerRadius);
        item.geometry.dispose();
        item.geometry = softened;
        item.position.add(localCenter);
        item.material = new viewer.THREE.MeshStandardMaterial({
          color: palette[part?.category] || 0x82939a,
          roughness: part?.category === 'metal' ? 0.38 : 0.82,
          metalness: part?.category === 'metal' ? 0.68 : 0.02
        });
        item.castShadow = true;
        item.receiveShadow = true;
        meshIndex++;
      });
      window.__cadThree = viewer.THREE;
      applyFabricToModel();
      viewer.add(model);
      viewer.fit(model, { sitOnFloor: true });
      URL.revokeObjectURL(result.url);
      objectUrl = null;
      const partsHost = overlay.querySelector('#cadSofaParts');
      partsHost.innerHTML = '<div class="cad-sofa-parts-head"><b>مكونات التجميعة</b><span>' + result.parts.length + ' قطعة مستقلة · الأبعاد بالملليمتر</span></div>' +
        '<div class="cad-sofa-parts-list">' + result.parts.map(part =>
          '<div class="cad-sofa-part-row"><span><i class="cad-part-dot cad-part-' + part.category + '"></i>' + part.label + '</span><b>' +
          Math.round(part.width) + ' × ' + Math.round(part.depth) + ' × ' + Math.round(part.height) + '</b></div>'
        ).join('') + '</div>';
      setStatus('نجح إنشاء كنبة مستقيمة من ' + result.parts.length + ' قطعة B-Rep مستقلة. هذه معاينة هندسية أولية وليست ملف تصنيع معتمداً.');
    } catch (error) {
      console.error('OCCT sofa assembly failed:', error);
      setStatus('تعذر إنشاء الكنبة: ' + (error?.message || 'خطأ غير معروف'));
    } finally {
      sofaBuildButton.disabled = false;
      buildButton.disabled = false;
    }
  });
}
