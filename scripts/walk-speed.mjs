// Measures how far the feet travel in the in-place walk clip, to calibrate ground speed.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
const buf = fs.readFileSync('assets-src/raw/nathan.glb');
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
const root = gltf.scene; const clip = gltf.animations.find(a => a.name === 'walk');
const mixer = new THREE.AnimationMixer(root); mixer.clipAction(clip).play();
const fl = root.getObjectByName('foot_l'), fr = root.getObjectByName('foot_r');
const v = new THREE.Vector3(); const rows = [];
for (let t = 0; t <= clip.duration; t += clip.duration / 48) {
  mixer.setTime(t); root.updateMatrixWorld(true);
  fl.getWorldPosition(v); const l = v.clone(); fr.getWorldPosition(v); const r = v.clone();
  rows.push([t.toFixed(2), l.x.toFixed(2), l.y.toFixed(2), l.z.toFixed(2), r.x.toFixed(2), r.y.toFixed(2), r.z.toFixed(2)].join(' '));
}
console.log('t  Lx Ly Lz  Rx Ry Rz'); console.log(rows.join('\n'));
