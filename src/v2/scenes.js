import * as THREE from 'three';
import { person, statue, boneAt, seated, scene, shared, currentBuild } from './engine.js';
import { POSES, STANDING } from './posing.js';
import { loadProps, prop, rbox, propMaterial } from './props.js';
import { PALETTES } from '../story.js';

const D2R = Math.PI / 180;
const add = (...o) => { for (const x of o) scene.add(x); return o[0]; };
const C = h => new THREE.Color(h);
const mixHex = (a, b, t) => '#' + C(a).lerp(C(b), t).getHexString();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// The protagonist (he has no name in the story). The other rigged people play everyone else.
export const HERO = 'nathan';

// Figures keep the reference's blue with a pink rim; the mood of a scene comes from the stage and
// furniture colours (a story palette) and from a few figure variants for night, warm and calm scenes.
const FIG = {
  blue: { uColorDark: '#5260e6', uColorBright: '#a6baff', uColorFresnel: '#ff80d0' },
  night: { uColorDark: '#15215f', uColorBright: '#5272e2', uColorFresnel: '#57d6d6' },
  warm: { uColorDark: '#5653cc', uColorBright: '#b8b8ff', uColorFresnel: '#ffa48a' },
  calm: { uColorDark: '#4b66dc', uColorBright: '#a6c6ff', uColorFresnel: '#86ecd0' },
};
export function look(env, fig = 'blue', extra = {}) {
  const p = PALETTES[env], f = FIG[fig];
  return {
    ...f,
    uBgNear: p.near, uBgMid: p.mid, uBgFar: p.far,
    uPropDark: mixHex(f.uColorDark, p.mid, 0.45), uPropBright: mixHex(p.near, '#ffffff', 0.22),
    uRim: 1.3, uFresnelPow: 1.1, uSatin: 0.55, uSkinBase: 0.7, uSkinAo: 0.45,
    ...extra,
  };
}

// ---------- building blocks (all in the props' unlit shader) ----------
const group = (pos = [0, 0, 0], rot = 0, parent = null) => { const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = rot * D2R; (parent || scene).add(g); return g; };
const box = (parent, size, o = {}) => { const m = rbox(shared, size, o); parent.add(m); return m; };
function solid(parent, geo, { pos = [0, 0, 0], rot = [0, 0, 0], tone = 0, emissive = 0 } = {}) {
  const m = new THREE.Mesh(geo, propMaterial(shared, { tone, emissive }));
  m.position.set(...pos); m.rotation.set(rot[0] * D2R, rot[1] * D2R, rot[2] * D2R);
  parent.add(m); return m;
}
const P = (parent, id, o = {}) => { const m = prop(id, o); parent.add(m); return m; };
const cyl = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r, r2, h, s);
const ball = r => new THREE.IcosahedronGeometry(r, 3);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A cut-away room: floor slab plus the listed walls. Origin at the floor centre.
function room(g, { w = 5, d = 4, h = 2.7, walls = ['back', 'left'], t = 0.1, floorTone = 0.05, wallTone = 0.02 } = {}) {
  box(g, [w, 0.03, d], { pos: [0, -0.027, 0], r: 0.01, tone: floorTone });
  if (walls.includes('back')) box(g, [w + (walls.includes('left') ? t : 0), h, t], { pos: [walls.includes('left') ? -t / 2 : 0, 0, -d / 2 - t / 2], r: 0.01, tone: wallTone });
  if (walls.includes('left')) box(g, [t, h, d], { pos: [-w / 2 - t / 2, 0, 0], r: 0.01, tone: wallTone });
  if (walls.includes('right')) box(g, [t, h, d], { pos: [w / 2 + t / 2, 0, 0], r: 0.01, tone: wallTone });
}
// A window on a wall plane: frame, mullion, sill and a glowing pane. `face`: which way the room side looks.
function windowPane(g, { pos, w = 1.2, h = 1.3, face = 'z', glow = 0.18, bars = 1 }) {
  const wg = new THREE.Group(); wg.position.set(...pos);
  wg.rotation.y = { z: 0, x: Math.PI / 2, '-x': -Math.PI / 2, '-z': Math.PI }[face]; g.add(wg);
  box(wg, [w, h, 0.02], { pos: [0, 0, 0], r: 0.005, tone: 0.22, emissive: glow });
  const f = 0.06;
  box(wg, [w + f, f, 0.08], { pos: [0, h - f / 2, 0.02], r: 0.01, tone: 0.08 });
  box(wg, [w + f, f, 0.08], { pos: [0, -f / 2, 0.02], r: 0.01, tone: 0.08 });
  box(wg, [f, h, 0.08], { pos: [-w / 2, 0, 0.02], r: 0.01, tone: 0.08 });
  box(wg, [f, h, 0.08], { pos: [w / 2, 0, 0.02], r: 0.01, tone: 0.08 });
  for (let i = 1; i <= bars; i++) box(wg, [0.04, h, 0.06], { pos: [-w / 2 + (w * i) / (bars + 1), 0, 0.02], r: 0.01, tone: 0.08 });
  box(wg, [w + 0.2, 0.04, 0.2], { pos: [0, -0.06, 0.08], r: 0.01, tone: 0.06 });
}
function bed(g, { w = 1.6, l = 2.05, duvet = 0.6, duvetTop = 0.78, pillows = true } = {}) {
  box(g, [w + 0.06, 0.3, l], { pos: [0, 0.06, 0], r: 0.03, tone: -0.08 });
  box(g, [w - 0.04, 0.16, l - 0.06], { pos: [0, 0.34, 0.02], r: 0.07, tone: 0.1 });
  box(g, [w + 0.1, 1.05, 0.09], { pos: [0, 0, -l / 2 - 0.02], r: 0.04, tone: -0.04 });
  if (pillows) {
    box(g, [w * 0.4, 0.13, 0.42], { pos: [-w * 0.23, 0.48, -l / 2 + 0.28], r: 0.06, tone: 0.16 });
    box(g, [w * 0.4, 0.13, 0.42], { pos: [w * 0.23, 0.48, -l / 2 + 0.28], r: 0.06, tone: 0.16 });
  }
  if (duvet) box(g, [w + 0.04, duvetTop - 0.4, l * duvet], { pos: [0, 0.4, l / 2 - l * duvet / 2 + 0.04], r: 0.1, tone: 0.06 });
}
// A soft pillow (world position, axis-aligned): a puffy height field over its footprint, w × d, on a base
// at y0 and h tall in the middle. Body points over it press it down: the cloth stays under each of them
// and eases back up in a smooth bowl, never thinner than `min`, so a head rests in it instead of passing through.
function pillow({ cx, cz, w = 0.64, d = 0.42, y0 = 0.49, h = 0.13, press = [], min = 0.035, give = 7, tone = 0.16, cell = 0.01 }) {
  const nx = Math.round(w / cell) + 1, nz = Math.round(d / cell) + 1, x0 = cx - w / 2, z0 = cz - d / 2;
  // flat on top, rounding down to the base along every edge
  const prof = u => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 5)), 0.32);
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = y0 + h * prof(i / (nx - 1)) * prof(j / (nz - 1));
  const low = new Float32Array(nx * nz).fill(Infinity);
  for (const v of press) {
    const i = Math.round((v.x - x0) / cell), j = Math.round((v.z - z0) / cell);
    if (i >= 0 && j >= 0 && i < nx && j < nz && v.y < H[j * nx + i] + 0.05) low[j * nx + i] = Math.min(low[j * nx + i], v.y - 0.004);
  }
  // the dent: under a pressed cell at height l, the cloth can rise no faster than give·r² around it
  const R = Math.ceil(0.12 / cell), D = new Float32Array(H);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const l = low[j * nx + i]; if (l === Infinity) continue;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const v = l + give * ((di * cell) ** 2 + (dj * cell) ** 2);
      if (v < D[jj * nx + ii]) D[jj * nx + ii] = v;
    }
  }
  for (let k = 0; k < D.length; k++) D[k] = Math.max(D[k], Math.min(H[k], y0 + min));
  const pos = [], idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) pos.push(x0 + i * cell, D[j * nx + i], z0 + j * cell);
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return add(new THREE.Mesh(geo, propMaterial(shared, { tone, side: THREE.DoubleSide })));
}
// World positions of a posed person's skinned vertices, each with the name of its strongest bone.
function bodyPoints(p) {
  const out = [];
  p.root.updateMatrixWorld(true);
  p.model.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
    for (let i = 0; i < si.count; i++) {
      let b = 0, w = -1;
      for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > w) { w = sw.getComponent(i, k); b = si.getComponent(i, k); }
      out.push({ v: o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld), bone: o.skeleton.bones[b].name });
    }
  });
  return out;
}
// A duvet draped over whoever lies under it: a height field over the mattress (x0..x1, z0 = the folded
// top edge, z1 = the foot end) that rises over the covered body points and slumps away from them with a
// cloth-like slope, then hangs over both sides and the foot of the bed.
function duvet(points, { x0, x1, z0, z1, top = 0.5, thick = 0.045, slope = 0.85, hang = 0.26, cell = 0.02, tone = 0.06 }) {
  const m = 5, ox = x0 - m * cell;
  const nx = Math.round((x1 - x0) / cell) + 2 * m + 1, nz = Math.round((z1 - z0) / cell) + m + 1;
  const base = top + thick, H = new Float32Array(nx * nz).fill(base);
  for (const { v } of points) {
    const i = Math.round((v.x - ox) / cell), j = Math.round((v.z - z0) / cell);
    if (i >= 0 && j >= 0 && i < nx && j < nz) H[j * nx + i] = Math.max(H[j * nx + i], v.y + thick);
  }
  const R = Math.ceil(0.4 / cell), D = new Float32Array(H);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const h = H[j * nx + i]; if (h <= base + 1e-4) continue;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const v = h - slope * Math.hypot(di, dj) * cell;
      if (v > D[jj * nx + ii]) D[jj * nx + ii] = v;
    }
  }
  // past the mattress edges the cloth falls away
  const out = (i, j) => Math.max(i < m ? m - i : 0, i > nx - 1 - m ? i - (nx - 1 - m) : 0, j > nz - 1 - m ? j - (nz - 1 - m) : 0) / m;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const t = out(i, j); if (!t) continue;
    const ei = Math.min(Math.max(i, m), nx - 1 - m), ej = Math.min(j, nz - 1 - m);
    D[j * nx + i] = Math.min(D[ej * nx + ei], base) - hang * t * t * (1.6 - 0.6 * t);
  }
  for (let pass = 0; pass < 3; pass++) {
    const S = new Float32Array(D);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let a = 0, c = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) { a += D[jj * nx + ii]; c++; } }
      S[j * nx + i] = a / c;
    }
    D.set(S);
  }
  // grid plus a lip row along the folded top edge, down to the mattress
  const pos = [], idx = [];
  for (let j = -1; j < nz; j++) for (let i = 0; i < nx; i++) {
    const jj = Math.max(j, 0), y = j < 0 ? Math.min(D[i], top + 0.01) : D[jj * nx + i];
    pos.push(ox + i * cell, y, z0 + jj * cell - (j < 0 ? 0.004 : 0));
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, propMaterial(shared, { tone, side: THREE.DoubleSide }));
  return add(mesh);
}
// The body points a duvet covers: everything past its top edge, minus the bones left out (an arm on top).
const under = (p, z0, leave = /^$/) => bodyPoints(p).filter(({ v, bone }) => v.z > z0 && !leave.test(bone));
// Points for a duvet thrown back off the bed: a rolled edge along x0 and soft folds behind it.
function rumple({ x0, x1, z0, z1, seed = 1, n = 16 }) {
  const R = rng(seed), pts = [];
  for (let z = z0; z <= z1; z += 0.02) pts.push({ v: V3(x0 + 0.04 * Math.sin(z * 9), 0.6 + 0.025 * Math.sin(z * 6 + 1), z) });
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.12 + R() * (x1 - x0 - 0.12), z = z0 + R() * (z1 - z0), len = 0.15 + R() * 0.35, a = R() * Math.PI, h = 0.56 + R() * 0.06;
    for (let t = -len / 2; t <= len / 2; t += 0.02) pts.push({ v: V3(x + Math.cos(a) * t, h - Math.abs(t) * 0.15, z + Math.sin(a) * t) });
  }
  return pts;
}
// A phone with a lit screen, at `at`, screen turned towards `face`.
function phone(at, face, { glow = 0.55 } = {}) {
  const g = new THREE.Group(); g.position.copy(at); add(g);
  g.lookAt(face);
  box(g, [0.075, 0.15, 0.009], { pos: [0, -0.075, 0], r: 0.004, tone: -0.35 });
  box(g, [0.066, 0.138, 0.002], { pos: [0, -0.069, 0.0055], r: 0.001, tone: 0.3, emissive: glow });
  return g;
}
// The middle of a palm and the way it faces (out of the palm), from the hand and the finger roots.
function palmOf(p, s) {
  const at = n => boneAt(p, `${n}_${s}`);
  const h = at('hand'), roots = ['index_01', 'middle_01', 'ring_01', 'pinky_01'].map(at);
  const knuckles = roots.reduce((a, v) => a.add(v), V3(0, 0, 0)).multiplyScalar(0.25);
  const fwd = knuckles.clone().sub(h).normalize(), across = roots[0].clone().sub(roots[3]).normalize();
  const n = fwd.clone().cross(across).normalize();
  return { c: h.clone().lerp(knuckles, 0.6), n: s === 'l' ? n : n.negate(), fwd, across };
}
// A mug held round its body: upright, its side against the palm, the handle turned out past the thumb.
function mugIn(p, s, { r = 0.039, h = 0.094, gap = 0.021, tone = 0.25 } = {}) {
  const { c, n, fwd } = palmOf(p, s);
  const flat = n.clone().setY(0).normalize();
  const at = c.clone().addScaledVector(flat, r + gap);
  const g = new THREE.Group(); g.position.copy(at); add(g);
  solid(g, cyl(r, h, 28), { tone });
  // the handle on the side facing away from the fingers' tips
  const away = fwd.clone().setY(0).normalize().negate();
  const hd = solid(g, new THREE.TorusGeometry(0.024, 0.0065, 10, 24, Math.PI), { pos: away.clone().multiplyScalar(r + 0.004).toArray(), tone });
  hd.rotation.set(0, Math.atan2(away.x, away.z) - Math.PI / 2, -Math.PI / 2);
  return g;
}
// The dining table's cloth hangs 40 cm, through the knees of anyone sitting at it; this shortens the drop (k of
// it is kept), so the legs under the table stay clear of the cloth.
function shortCloth(root, k = 0.2) {
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !/cloth/.test(o.name)) return;
    const geo = o.geometry = o.geometry.clone(), a = geo.attributes.position, M = o.matrixWorld, inv = M.clone().invert(), v = V3(0, 0, 0);
    let top = -Infinity;
    for (let i = 0; i < a.count; i++) top = Math.max(top, v.fromBufferAttribute(a, i).applyMatrix4(M).y);
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(M);
      v.y = top - (top - v.y) * k;
      v.applyMatrix4(inv);
      a.setXYZ(i, v.x, v.y, v.z);
    }
    a.needsUpdate = true;
    geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  });
}
// A phone held in the hands, its screen turned up towards the eyes: between both palms, or lying across one palm
// (its top past the index finger, the fingers round one long edge, the thumb over the screen).
function phoneHeld(p, s = 'both', { glow = 0.5 } = {}) {
  const eyes = boneAt(p, 'head', [0, 0.06, 0.08]);
  let c, n, up;
  if (s === 'both') {
    const L = palmOf(p, 'l'), R = palmOf(p, 'r');
    n = L.n.clone().add(R.n).normalize();
    c = L.c.clone().lerp(R.c, 0.5);
    up = L.fwd.clone().add(R.fwd).normalize();
  } else ({ c, n, across: up } = palmOf(p, s));
  const z = n.clone().multiplyScalar(0.8).add(eyes.clone().sub(c).normalize().multiplyScalar(0.2)).normalize();
  c = c.clone().addScaledVector(n, 0.029);
  const y = up.clone().addScaledVector(z, -up.dot(z)).normalize(), x = y.clone().cross(z);
  // in both hands it lies on the palms and fingers: its bottom edge just past the heels of the hands
  if (s === 'both') c.addScaledVector(y, 0.11);
  const g = new THREE.Group(); g.position.copy(c); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); add(g);
  box(g, [0.072, 0.148, 0.009], { pos: [0, -0.074, -0.009], r: 0.004, tone: -0.35 });
  box(g, [0.064, 0.136, 0.002], { pos: [0, -0.068, -0.0005], r: 0.001, tone: 0.3, emissive: glow });
  return g;
}
// The people the lab fitted (hands moved out of bodies and props) or closed round a bar: on the site their poses
// come baked, fit and grip included, so they are plain person() calls in the same order.
const fit = (name, opts) => person(name, opts);
const gripBar = (name, opts) => person(name, opts);
// Light from a screen or the heart on a person's own material.
function glowOn(name, at, amt = 0.35, radius = 0.32, color = '#e8f4ff') {
  currentBuild().glows.push({ name, at: at.clone(), amt, radius, color });
}
const heart = p => boneAt(p, 'spine_03', [0.03, -0.04, 0.1]);

function deskSet(g, { pos = [0, 0, 0], rot = 0, w = 1.4, monitor = true, glow = 0.16 } = {}) {
  const d = group(pos, rot, g);
  box(d, [w, 0.035, 0.72], { pos: [0, 0.715, 0], r: 0.012, tone: 0.12 });
  box(d, [0.04, 0.715, 0.66], { pos: [-w / 2 + 0.04, 0, 0], r: 0.01, tone: -0.1 });
  box(d, [0.04, 0.715, 0.66], { pos: [w / 2 - 0.04, 0, 0], r: 0.01, tone: -0.1 });
  box(d, [w - 0.1, 0.4, 0.02], { pos: [0, 0.3, -0.3], r: 0.005, tone: -0.06 });
  if (monitor) {
    box(d, [0.2, 0.012, 0.16], { pos: [0, 0.75, -0.18], r: 0.005, tone: -0.2 });
    box(d, [0.04, 0.2, 0.03], { pos: [0, 0.76, -0.2], r: 0.008, tone: -0.2 });
    box(d, [0.6, 0.36, 0.03], { pos: [0, 0.9, -0.2], r: 0.01, tone: -0.3 });
    box(d, [0.56, 0.32, 0.004], { pos: [0, 0.92, -0.183], r: 0.002, tone: 0.25, emissive: glow });
    box(d, [0.44, 0.018, 0.14], { pos: [0, 0.75, 0.13], r: 0.006, tone: 0.05 });
  }
  return d;
}
function officeChair(g, { pos, rot = 0, tone = -0.15 }) {
  const c = group(pos, rot, g);
  solid(c, cyl(0.3, 0.03, 20), { pos: [0, 0.05, 0], tone });
  solid(c, cyl(0.025, 0.36, 10), { pos: [0, 0.23, 0], tone });
  box(c, [0.48, 0.08, 0.46], { pos: [0, 0.38, 0], r: 0.035, tone });
  box(c, [0.46, 0.52, 0.06], { pos: [0, 0.52, -0.25], r: 0.04, tone });
  return c;
}
function tree(g, { pos, h = 2.6, r = 1, seed = 1, tone = 0 }) {
  const t = group(pos, 0, g), R = rng(seed);
  solid(t, cyl(0.07 * r, h, 10, 0.11 * r), { pos: [0, h / 2, 0], tone: tone - 0.15 });
  for (let i = 0; i < 7; i++) {
    const a = R() * Math.PI * 2, rr = (0.25 + R() * 0.45) * r;
    solid(t, ball((0.5 + R() * 0.35) * r), { pos: [Math.cos(a) * rr, h + (R() * 0.9 - 0.1) * r, Math.sin(a) * rr], tone: tone + 0.05 });
  }
  solid(t, ball(0.75 * r), { pos: [0, h + 0.85 * r, 0], tone: tone + 0.1 });
  return t;
}
// A city block face: a slab with rows of recessed windows.
function building(g, { pos, w = 8, h = 14, d = 6, rot = 0, seed = 3, floors = 0 }) {
  const b = group(pos, rot, g), R = rng(seed);
  box(b, [w, h, d], { pos: [0, 0, 0], r: 0.08, tone: -0.02 + R() * 0.05 });
  const fl = floors || Math.floor(h / 3.2), cols = Math.floor(w / 1.8);
  for (let i = 0; i < fl; i++) for (let j = 0; j < cols; j++) {
    const x = -w / 2 + (j + 0.5) * (w / cols), y = 1.2 + i * 3.2;
    if (y + 1.6 > h) continue;
    box(b, [1.0, 1.5, 0.06], { pos: [x, y, d / 2], r: 0.02, tone: 0.12, emissive: R() < 0.25 ? 0.1 : 0 });
  }
  return b;
}
function stairs(g, { pos, rot = 0, n = 8, rise = 0.17, run = 0.29, w = 1.3, tone = 0.04 }) {
  const s = group(pos, rot, g);
  for (let i = 0; i < n; i++) box(s, [w, rise * (i + 1), run], { pos: [0, 0, -i * run], r: 0.01, tone: tone + (i % 2) * 0.015 });
  return s;
}

async function begin(pal, props = [], fig = 'blue', extra = {}) {
  const r = currentBuild();
  r.palette = look(pal, fig, extra);
  r.glows = [];
  if (props.length) await loadProps(shared, props);
}
// the camera of the frame: where the site's scroll camera starts from
function shoot(cam) { currentBuild().cam = cam; }

// ---------- scenes ----------

// 1-2, 11: his bedroom.
const MATTRESS = { x0: -0.68, x1: 0.88, z0: -1.5, z1: -0.135, top: 0.5 };
const BEDROOM_PROPS = ['painted_wooden_nightstand', 'alarm_clock_01', 'desk_lamp_arm_01', 'potted_plant_01', 'standing_picture_frame_01', 'drawer_cabinet'];
function bedroom({ duvet = 0.6, duvetTop = 0.8, glow = 0.22 } = {}) {
  const g = group();
  room(g, { w: 4.8, d: 4.4, walls: ['back', 'left'] });
  windowPane(g, { pos: [-2.39, 0.95, -0.6], w: 1.3, h: 1.35, face: 'x', glow });
  bed(group([0.1, 0, -1.15], 0, g), { duvet, duvetTop, pillows: false });
  P(g, 'painted_wooden_nightstand', { pos: [-1.0, 0, -1.95] });
  P(g, 'painted_wooden_nightstand', { pos: [1.2, 0, -1.95] });
  P(g, 'alarm_clock_01', { pos: [-1.05, 0.62, -1.9], rot: 25 });
  P(g, 'desk_lamp_arm_01', { pos: [1.25, 0.62, -2.0], rot: -70, scale: 0.75 });
  P(g, 'standing_picture_frame_01', { pos: [1.1, 0.62, -1.85], rot: -110, scale: 1.1 });
  P(g, 'drawer_cabinet', { pos: [2.0, 0, -1.9], scale: 0.62 });
  P(g, 'potted_plant_01', { pos: [-1.95, 0, 0.9], scale: 0.9 });
  box(g, [2.4, 0.012, 1.5], { pos: [0.1, 0, 0.55], r: 0.006, tone: 0.12 });
  return g;
}
// the two pillows of his bed, pressed by whoever lies on them
function bedPillows(p = null) {
  const pts = p ? bodyPoints(p).map(o => o.v) : [];
  pillow({ cx: -0.268, cz: -1.895, press: pts });
  pillow({ cx: 0.468, cz: -1.895, press: pts });
}
export async function s01() {
  await begin('dawn', BEDROOM_PROPS);
  bedroom({ duvet: 0 });
  const hero = fit(HERO, { pose: 'lieBack', pos: [-0.27, 0.5, -1.17] });
  bedPillows(hero);
  duvet(under(hero, -1.5, /(arm|hand|thumb|index|middle|ring|pinky)/), MATTRESS);
  phone(V3(-0.92, 0.633, -1.78), V3(-0.92, 2, -1.7), { glow: 0.45 });
  const cam = V3(0.95, 1.9, -0.05);
  shoot({ pos: cam.toArray(), target: [-0.32, 0.62, -1.62], fov: 34, focus: boneAt(hero, 'head').distanceTo(cam), range: 1.0, bokeh: 3 });
}
export async function s02() {
  await begin('dawn', BEDROOM_PROPS);
  bedroom({ duvet: 0 });
  // he sits on the bare edge of the mattress; the duvet he threw off lies rumpled on the far side
  duvet(rumple({ x0: -0.1, x1: 0.78, z0: -1.52, z1: -0.25, seed: 4 }), { ...MATTRESS, x0: -0.2, z0: -1.6 });
  const hero = person(HERO, { pose: seated('sitPhone', 0.535), pos: [-0.52, 0, -0.85], heading: -90 * D2R });
  bedPillows();
  // the phone lies on both palms, the screen turned up to his face
  const at = phoneHeld(hero, 'both', { glow: 0.55 }).position;
  glowOn(HERO, at, 0.06, 0.18);
  shoot({ pos: [-2.15, 1.35, 0.55], target: [-0.75, 0.95, -0.85], fov: 34, range: 0.9, bokeh: 4 });
}
export async function s11() {
  await begin('night', BEDROOM_PROPS, 'night');
  bedroom({ duvet: 0, glow: 0.04 });
  const hero = fit(HERO, { pose: 'lieSide', pos: [-0.06, 0.5, -1.22] });
  bedPillows(hero);
  duvet(under(hero, -1.3, /(arm|hand|thumb|index|middle|ring|pinky)/), { ...MATTRESS, z0: -1.3 });
  const head = boneAt(hero, 'head', [0, 0.05, 0.09]);
  const at = phoneHeld(hero, 'l', { glow: 0.8 }).position;
  glowOn(HERO, at, 0.45, 0.28, '#bfe9ff');
  const cam = V3(-1.48, 1.85, -0.7);
  shoot({ pos: cam.toArray(), target: [-0.18, 0.7, -1.6], fov: 34, focus: cam.distanceTo(head), range: 0.8, bokeh: 4.5 });
}

// 3. Kitchen: coffee going cold in his hands.
export async function s03() {
  await begin('lavender', ['tea_set_01', 'potted_plant_04', 'round_wooden_table_01', 'painted_wooden_chair_01', 'wall_clock', 'potted_plant_02']);
  const g = group();
  room(g, { w: 5.2, d: 4.2, walls: ['back', 'left'] });
  box(g, [3.3, 0.88, 0.62], { pos: [0.35, 0, -1.79], r: 0.02, tone: -0.04 });
  box(g, [3.36, 0.04, 0.66], { pos: [0.35, 0.88, -1.77], r: 0.01, tone: 0.14 });
  for (let i = 0; i < 5; i++) box(g, [0.62, 0.7, 0.02], { pos: [-1.05 + i * 0.68, 0.1, -1.47], r: 0.01, tone: 0.02 });
  box(g, [3.3, 0.72, 0.36], { pos: [0.35, 1.48, -1.92], r: 0.02, tone: -0.02 });
  box(g, [0.78, 1.9, 0.7], { pos: [-1.95, 0, -1.72], r: 0.05, tone: 0.06 });
  box(g, [0.3, 0.38, 0.3], { pos: [1.55, 0.92, -1.85], r: 0.03, tone: -0.25 });
  for (const [x, z] of [[0.55, -1.95], [0.85, -1.95], [0.55, -1.7], [0.85, -1.7]]) solid(g, cyl(0.09, 0.01), { pos: [x, 0.925, z], tone: -0.3 });
  windowPane(g, { pos: [-2.64, 1.0, 0.2], w: 1.4, h: 1.25, face: 'x', glow: 0.18 });
  P(g, 'tea_set_01', { pos: [-0.65, 0.9, -1.8], scale: 0.7 });
  P(g, 'potted_plant_04', { pos: [-1.2, 0.9, -1.85] });
  P(g, 'wall_clock', { pos: [-2.58, 2.0, -0.9], rot: 90 });
  P(g, 'round_wooden_table_01', { pos: [1.55, 0, 0.55], scale: 0.62 });
  P(g, 'painted_wooden_chair_01', { pos: [1.0, 0, 0.75], rot: 100 });
  P(g, 'painted_wooden_chair_01', { pos: [1.95, 0, 1.05], rot: -150 });
  P(g, 'potted_plant_02', { pos: [-2.1, 0, 1.4] });
  const hero = fit(HERO, { pose: 'mugOne', pos: [0.15, 0, -1.0], heading: 12 * D2R });
  mugIn(hero, 'r');
  shoot({ pos: [1.85, 1.6, 2.55], target: [0.05, 1.02, -1.0], fov: 34, range: 1.0, bokeh: 3.5 });
}

// 4. The street: everyone walking past, he stands still.
const WALKERS = ['carla', 'eric', 'sophia', 'claudia', 'manuel'];
// a standing idle that suits the person: Sophia's capture for the women, the CMU men's for the men
const WOMEN = ['carla', 'sophia', 'claudia'];
function idleOf(name, k = 0) {
  if (WOMEN.includes(name)) return ['relaxed', 'crossed'][Math.abs(Math.round(k * 7)) % 2];
  return ['stand', 'standB', 'standC', 'standD', 'waiting'][Math.abs(Math.round(k * 7)) % 5];
}
function crowd({ n = 40, area = [16, 18], center = [0, 0], keep = [[0, 0, 1.4]], seed = 7, along = 0, statues = true, y = 0 }) {
  const R = rng(seed), people = [];
  let tries = 0;
  while (people.length < n && tries++ < 2000) {
    const x = center[0] + (R() - 0.5) * area[0], z = center[1] + (R() - 0.5) * area[1];
    if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
    if (people.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.85)) continue;
    people.push([x, z]);
  }
  people.forEach(([x, z], i) => {
    const kind = R();
    const dir = (R() < 0.5 ? 0 : 180) + along + (R() - 0.5) * 40;
    if (statues && kind < 0.12) statue(['dennis', 'mei', 'fabienne'][i % 3], { pos: [x, y, z], heading: dir * D2R });
    else if (kind < 0.25) { const n = WALKERS[i % WALKERS.length]; person(n, { pose: i % 3 === 0 ? 'phone' : idleOf(n, i), pos: [x, y, z], heading: dir * D2R }); }
    else person(WALKERS[i % WALKERS.length], { walkAt: R() * 2.2, pos: [x, y, z], heading: dir * D2R });
  });
}
// A car as rounded blocks: body, cabin, wheels and lit lamps. Faces +z before `rot`.
function car(g, { pos, rot = 0, tone = -0.12, long = 4.2, bus = false }) {
  const c = group(pos, rot, g), w = bus ? 2.5 : 1.8, L = bus ? 11 : long;
  box(c, [w, bus ? 2.6 : 0.72, L], { pos: [0, 0.28, 0], r: bus ? 0.2 : 0.16, tone });
  if (!bus) box(c, [w - 0.2, 0.55, L * 0.5], { pos: [0, 0.95, -0.2], r: 0.18, tone: tone + 0.18 });
  else for (let i = 0; i < 6; i++) box(c, [w + 0.02, 0.8, 1.4], { pos: [0, 1.5, -L / 2 + 1.2 + i * 1.75], r: 0.05, tone: tone + 0.25 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid(c, cyl(0.33, 0.24, 18), { pos: [sx * (w / 2 - 0.05), 0.33, sz * (L / 2 - (bus ? 1.8 : 0.85))], rot: [0, 0, 90], tone: -0.4 });
  for (const sx of [-1, 1]) box(c, [0.32, 0.12, 0.04], { pos: [sx * (w / 2 - 0.3), bus ? 0.6 : 0.62, L / 2 + 0.01], r: 0.03, tone: 0.5, emissive: 0.5 });
  return c;
}
function trafficLight(g, { pos, rot = 0 }) {
  const t = group(pos, rot, g);
  solid(t, cyl(0.06, 3.3, 10), { pos: [0, 1.65, 0], tone: -0.25 });
  box(t, [0.32, 0.9, 0.26], { pos: [0, 2.7, 0.1], r: 0.05, tone: -0.3 });
  box(t, [0.16, 0.16, 0.03], { pos: [0, 3.25, 0.24], r: 0.06, tone: 0.5, emissive: 0.55 });
  box(t, [0.3, 0.42, 0.2], { pos: [0, 1.9, 0.12], r: 0.04, tone: -0.3 });
  box(t, [0.16, 0.16, 0.03], { pos: [0, 2.12, 0.23], r: 0.04, tone: 0.45, emissive: 0.4 });
  return t;
}
export async function s04() {
  await begin('dusk', ['street_lamp_01', 'planter_box_01']);
  const g = group();
  // a street running away from the camera, crossed by a zebra crossing; he stands still in the middle of it
  box(g, [60, 0.03, 120], { pos: [0, -0.027, -40], r: 0.01, tone: -0.02 });
  for (const sx of [-1, 1]) box(g, [4.2, 0.15, 120], { pos: [sx * 6.6, 0, -40], r: 0.02, tone: 0.08 });
  for (let i = 0; i < 8; i++) box(g, [0.55, 0.012, 3.2], { pos: [-3.85 + i * 1.1, 0, 1.25], r: 0.005, tone: 0.3 });
  box(g, [4.4, 0.012, 0.3], { pos: [-2.2, 0, -0.9], r: 0.005, tone: 0.3 });
  for (let i = 0; i < 14; i++) box(g, [0.14, 0.012, 2.2], { pos: [0, 0, -3.5 - i * 5], r: 0.005, tone: 0.28 });
  const R = rng(13);
  for (const sx of [-1, 1]) {
    let z = 7;
    for (let i = 0; i < 9; i++) {
      const w = 9 + R() * 8, h = 12 + R() * 22;
      building(g, { pos: [sx * 13.8, 0, z - w / 2], w, h, d: 10, rot: sx < 0 ? 90 : -90, seed: 30 + i + (sx > 0 ? 50 : 0) });
      z -= w + 0.6;
    }
    for (let i = 0; i < 9; i++) tree(g, { pos: [sx * 7.9, 0.15, 3 - i * 7.5], h: 2.6, r: 0.95, seed: 60 + i + (sx > 0 ? 9 : 0) });
    for (let i = 0; i < 7; i++) P(g, 'street_lamp_01', { pos: [sx * 4.9, 0.15, -3 - i * 9], rot: sx < 0 ? 90 : -90, scale: 1.15 });
    trafficLight(g, { pos: [sx * 4.85, 0.15, sx < 0 ? -0.6 : 3.1], rot: sx < 0 ? 0 : 180 });
  }
  car(g, { pos: [-2.2, 0, -3.5] });
  car(g, { pos: [-2.25, 0, -9.6], tone: -0.02 });
  car(g, { pos: [2.2, 0, -16], rot: 180, bus: true, tone: 0.0 });
  car(g, { pos: [-2.2, 0, -24], tone: -0.18 });
  const SPOT = [0.35, 0, 1.3];
  const hero = person(HERO, { pose: 'pockets', pos: SPOT, heading: 8 * D2R });
  crowd({ n: 30, area: [15, 3.4], center: [0, 1.25], keep: [[SPOT[0], SPOT[2], 1.25]], seed: 11, along: 90 });
  for (const sx of [-1, 1]) crowd({ n: 16, area: [3.2, 30], center: [sx * 6.5, -9], keep: [], seed: 12 + sx, along: 0, y: 0.15 });
  glowOn(HERO, heart(hero), 0.35, 0.16, '#ffd1ec');
  const cam = V3(1.3, 3.6, 10.8);
  shoot({ pos: cam.toArray(), target: [0.1, 0.9, 0.6], fov: 34, focus: cam.distanceTo(boneAt(hero, 'head')), range: 2.6, bokeh: 3 });
}

// 5. Metro car: his heart races.
export async function s05() {
  await begin('plum', []);
  const g = group();
  const L = 16, W = 2.9, H = 2.35;
  box(g, [W, 0.06, L], { pos: [0, -0.05, -L / 2 + 2], r: 0.02, tone: 0.0 });
  box(g, [0.1, H, L], { pos: [-W / 2 - 0.05, 0, -L / 2 + 2], r: 0.02, tone: -0.02 });
  box(g, [0.1, H, L], { pos: [W / 2 + 0.05, 0, -L / 2 + 2], r: 0.02, tone: -0.02 });
  box(g, [W + 0.2, 0.1, L], { pos: [0, H, -L / 2 + 2], r: 0.02, tone: -0.05 });
  for (let i = 0; i < 3; i++) box(g, [0.36, 0.03, L - 1], { pos: [-0.75 + i * 0.75, H - 0.03, -L / 2 + 2], r: 0.01, tone: 0.25, emissive: 0.12 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = 1.0 - i * 2.4;
      box(g, [0.04, 0.75, 1.6], { pos: [s * (W / 2 - 0.01), 1.0, z], r: 0.01, tone: -0.35, emissive: 0.02 });
      box(g, [0.46, 0.44, 1.7], { pos: [s * (W / 2 - 0.25), 0, z], r: 0.04, tone: 0.05 });
      box(g, [0.1, 0.42, 1.7], { pos: [s * (W / 2 - 0.05), 0.44, z], r: 0.04, tone: 0.05 });
    }
    solid(g, cyl(0.02, L - 1, 10), { pos: [s * 0.55, H - 0.35, -L / 2 + 2], rot: [90, 0, 0], tone: 0.2 });
  }
  for (let i = 0; i < 6; i++) solid(g, cyl(0.022, H, 12), { pos: [0, H / 2, 1.2 - i * 2.4], tone: 0.25 });
  // he holds the pole, eyes down; others seated and standing
  // the pole at x = 0, z = -1.2 stands in front of him at his left
  const hero = gripBar(HERO, { pose: 'poleHold', pos: [-0.24, 0, -1.46], heading: 12 * D2R }, 'l', { at: [0, 0, -1.2] });
  // seated along both sides: some on their phones, some resting upright, hands on their thighs
  const seatsL = [['claudia', 'sitPhoneOne', 1.0], ['sophia', 'sitRest', -1.75], ['eric', 'sitPhoneOne', -3.8], ['manuel', 'sitRest', -6.2]];
  const seatsR = [['carla', 'sitPhoneOne', -0.4], ['manuel', 'sitRest', -2.6], ['sophia', 'sitPhoneOne', -4.4], ['claudia', 'sitRest', -6.6]];
  for (const [side, seats] of [[-1, seatsL], [1, seatsR]]) {
    for (const [n, p, z] of seats) {
      const who = fit(n, { pose: seated(p, 0.44), pos: [side * (W / 2 - 0.3), 0, z], heading: -side * 90 * D2R });
      if (p === 'sitPhoneOne') phoneHeld(who, 'r', { glow: 0.4 });
    }
  }
  phoneHeld(fit('eric', { pose: 'phoneOne', pos: [-0.45, 0, -2.6], heading: 160 * D2R }), 'r', { glow: 0.4 });
  gripBar('carla', { pose: 'poleUp', pos: [0.35, 0, -3.8], heading: -20 * D2R }, 'r', { at: [0, 0, -3.6] });
  person('claudia', { pose: 'crossed', pos: [-0.35, 0, -5.2], heading: 30 * D2R });
  statue('mei', { pos: [0.4, 0, -6.4], heading: 200 * D2R });
  glowOn(HERO, heart(hero), 0.55, 0.13, '#ffc4e6');
  shoot({ pos: [0.6, 1.62, 3.4], target: [-0.1, 1.2, -2.2], fov: 38, focus: 4.9, range: 1.2, bokeh: 4 });
}

// 6-7. Open office; the message from the boss.
const OFFICE_PROPS = ['potted_plant_01', 'potted_plant_02', 'binder_notebook', 'stationery_supplies', 'desk_lamp_arm_01', 'drawer_cabinet', 'office_notepads'];
function office() {
  const g = group();
  room(g, { w: 11, d: 9, walls: ['back', 'left'], floorTone: 0.04 });
  for (let i = 0; i < 3; i++) windowPane(g, { pos: [-5.59, 0.9, -2.6 + i * 2.6], w: 2.1, h: 1.55, face: 'x', glow: 0.2 });
  // the boss's glass office at the back right
  const b = group([2.4, 0, -3.25], 0, g);
  for (let i = 0; i <= 5; i++) box(b, [0.05, 2.5, 0.05], { pos: [-2.0 + i * 0.8, 0, 1.25], r: 0.01, tone: -0.15 });
  box(b, [4.05, 0.05, 0.05], { pos: [0, 2.48, 1.25], r: 0.01, tone: -0.15 });
  box(b, [4.05, 0.05, 0.05], { pos: [0, 1.05, 1.25], r: 0.01, tone: -0.15 });
  box(b, [0.05, 2.5, 2.5], { pos: [-2.0, 0, 0], r: 0.01, tone: -0.1 });
  deskSet(b, { pos: [0.6, 0, -0.45], w: 1.6, glow: 0.06 });
  // two rows of desks back to back: the front row faces the back wall, the back row faces the room
  for (let c = 0; c < 3; c++) {
    const x = -3.6 + c * 1.5;
    deskSet(g, { pos: [x, 0, 0.6], rot: 0, glow: 0.06 });
    deskSet(g, { pos: [x, 0, -0.85], rot: 180, glow: 0.06 });
    box(g, [1.45, 0.42, 0.04], { pos: [x, 0.735, -0.125], r: 0.01, tone: 0.0 });
  }
  P(g, 'potted_plant_01', { pos: [-5.0, 0, 2.6] });
  P(g, 'potted_plant_02', { pos: [-0.3, 0, 2.7] });
  P(g, 'drawer_cabinet', { pos: [-1.9, 0, -4.2], scale: 0.7 });
  P(g, 'drawer_cabinet', { pos: [-0.9, 0, -4.2], scale: 0.7 });
}
const DENNIS_AT = [2.9, 0, -3.0];
// the middle of his monitor, where he keeps looking
const MONITOR = [-2.1, 1.02, -0.72];
function officePeople({ heroLook = null } = {}) {
  // [name, x, row]: row 0 sits in front (facing -z), row 1 behind the partition (facing +z)
  const workers = [['claudia', -3.6, 0], ['carla', -2.1, 0], ['manuel', -0.6, 0], ['eric', -3.6, 1], ['sophia', -0.6, 1]];
  const seat = (n, x, row, opts = {}) => {
    const z = row ? -0.85 - 0.66 : 0.6 + 0.66;
    officeChair(scene, { pos: [x, 0, row ? z + 0.06 : z - 0.06], rot: row ? 0 : 180 });
    // hands on the keyboard, not in it
    return fit(n, { pose: seated('desk', 0.46), pos: [x, 0, z], heading: row ? 0 : Math.PI, ...opts }, { props: true });
  };
  for (const [n, x, row] of workers) seat(n, x, row);
  statue('dennis', { pos: DENNIS_AT, heading: -130 * D2R });
  statue('mei', { pos: [0.7, 0, 1.95], heading: -95 * D2R });
  return seat(HERO, -2.1, 1, heroLook ? { lookAt: heroLook } : {});
}
export async function s06() {
  await begin('lavender', OFFICE_PROPS);
  office();
  const hero = officePeople({ heroLook: MONITOR });
  glowOn(HERO, heart(hero), 0.45, 0.15, '#ffd1ec');
  // wide: his desk on the left, the boss's glass office on the right
  const cam = V3(-3.8, 3.0, 4.2);
  shoot({ pos: cam.toArray(), target: [0.0, 0.9, -2.0], fov: 36, focus: cam.distanceTo(boneAt(hero, 'head')), range: 3.0, bokeh: 3 });
}
export async function s07() {
  await begin('plum', OFFICE_PROPS, 'blue');
  office();
  const hero = officePeople({ heroLook: MONITOR });
  const head = boneAt(hero, 'head', [0, 0.06, 0.08]);
  glowOn(HERO, V3(-2.1, 0.95, -0.7), 0.16, 0.42, '#e9f1ff');
  const cam = head.clone().add(V3(-0.75, 0.04, 0.83));
  shoot({ pos: cam.toArray(), target: head.clone().add(V3(-0.02, -0.07, -0.02)).toArray(), fov: 32, focus: cam.distanceTo(head), range: 0.45, bokeh: 6 });
}

// 8. Meeting: everyone is looking. A long table points at the screen wall; he presents at its far end and
// every head along both sides turns to him.
export async function s08() {
  await begin('deep', ['potted_plant_01', 'binder_notebook', 'office_notepads']);
  const g = group();
  room(g, { w: 7, d: 6, walls: ['back', 'left', 'right'] });
  box(g, [1.3, 0.05, 3.6], { pos: [0, 0.71, 0.35], r: 0.03, tone: 0.1 });
  box(g, [0.3, 0.71, 0.3], { pos: [0, 0, -1.0], r: 0.02, tone: -0.1 });
  box(g, [0.3, 0.71, 0.3], { pos: [0, 0, 1.7], r: 0.02, tone: -0.1 });
  // wall screen with a chart
  box(g, [2.6, 1.5, 0.05], { pos: [0.75, 0.95, -2.96], r: 0.02, tone: -0.3 });
  box(g, [2.5, 1.4, 0.01], { pos: [0.75, 1.0, -2.93], r: 0.005, tone: 0.3, emissive: 0.25 });
  [0.35, 0.55, 0.42, 0.8, 0.95].forEach((h, i) => box(g, [0.26, h, 0.012], { pos: [-0.05 + i * 0.4, 1.12, -2.92], r: 0.005, tone: -0.2 }));
  P(g, 'potted_plant_01', { pos: [-3.0, 0, -2.4] });
  P(g, 'office_notepads', { pos: [-0.35, 0.76, -0.2], scale: 0.4 });
  P(g, 'binder_notebook', { pos: [0.3, 0.76, 1.0], rot: 30 });
  const hero = fit(HERO, { pose: 'present', pos: [-0.7, 0, -2.3], heading: 18 * D2R, lookAt: [0, 1.1, 0.4] });
  const eyes = boneAt(hero, 'head', [0, 0.06, 0.08]).toArray();
  // chairs turned a little towards the screen end, heads on him; arms on the table, or hands in the lap
  const seats = [['carla', -1, -0.85], ['eric', -1, 0.35], ['claudia', -1, 1.55], ['sophia', 1, -0.85], ['manuel', 1, 0.35]];
  for (const [n, side, z] of seats) {
    const x = side * 0.9, rot = side < 0 ? 90 + 32 : -90 - 32;
    officeChair(g, { pos: [x, 0, z], rot });
    const pose = n === 'claudia' ? 'sitRest' : side < 0 ? 'meetR' : 'meetL';
    fit(n, { pose: seated(pose, 0.46), pos: [x, 0, z], heading: rot * D2R, lookAt: eyes }, { props: true });
  }
  officeChair(g, { pos: [0.9, 0, 1.55], rot: -90 - 10 });
  statue('dennis', { pos: [2.3, 0, -1.7], heading: -100 * D2R });
  glowOn(HERO, heart(hero), 0.5, 0.14, '#ffc4e6');
  const cam = V3(0.55, 1.75, 3.9);
  shoot({ pos: cam.toArray(), target: [-0.35, 1.12, -1.9], fov: 34, focus: cam.distanceTo(boneAt(hero, 'head')), range: 1.6, bokeh: 4 });
}

// 9. Crisis alone on the emergency stairs.
export async function s09() {
  await begin('night', [], 'night');
  const g = group();
  box(g, [3.4, 0.03, 4], { pos: [0, -0.027, 0.6], r: 0.01, tone: 0.04 });
  stairs(g, { pos: [0, 0, -0.8], n: 9, w: 1.4 });
  box(g, [0.12, 3.4, 6], { pos: [-0.76, 0, -1.4], r: 0.02, tone: -0.02 });
  box(g, [3.4, 3.4, 0.12], { pos: [0, 0, -3.6], r: 0.02, tone: -0.04 });
  solid(g, cyl(0.025, 3.2, 10), { pos: [-0.62, 1.45, -1.9], rot: [-30.4, 0, 0], tone: 0.2 });
  box(g, [0.42, 0.16, 0.04], { pos: [-0.2, 2.6, -3.53], r: 0.01, tone: 0.5, emissive: 0.6 });
  // he sits on the first step, feet on the landing
  const hero = person(HERO, { pose: { ...POSES.hug, hip: { pos: [0, 0.255, -0.4] } }, pos: [0.05, 0, -0.35], heading: 0 });
  glowOn(HERO, heart(hero), 0.6, 0.14, '#7fe8e8');
  shoot({ pos: [1.25, 2.6, 1.9], target: [0.0, 0.55, -0.6], fov: 36, range: 0.9, bokeh: 4 });
}

// 10. Family dinner: "Tá tudo bem, filho?"
export async function s10() {
  await begin('rose', ['dining_table', 'dining_chair_02', 'modern_ceiling_lamp_01', 'modern_wooden_cabinet', 'potted_plant_02', 'standing_picture_frame_01'], 'warm');
  const g = group();
  room(g, { w: 6.4, d: 5.2, walls: ['back', 'left'] });
  windowPane(g, { pos: [-3.29, 0.9, -0.4], w: 1.5, h: 1.45, face: 'x', glow: 0.12 });
  shortCloth(P(g, 'dining_table', { pos: [0, 0, -0.3], scale: 0.86 }));
  P(g, 'modern_ceiling_lamp_01', { pos: [0, 1.25, -0.3] });
  solid(g, ball(0.16), { pos: [0, 1.52, -0.3], tone: 0.5, emissive: 0.5 });
  P(g, 'modern_wooden_cabinet', { pos: [0.4, 0, -2.3], scale: 0.9 });
  P(g, 'standing_picture_frame_01', { pos: [0.9, 0.62, -2.3], rot: 20, scale: 1.2 });
  P(g, 'potted_plant_02', { pos: [-2.6, 0, -2.0] });
  const top = 0.75;
  for (const [x, z] of [[-0.55, -0.62], [0.55, -0.62], [-0.55, 0.02], [0.55, 0.02], [-0.85, -0.3]]) solid(g, cyl(0.12, 0.012, 24), { pos: [x * (x === -0.85 ? 1 : 1), top + 0.006, z], tone: 0.3 });
  for (const [x, z] of [[-0.3, -0.47], [0.66, -0.6], [-0.3, -0.13], [0.75, 0.0]]) solid(g, cyl(0.035, 0.12, 16), { pos: [x, top + 0.06, z], tone: 0.35 });
  solid(g, cyl(0.17, 0.1, 24, 0.12), { pos: [0.1, top + 0.05, -0.3], tone: 0.2 });
  // family: father at the head, mother and him on one side, brother opposite; the sister just arrived with her son
  const seat = (x, z, rot) => P(g, 'dining_chair_02', { pos: [x, 0, z], rot });
  // her chair turned with her toward him
  seat(-1.25, -0.3, 90); seat(-0.55, -1.12, 20); seat(0.47, -1.12, 0); seat(-0.47, 0.52, 180);
  // he holds his glass without drinking, eyes on his plate
  const hero = gripBar(HERO, { pose: seated('tableGlass', 0.47), pos: [0.47, 0, -1.08], heading: 0, lookAt: [0.45, 0.76, -0.6] }, 'l', { at: [0.66, 0, -0.6], r: 0.035 });
  const eyes = boneAt(hero, 'head', [0, 0.06, 0.08]).toArray();
  fit('eric', { pose: seated('table', 0.485), pos: [-1.22, 0, -0.3], heading: 90 * D2R, lookAt: eyes }, { props: true });
  fit('sophia', { pose: seated('table', 0.515), pos: [-0.55, 0, -1.08], heading: 28 * D2R, lookAt: eyes }, { props: true });
  fit('manuel', { pose: seated('table', 0.5), pos: [-0.47, 0, 0.48], heading: Math.PI, lookAt: eyes }, { props: true });
  statue('fabienne', { pos: [1.5, 0, -1.65], heading: -62 * D2R });
  glowOn(HERO, heart(hero), 0.35, 0.13, '#ffd7c4');
  const cam = V3(2.45, 1.55, 2.05);
  shoot({ pos: cam.toArray(), target: [0.15, 0.95, -0.9], fov: 36, focus: cam.distanceTo(boneAt(hero, 'head')), range: 1.6, bokeh: 3.2 });
}

// 12. The friend on the sofa: "Você quer conversar?"
export async function s12() {
  await begin('rose', ['sofa_02', 'coffee_table_round_01', 'tea_set_01', 'throw_pillows_01', 'potted_plant_01', 'potted_plant_02', 'steel_frame_shelves_01'], 'warm');
  const g = group();
  room(g, { w: 6, d: 4.6, walls: ['back', 'left'] });
  windowPane(g, { pos: [-3.09, 0.85, 0.2], w: 1.6, h: 1.5, face: 'x', glow: 0.16 });
  // the sofa stretched to three seats, so the two sit apart with room for their legs
  P(g, 'sofa_02', { pos: [0, 0, -1.65] }).scale.set(1.35, 1, 1.04);
  P(g, 'coffee_table_round_01', { pos: [0, 0, -0.35], scale: 0.6 });
  P(g, 'tea_set_01', { pos: [0, 0.3, -0.35], scale: 0.55 });
  P(g, 'potted_plant_01', { pos: [-1.9, 0, -1.8] });
  P(g, 'potted_plant_02', { pos: [2.2, 0, -0.4] });
  P(g, 'steel_frame_shelves_01', { pos: [1.85, 0, -2.05], scale: 0.085 });
  box(g, [2.8, 0.012, 1.9], { pos: [0, 0, -0.5], r: 0.006, tone: 0.12 });
  const hero = fit(HERO, { pose: { ...seated('sitHands', 0.42, 0.02), head: { rot: [6, 0, 0] } }, pos: [-0.52, 0, -1.6], heading: 16 * D2R });
  // his friend sits back on the sofa, upright and turned to him, feet on the floor, hands resting on her thighs
  // her feet well out past the seat's front, so her shins slope forward clear of it
  fit('carla', { pose: { ...seated('sitNeat', 0.41, -0.1), spine_01: { rot: [-5, -8, 0] }, spine_02: { rot: [-5, -8, 0] }, leg_l: { to: [0.1, 0, 0.5], pole: [0.1, 0.3, 1] }, leg_r: { to: [-0.09, 0, 0.5], pole: [-0.1, 0.3, 1] } }, pos: [0.55, 0, -1.52], heading: -28 * D2R, lookAt: boneAt(hero, 'head').toArray() });
  glowOn(HERO, heart(hero), 0.25, 0.13, '#ffd7c4');
  const cam = V3(1.35, 1.3, 1.75);
  shoot({ pos: cam.toArray(), target: [-0.05, 0.82, -1.5], fov: 34, focus: cam.distanceTo(boneAt(hero, 'head')), range: 1.2, bokeh: 3.5 });
}

// 13. Therapy: two armchairs.
export async function s13() {
  await begin('tide', ['modern_arm_chair_01', 'side_table_01', 'potted_plant_01', 'potted_plant_04', 'steel_frame_shelves_01', 'binder_notebook', 'wall_clock'], 'calm');
  const g = group();
  room(g, { w: 6, d: 4.8, walls: ['back', 'left'] });
  windowPane(g, { pos: [-0.6, 0.85, -2.39], w: 1.8, h: 1.5, face: 'z', glow: 0.22, bars: 2 });
  P(g, 'modern_arm_chair_01', { pos: [-0.85, 0, -0.6], rot: 50, scale: 0.85 });
  P(g, 'modern_arm_chair_01', { pos: [0.95, 0, -0.75], rot: -55, scale: 0.85 });
  P(g, 'side_table_01', { pos: [0.05, 0, -1.55], scale: 0.9 });
  P(g, 'potted_plant_04', { pos: [0.05, 0.5, -1.55] });
  box(g, [0.2, 0.09, 0.12], { pos: [0.22, 0.5, -1.5], r: 0.02, tone: 0.3 });
  P(g, 'potted_plant_01', { pos: [-2.3, 0, -1.8] });
  P(g, 'steel_frame_shelves_01', { pos: [2.1, 0, -2.0], scale: 0.085 });
  P(g, 'wall_clock', { pos: [1.3, 1.95, -2.38] });
  box(g, [3.2, 0.012, 2.4], { pos: [0, 0, -0.6], r: 0.006, tone: 0.12 });
  // he sits forward, forearms on his thighs, hands loosely together; she sits upright, knees together, a notebook
  // on her lap under her hands
  const hero = fit(HERO, { pose: seated('sitHands', 0.49, 0.0), pos: [-0.8, 0, -0.65], heading: 50 * D2R, lookAt: [0.1, 0.35, -0.3] });
  const neat = seated('sitNeat', 0.48, -0.1);
  const t = fit('claudia', { pose: { ...neat, spine_01: { rot: [-5, 0, 0] }, spine_02: { rot: [-5, 0, 0] }, arm_l: { ...neat.arm_l, rel: [0.11, 0.142, 0.3] }, arm_r: { ...neat.arm_r, rel: [-0.1, 0.142, 0.3] },
    // the hands lie flat on the notebook
    hand_l: { aim: [-0.25, -0.1, 1], palm: [0.05, -1, -0.1] }, hand_r: { aim: [0.25, -0.1, 1], palm: [-0.05, -1, -0.1] }, curl_l: 10, curl_r: 10 }, pos: [0.9, 0, -0.8], heading: -55 * D2R, lookAt: boneAt(hero, 'head', [0, 0.06, 0.08]).toArray() });
  const lap = palmOf(t, 'l').c.lerp(palmOf(t, 'r').c, 0.5);
  // the prop file holds an open and a closed binder side by side: only the open one, on her lap
  const nb = P(scene, 'binder_notebook', { pos: [lap.x, 0, lap.z], rot: -55, scale: 0.62 });
  nb.traverse(o => { if (o.name === 'binder_notebook_closed') o.visible = false; });
  // it lies on her thighs: its underside on their top, just under her palms
  nb.updateMatrixWorld(true);
  nb.position.y += boneAt(t, 'hip').y + 0.072 - new THREE.Box3().setFromObject(nb.getObjectByName('binder_notebook')).min.y;
  shoot({ pos: [0.2, 1.55, 3.3], target: [0.0, 0.8, -0.8], fov: 34, focus: 4.1, range: 1.5, bokeh: 3 });
}

// 14. Breathe: by the window, eyes closed.
export async function s14() {
  await begin('tide', ['potted_plant_01', 'potted_plant_02', 'potted_plant_04'], 'calm');
  const g = group();
  room(g, { w: 5, d: 4, walls: ['back', 'left'] });
  windowPane(g, { pos: [0.2, 0.25, -1.99], w: 2.6, h: 2.2, face: 'z', glow: 0.14, bars: 2 });
  P(g, 'potted_plant_01', { pos: [-1.6, 0, -1.4] });
  P(g, 'potted_plant_02', { pos: [1.9, 0, -1.3] });
  box(g, [2.2, 0.012, 1.6], { pos: [0.1, 0, -0.4], r: 0.006, tone: 0.12 });
  const hero = fit(HERO, { pose: 'breathe', pos: [0.1, 0, -0.75], heading: 22 * D2R });
  glowOn(HERO, heart(hero), 0.22, 0.16, '#c9fff0');
  const cam = V3(1.11, 1.58, 1.37);
  shoot({ pos: cam.toArray(), target: [0.05, 1.34, -0.77], fov: 32, focus: cam.distanceTo(boneAt(hero, 'head')), range: 1.0, bokeh: 3.5 });
}

// 15. Weeks later: a walk in the park with his sister and nephew.
export async function s15() {
  await begin('dawn', ['painted_wooden_bench', 'street_lamp_01']);
  const g = group();
  box(g, [60, 0.03, 60], { pos: [0, -0.027, -12], r: 0.01, tone: 0.06 });
  box(g, [3.2, 0.012, 60], { pos: [0, 0, -12], r: 0.005, tone: 0.16 });
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, z = 4 - Math.floor(i / 2) * 4.2;
    tree(g, { pos: [side * (3.6 + (i % 3) * 0.9), 0, z], h: 2.3 + (i % 4) * 0.35, r: 1.0 + (i % 3) * 0.15, seed: 40 + i });
  }
  P(g, 'painted_wooden_bench', { pos: [2.2, 0, -3.5], rot: -90 });
  P(g, 'painted_wooden_bench', { pos: [-2.2, 0, -8.0], rot: 90 });
  P(g, 'street_lamp_01', { pos: [2.1, 0, -6.2] });
  P(g, 'street_lamp_01', { pos: [-2.1, 0, -1.0] });
  person(HERO, { walkAt: 0.55, pos: [-0.45, 0, 0], heading: 180 * D2R });
  statue('fabienne', { pos: [0.45, 0, -0.2], heading: 175 * D2R });
  person('carla', { walkAt: 1.6, pos: [-0.3, 0, -6.5], heading: 0 });
  // two on the far bench, sitting upright, hands on their thighs
  fit('eric', { pose: seated('sitRest', 0.45, 0), pos: [-2.05, 0, -7.75], heading: 90 * D2R });
  fit('sophia', { pose: seated('sitNeat', 0.45, 0), pos: [-2.05, 0, -8.35], heading: 90 * D2R });
  person('claudia', { walkAt: 0.2, pos: [0.6, 0, -11], heading: 10 * D2R });
  shoot({ pos: [1.4, 1.5, 4.6], target: [0.0, 1.0, -0.8], fov: 34, focus: 5.0, range: 2.0, bokeh: 3 });
}

// 16. You are not alone: everyone around him.
export async function s16() {
  await begin('lavender', []);
  const ring = [['carla', 0.8, 0.3], ['sophia', -0.85, -0.05], ['eric', -1.45, -0.85], ['manuel', 1.5, -0.6], ['claudia', 0.45, -1.3], ['dennis', -0.6, -1.85], ['mei', 2.15, -1.6], ['fabienne', -2.2, -1.9]];
  const hero = person(HERO, { pose: 'pockets', pos: [0, 0, 0], heading: 0 });
  const eyes = boneAt(hero, 'head', [0, 0.06, 0.08]).toArray();
  for (const [n, x, z] of ring) {
    // half turned to him, half to the front
    const h = Math.atan2(-x, -z) * 0.55 + Math.atan2(-x * 0.3, 3 - z * 0.2) * 0.45;
    if (['dennis', 'mei', 'fabienne'].includes(n)) statue(n, { pos: [x, 0, z], heading: h });
    else person(n, { pose: idleOf(n, x), pos: [x, 0, z], heading: h, lookAt: eyes });
  }
  crowd({ n: 26, area: [22, 10], center: [0, -8], keep: [[0, 0, 4]], seed: 5, statues: false });
  glowOn(HERO, heart(hero), 0.45, 0.16, '#ffd1ec');
  shoot({ pos: [0.3, 1.65, 5.6], target: [0, 1.05, -0.7], fov: 32, focus: 5.6, range: 2.0, bokeh: 3 });
}
