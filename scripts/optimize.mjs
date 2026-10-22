// Compresses the baked characters (assets-src/raw/*.glb) into public/models/*.glb.
// Usage: node scripts/optimize.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

// Averages a per-vertex field with its mesh neighbours, `iterations` times. Vertices with weight 0
// keep their value; others blend towards the smoothed one by their weight.
function smoothField(field, stride, idx, weight, iterations, normalize) {
  const n = field.length / stride;
  let cur = field.slice();
  for (let it = 0; it < iterations; it++) {
    const acc = cur.slice(), cnt = new Float32Array(n).fill(1);
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      for (let e = 0; e < 3; e++) {
        const p = tri[e];
        if (weight[p] === 0) continue;
        for (const q of [tri[(e + 1) % 3], tri[(e + 2) % 3]]) {
          for (let k = 0; k < stride; k++) acc[p * stride + k] += cur[q * stride + k];
          cnt[p]++;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (weight[i] === 0) continue;
      let l = 0;
      for (let k = 0; k < stride; k++) { acc[i * stride + k] /= cnt[i]; l += acc[i * stride + k] ** 2; }
      l = normalize ? Math.sqrt(l) || 1 : 1;
      for (let k = 0; k < stride; k++) cur[i * stride + k] = acc[i * stride + k] / l;
    }
  }
  const out = new Float32Array(field.length);
  for (let i = 0; i < n; i++) {
    const w = weight[i];
    let l = 0;
    for (let k = 0; k < stride; k++) { out[i * stride + k] = field[i * stride + k] * (1 - w) + cur[i * stride + k] * w; l += out[i * stride + k] ** 2; }
    l = normalize ? Math.sqrt(l) || 1 : 1;
    for (let k = 0; k < stride; k++) out[i * stride + k] /= l;
  }
  return out;
}

// Gives the scans the reference's polished look: skin (and, less, hair) gets very smooth normals so
// faces read as glass, clothes keep their folds but lose the scan's grain, and the baked AO is softened.
// Vertex colours from the bake: r, g = AO, b = skin, a = hair.
function polish() {
  return doc => {
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0'), I = prim.getIndices();
      if (!N || !C || !I) continue;
      const n = N.getCount(), idx = I.getArray();
      const nrm = new Float32Array(n * 3), ao = new Float32Array(n * 2), wSkin = new Float32Array(n), wCloth = new Float32Array(n), all = new Float32Array(n).fill(1);
      const c = [], v = [];
      for (let i = 0; i < n; i++) {
        N.getElement(i, v); nrm.set(v, i * 3);
        C.getElement(i, c); ao[i * 2] = c[0]; ao[i * 2 + 1] = c[1];
        wSkin[i] = Math.max(c[2], c[3] * 0.6);
        wCloth[i] = 0.6 * (1 - wSkin[i]);
      }
      let out = smoothField(nrm, 3, idx, wSkin, 6, true);
      out = smoothField(out, 3, idx, wCloth, 2, true);
      const aoS = smoothField(ao, 2, idx, all, 3, false);
      for (let i = 0; i < n; i++) {
        N.setElement(i, [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]]);
        C.getElement(i, c); c[0] = aoS[i * 2]; c[1] = aoS[i * 2 + 1]; C.setElement(i, c);
      }
    }
  };
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const src = 'assets-src/raw', dst = 'public/models';
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(src, f));
  // the baked material only carries vertex colors; strip any leftover textures
  for (const m of doc.getRoot().listMaterials()) { m.setBaseColorTexture(null); m.setNormalTexture(null); }
  // no textures, so UVs are dead weight (and would keep seams from welding)
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) prim.setAttribute('TEXCOORD_0', null);
  await doc.transform(
    weld(),
    polish(),
    resample({ tolerance: 0.0005 }),
    dedup(),
    prune({ keepAttributes: true }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, quantizeWeight: 8 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path.join(dst, f);
  await io.write(out, doc);
  console.log(f, (fs.statSync(path.join(src, f)).size / 1024).toFixed(0) + 'KB ->', (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
}
