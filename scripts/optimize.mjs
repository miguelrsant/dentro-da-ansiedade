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

// Vertices split along UV seams share a position; smoothing runs on these position groups so both
// sides of a seam end up with the same normal and AO.
function positionGroups(P) {
  const n = P.getCount(), map = new Map(), gid = new Uint32Array(n), v = [];
  let count = 0;
  for (let i = 0; i < n; i++) {
    P.getElement(i, v);
    const k = v.map(x => Math.round(x * 100)).join(',');
    let id = map.get(k);
    if (id === undefined) { id = count++; map.set(k, id); }
    gid[i] = id;
  }
  return { gid, count };
}

// Gives the scans the reference's polished look: skin gets very smooth normals so faces read as glass,
// hair a little, and clothes keep theirs (their folds come from the detail texture now). The baked AO
// is softened. Vertex colours from the bake: r, g = AO, b = skin, a = hair.
function polish() {
  return doc => {
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0'), I = prim.getIndices(), P = prim.getAttribute('POSITION');
      if (!N || !C || !I) continue;
      const n = N.getCount(), { gid, count } = positionGroups(P);
      const idx = Uint32Array.from(I.getArray(), i => gid[i]);
      const nrm = new Float32Array(count * 3), ao = new Float32Array(count * 2), wSkin = new Float32Array(count), all = new Float32Array(count).fill(1), cnt = new Float32Array(count);
      const c = [], v = [];
      for (let i = 0; i < n; i++) {
        const g = gid[i];
        N.getElement(i, v); for (let k = 0; k < 3; k++) nrm[g * 3 + k] += v[k];
        C.getElement(i, c); ao[g * 2] += c[0]; ao[g * 2 + 1] += c[1];
        wSkin[g] += Math.max(c[2], c[3] * 0.3);
        cnt[g]++;
      }
      for (let g = 0; g < count; g++) {
        const l = Math.hypot(nrm[g * 3], nrm[g * 3 + 1], nrm[g * 3 + 2]) || 1;
        for (let k = 0; k < 3; k++) nrm[g * 3 + k] /= l;
        ao[g * 2] /= cnt[g]; ao[g * 2 + 1] /= cnt[g]; wSkin[g] /= cnt[g];
      }
      const out = smoothField(nrm, 3, idx, wSkin, 6, true);
      const aoS = smoothField(ao, 2, idx, all, 3, false);
      for (let i = 0; i < n; i++) {
        const g = gid[i];
        N.setElement(i, [out[g * 3], out[g * 3 + 1], out[g * 3 + 2]]);
        C.getElement(i, c); c[0] = aoS[g * 2]; c[1] = aoS[g * 2 + 1]; C.setElement(i, c);
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
  // the baked material only carries vertex colours; the detail textures are loaded separately
  for (const m of doc.getRoot().listMaterials()) { m.setBaseColorTexture(null); m.setNormalTexture(null); }
  await doc.transform(
    weld(),
    polish(),
    resample({ tolerance: 0.0005 }),
    dedup(),
    prune({ keepAttributes: true }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14, quantizeColor: 8, quantizeWeight: 8 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path.join(dst, f);
  await io.write(out, doc);
  console.log(f, (fs.statSync(path.join(src, f)).size / 1024).toFixed(0) + 'KB ->', (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
}
