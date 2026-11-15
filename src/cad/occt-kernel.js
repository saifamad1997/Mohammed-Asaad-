let kernelPromise;
let exportSequence = 0;

export function loadCadKernel(onProgress = () => {}) {
  if (!kernelPromise) {
    kernelPromise = (async () => {
      onProgress('تحميل محرك Open CASCADE الهندسي…');
      const { default: initOpenCascade } = await import('opencascade.js');
      const oc = await initOpenCascade();
      if (!oc?.BRepPrimAPI_MakeBox_2 || !oc?.RWGltf_CafWriter) {
        throw new Error('تم تحميل المحرك، لكن واجهات النمذجة أو تصدير GLB غير متاحة في هذه الحزمة.');
      }
      onProgress('محرك CAD جاهز');
      return oc;
    })().catch(error => {
      kernelPromise = null;
      throw error;
    });
  }
  return kernelPromise;
}

/**
 * Kernel smoke-test helper. Dimensions are millimetres and the returned GLB
 * is generated from an OCCT B-Rep solid, not from a Three.js primitive.
 * This is intentionally a technical test utility, not a furniture generator.
 */
export async function createKernelBoxPreview({ width, height, depth }, onProgress = () => {}) {
  const values = { width: Number(width), height: Number(height), depth: Number(depth) };
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value) || value < 1 || value > 10000) {
      throw new RangeError(`قيمة ${key} يجب أن تكون بين 1 و10000 مم.`);
    }
  }

  const oc = await loadCadKernel(onProgress);
  const shape = new oc.BRepPrimAPI_MakeBox_2(values.width, values.height, values.depth).Shape();
  const document = new oc.TDocStd_Document(new oc.TCollection_ExtendedString_1());
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(document.Main()).get();
  shapeTool.SetShape(shapeTool.NewShape(), shape);
  new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.1, false);

  const filePath = `/cad-kernel-preview-${++exportSequence}.glb`;
  const writer = new oc.RWGltf_CafWriter(new oc.TCollection_AsciiString_2(filePath), true);
  writer.Perform_2(
    new oc.Handle_TDocStd_Document_2(document),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1()
  );

  const bytes = oc.FS.readFile(filePath, { encoding: 'binary' });
  const blob = new Blob([bytes], { type: 'model/gltf-binary' });
  oc.FS.unlink(filePath);
  return {
    url: URL.createObjectURL(blob),
    dimensionsMm: values,
    kernel: 'Open CASCADE Technology',
    representation: 'B-Rep solid exported to GLB'
  };
}


/**
 * Builds a first parametric straight-sofa assembly as separate OCCT B-Rep
 * solids. Coordinates and dimensions are millimetres; this is a geometry
 * prototype and is not a validated shop drawing or cutting list.
 */
export async function createSofaAssemblyPreview({ width = 2200, depth = 900, height = 850, seats = 3 }, onProgress = () => {}) {
  const p = { width: Number(width), depth: Number(depth), height: Number(height), seats: Number(seats) };
  if (!Number.isInteger(p.seats) || p.seats < 2 || p.seats > 4) {
    throw new RangeError('عدد المقاعد يجب أن يكون بين 2 و4.');
  }
  for (const [key, value] of Object.entries({ width: p.width, depth: p.depth, height: p.height })) {
    if (!Number.isFinite(value) || value < 500 || value > 4000) {
      throw new RangeError(`قيمة ${key} يجب أن تكون بين 500 و4000 مم.`);
    }
  }
  const arm = Math.max(150, Math.min(220, Math.round(p.width * 0.085)));
  const leg = 100;
  const railHeight = 210;
  const seatThickness = 150;
  const usableWidth = p.width - arm * 2 - 80;
  const seatWidth = (usableWidth - (p.seats - 1) * 18) / p.seats;
  if (seatWidth < 350 || p.depth < 650 || p.height < 650) {
    throw new RangeError('الأبعاد غير مناسبة لتكوين كنبة مستقيمة بهذه المواصفات.');
  }

  const parts = [];
  const add = (id, label, category, material, x, y, z, dx, dy, dz) => {
    if ([x,y,z,dx,dy,dz].some(v => !Number.isFinite(v)) || dx <= 0 || dy <= 0 || dz <= 0) {
      throw new Error(`أبعاد غير صالحة للقطعة: ${label}`);
    }
    parts.push({ id, label, category, material, x, y, z, width: dx, depth: dy, height: dz });
  };

  // Structural timber frame: four perimeter rails and a central support rail.
  add('frame-front','عارضة الهيكل الأمامية','wood','خشب',arm,leg,leg,p.width-arm*2,45,railHeight);
  add('frame-back','عارضة الهيكل الخلفية','wood','خشب',arm,p.depth-90,leg,p.width-arm*2,45,railHeight);
  add('frame-left','عارضة الهيكل الجانبية اليسرى','wood','خشب',arm,leg+45,leg,45,p.depth-135,railHeight);
  add('frame-right','عارضة الهيكل الجانبية اليمنى','wood','خشب',p.width-arm-45,leg+45,leg,45,p.depth-135,railHeight);
  add('frame-center','دعامة وسطية للهيكل','wood','خشب',p.width/2-22.5,leg+45,leg,45,p.depth-135,railHeight);
  add('seat-deck','قاعدة حمل الإسفنج','wood','كونتر',arm+45,leg+45,leg+railHeight,p.width-arm*2-90,p.depth-135,24);

  // Four feet, represented as individual solid components.
  [[55,55],[p.width-125,55],[55,p.depth-125],[p.width-125,p.depth-125]].forEach((v,i) =>
    add(`foot-${i+1}`,`رجل الكنبة ${i+1}`,'metal','معدن',v[0],v[1],0,70,70,leg)
  );

  // Upholstered arms and inner side pads.
  add('arm-left','ذراع الكنبة الأيسر','foam','إسفنج',0,0,leg,arm,p.depth,p.height-leg-90);
  add('arm-right','ذراع الكنبة الأيمن','foam','إسفنج',p.width-arm,0,leg,arm,p.depth,p.height-leg-90);
  add('arm-pad-left','وسادة الذراع الأيسر','fabric','قماش',18,20,p.height-125,arm-36,p.depth-40,35);
  add('arm-pad-right','وسادة الذراع الأيمن','fabric','قماش',p.width-arm+18,20,p.height-125,arm-36,p.depth-40,35);

  // Back support and individual back cushions.
  const backBase = leg + railHeight + seatThickness + 24;
  const backHeight = Math.max(260, p.height - backBase - 45);
  add('back-support','لوح/هيكل الظهر','wood','خشب',arm+45,p.depth-135,backBase,p.width-arm*2-90,45,backHeight);
  const cushionDepth = Math.min(145, Math.max(110, p.depth * 0.15));
  const cushionWidth = (usableWidth - (p.seats - 1) * 14) / p.seats;
  for (let i=0;i<p.seats;i++) {
    const x = arm + 40 + i * (cushionWidth + 14);
    // Seat cushion must stay inside the usable seat depth; the old p.depth-190
    // value extended a 90 cm sofa cushion beyond the back of the sofa.
    const seatY = leg + 45;
    const seatDepth = Math.max(500, p.depth - 285);
    add(`seat-cushion-${i+1}`,`وسادة المقعد ${i+1}`,'fabric','قماش',x,seatY,leg+railHeight+24,cushionWidth,seatDepth,seatThickness);
    // Place back cushions on the sitting side of the back support, not behind it.
    const backCushionY = p.depth - 135 - cushionDepth - 10;
    add(`back-cushion-${i+1}`,`وسادة الظهر ${i+1}`,'fabric','قماش',x,backCushionY,backBase+12,cushionWidth,cushionDepth,backHeight-24);
  }

  const oc = await loadCadKernel(onProgress);
  if (!oc?.gp_Pnt_3 || !oc?.BRepPrimAPI_MakeBox_3) {
    throw new Error('نسخة المحرك الحالية لا تحتوي واجهات إنشاء القطع الموضوعة بالإحداثيات.');
  }
  const document = new oc.TDocStd_Document(new oc.TCollection_ExtendedString_1());
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(document.Main()).get();
  for (const part of parts) {
    const point = new oc.gp_Pnt_3(part.x, part.y, part.z);
    const shape = new oc.BRepPrimAPI_MakeBox_3(point, part.width, part.depth, part.height).Shape();
    shapeTool.SetShape(shapeTool.NewShape(), shape);
    new oc.BRepMesh_IncrementalMesh_2(shape, 0.15, false, 0.15, false);
  }
  onProgress(`تم إنشاء ${parts.length} قطعة هندسية مستقلة. جارٍ تجهيز المعاينة…`);
  const filePath = `/cad-sofa-assembly-${++exportSequence}.glb`;
  const writer = new oc.RWGltf_CafWriter(new oc.TCollection_AsciiString_2(filePath), true);
  writer.Perform_2(
    new oc.Handle_TDocStd_Document_2(document),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1()
  );
  const bytes = oc.FS.readFile(filePath, { encoding: 'binary' });
  const blob = new Blob([bytes], { type: 'model/gltf-binary' });
  oc.FS.unlink(filePath);
  return {
    url: URL.createObjectURL(blob),
    dimensionsMm: p,
    parts,
    kernel: 'Open CASCADE Technology',
    representation: 'Separate OCCT B-Rep solids exported as GLB',
    status: 'parametric_geometry_prototype_not_manufacturing_approved'
  };
}
