import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const N = p.getAttribute('NORMAL'), W = p.getAttribute('WEIGHTS_0'), P = p.getAttribute('POSITION');
    const n = P.getCount(); let zeroN = 0, badN = 0, zeroW = 0, nanP = 0; const v = [], w = [], q = [];
    for (let i = 0; i < n; i++) {
      N.getElement(i, v); const l = Math.hypot(...v); if (l < 1e-4) zeroN++; else if (Math.abs(l - 1) > 0.05) badN++;
      if (W) { W.getElement(i, w); const s = w.reduce((a, b) => a + b, 0); if (s < 1e-3) zeroW++; }
      P.getElement(i, q); if (q.some(x => !Number.isFinite(x))) nanP++;
    }
    console.log(f.split('/').pop(), 'verts', n, 'zeroNormal', zeroN, 'nonUnitNormal', badN, 'zeroWeights', zeroW, 'nanPos', nanP, 'normalType', N.getComponentType(), N.getNormalized());
  }
}
