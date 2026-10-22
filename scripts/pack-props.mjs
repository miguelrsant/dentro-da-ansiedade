// Packs the Poly Haven props the scenes use for the web: no roughness maps (the unlit shader never reads
// them), 512 px WebP textures, lighter meshes, quantized and meshopt-compressed into one .glb each.
// Reads the downloads of scripts/get-props.py (assets-src/props). Needs `npm i -D sharp` for the WebP step.
// Usage: node scripts/pack-props.mjs public/props id1 id2 ...
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, quantize, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [out, ...ids] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const id of ids) {
  const src = `assets-src/props/${id}/${id}.gltf`;
  const doc = await io.read(src);
  for (const m of doc.getRoot().listMaterials()) m.setMetallicRoughnessTexture(null);
  const tris = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  await doc.transform(
    dedup(), prune(), weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: tris > 40000 ? 0.35 : 0.6, error: 0.0012 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(`${out}/${id}.glb`, doc);
  const before = fs.readdirSync(`assets-src/props/${id}`, { recursive: true }).map(f => `assets-src/props/${id}/${f}`).filter(f => fs.statSync(f).isFile()).reduce((a, f) => a + fs.statSync(f).size, 0);
  console.log(id, Math.round(tris), 'tris', (before / 1e6).toFixed(2), 'MB ->', (fs.statSync(`${out}/${id}.glb`).size / 1e6).toFixed(2), 'MB');
}
