import { createKernelBoxPreview } from './occt-kernel.js';

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
}
