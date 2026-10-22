// Prints the hip's horizontal drift inside each idle pose window (metres, model space).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const POSES = { full: [1.6, 20.3], hip: [1.6, 4.6], relaxed: [6.4, 8.3], crossed: [9.4, 14.6], relaxed2: [15.7, 17.3], hip2: [17.7, 19.7] };
for (const [file, clipName] of [['public/models/sophia.glb', 'idle'], ['public/models/nathan.glb', 'walk']]) {
  const doc = await io.read(file);
  const hipNode = doc.getRoot().listNodes().find(n => n.getName() === 'hip');
  console.log(file, 'bind hip', hipNode.getTranslation().map(v => +v.toFixed(3)), 'parent scale?', doc.getRoot().listNodes().filter(n => n.listChildren().includes(hipNode)).map(n => n.getName() + ' s=' + n.getScale().map(v => +v.toFixed(3)) + ' r=' + n.getRotation().map(v => +v.toFixed(3))));
  const anim = doc.getRoot().listAnimations().find(a => a.getName() === clipName);
  const ch = anim.listChannels().find(c => c.getTargetNode() === hipNode && c.getTargetPath() === 'translation');
  const s = ch.getSampler(); const t = s.getInput().getArray(); const v = s.getOutput().getArray();
  const windows = clipName === 'idle' ? POSES : { walk: [0, t[t.length - 1]] };
  for (const [k, [a, b]] of Object.entries(windows)) {
    let n = 0, sx = 0, sy = 0, sz = 0, minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (let i = 0; i < t.length; i++) if (t[i] >= a && t[i] <= b) { const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2]; n++; sx += x; sy += y; sz += z; minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
    console.log(k.padEnd(9), 'mean', [sx / n, sy / n, sz / n].map(x => x.toFixed(3)).join(' '), 'x', minx.toFixed(3), maxx.toFixed(3), 'z', minz.toFixed(3), maxz.toFixed(3));
  }
}
