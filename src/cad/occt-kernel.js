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
