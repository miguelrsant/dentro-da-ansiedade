import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const c = p.getAttribute('COLOR_0'); const arr = c.getArray(); const n = c.getCount();
    for (let ch = 0; ch < 4; ch++) {
      const h = new Array(10).fill(0); for (let i = 0; i < n; i++) h[Math.min(9, Math.floor(arr[i * 4 + ch] * 10))]++;
      console.log(f.split('/').pop(), 'ch' + ch, h.map(x => (x / n * 100).toFixed(0)).join(' '));
    }
  }
  console.log('anims', doc.getRoot().listAnimations().map(a => a.getName() + ':' + a.listChannels().length));
}
