import { createKernelBoxPreview, createSofaAssemblyPreview } from './occt-kernel.js';

export function mountCadKernelLab() {
  document.querySelector('#cadKernelLab')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'cadKernelLab';
  overlay.className = 'cad-kernel-backdrop';
  overlay.innerHTML = `
    <section class="cad-kernel-dialog" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="cadKernelTitle">
      <header class="cad-kernel-head">
        <div><span class="cad-kernel-kicker">OPEN CASCADE / WEBASSEMBLY</span><h2 id="cadKernelTitle">مختبر المحرك الهندسي الحقيقي</h2><p>اختبار أولي للمحرك الهندسي داخل نظام الشركة</p></div>
        <button type="button" class="cad-kernel-close" aria-label="إغلاق">×</button>
      </header>
      <div class="cad-kernel-notice"><strong>اختبار تقني — ليس تصميم أثاث نهائياً</strong><span>يُنشئ المحرك جسماً هندسياً B-Rep بأبعاد مدخلة بالملليمتر، ثم يصدره إلى GLB لعرضه داخل هذه النافذة. هذه الخطوة تثبت ربط النواة، ولا تعني أن مكتبة الأثاث أو ملفات التصنيع اكتملت.</span></div>
      <div class="cad-sofa-section">
        <div class="cad-sofa-heading"><div><b>أول نموذج أثاث — كنبة مستقيمة</b><span>تكوين مبدئي من قطع B-Rep مستقلة ينشئها محرك Open CASCADE</span></div><span class="cad-sofa-count">خشب · إسفنج · قماش · أرجل</span></div>
        <div class="cad-sofa-controls">
          <label>العرض الكلي (مم)<input id="cadSofaWidth" type="number" min="500" max="4000" value="2200"></label>
          <label>العمق الكلي (مم)<input id="cadSofaDepth" type="number" min="500" max="4000" value="900"></label>
          <label>الارتفاع الكلي (مم)<input id="cadSofaHeight" type="number" min="500" max="4000" value="850"></label>
          <label>عدد المقاعد<select id="cadSofaSeats"><option value="2">مقعدين</option><option value="3" selected>3 مقاعد</option><option value="4">4 مقاعد</option></select></label>
          <button type="button" id="cadSofaBuild" class="cad-kernel-build">إنشاء الكنبة بالمحرك الهندسي</button>
        </div>
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
    const [THREE, controlsModule, loaderModule] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/GLTFLoader.js')
    ]);
    const { OrbitControls } = controlsModule;
    const { GLTFLoader } = loaderModule;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8eef2');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50000);
    camera.position.set(1400, 1100, 1500);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    viewport.innerHTML = '';
    viewport.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x73808a, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(1200, 1800, 1400);
    scene.add(key);
    const grid = new THREE.GridHelper(5000, 50, 0x82939e, 0xcbd5db);
    grid.position.y = -0.5;
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
      THREE, scene, camera, controls, loader,
      fit(object) {
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        object.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const distance = maxDim * 1.9;
        camera.position.set(distance, distance * .72, distance);
        camera.near = Math.max(.1, maxDim / 1000);
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
      },
      load(url) {
        return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
      },
      add(object) { scene.add(object); }
    };
  };

  let viewerPromise;
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

  const sofaBuildButton = overlay.querySelector('#cadSofaBuild');
  sofaBuildButton.addEventListener('click', async () => {
    sofaBuildButton.disabled = true;
    buildButton.disabled = true;
    try {
      const dimensions = {
        width: Number(overlay.querySelector('#cadSofaWidth').value),
        depth: Number(overlay.querySelector('#cadSofaDepth').value),
        height: Number(overlay.querySelector('#cadSofaHeight').value),
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
      const palette = { wood: 0x805b3f, foam: 0xd7c7a5, fabric: 0x718b91, metal: 0x34434d };
      let meshIndex = 0;
      model.traverse(item => {
        if (!item.isMesh) return;
        const part = result.parts[Math.min(meshIndex, result.parts.length - 1)];
        item.material = new viewer.THREE.MeshStandardMaterial({
          color: palette[part?.category] || 0x82939a,
          roughness: part?.category === 'metal' ? 0.38 : 0.82,
          metalness: part?.category === 'metal' ? 0.68 : 0.02
        });
        item.castShadow = true;
        item.receiveShadow = true;
        meshIndex++;
      });
      viewer.add(model);
      viewer.fit(model);
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
