import * as THREE from 'three';
import * as E from './engine.js';

// Movement on top of the baked poses: people walking on paths, a few hand gestures and nods. Every pose is a
// pure function of the time since the scene came on (nothing accumulates from frame to frame), so the video
// capture can start anywhere, frames it does not draw change nothing, and the live site plays the same take.

const BASE = import.meta.env.BASE_URL;
const D2R = Math.PI / 180;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
// 0 before a, 1 after b, eased in between
export const ramp = (t, a, b) => smooth((t - a) / (b - a));
// 0 → 1 → 0: rises from `at` over `rise`, holds, falls over `fall`, again every `period` seconds
export function pulse(t, at, rise, hold, fall, period = Infinity) {
  if (t < at) return 0;
  const c = period === Infinity ? t - at : (t - at) % period;
  if (c < rise) return smooth(c / rise);
  if (c < rise + hold) return 1;
  return 1 - smooth((c - rise - hold) / fall);
}
// a fixed pseudo-random number in 0..1 for (k, n): never Math.random, so every run is the same take
const seed = (k, n = 0) => { const x = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };

// ---------- the walk cycle ----------

// nathan.glb's walk capture walks on the spot; one full stride is frames 4..38 at 30 fps (frame 0 is a T-pose).
// It is sampled once into a table every walker shares.
const CYCLE = 34, FPS = 30, F0 = 4;
// metres covered by one stride cycle at the hero's leg length (the capture walks at 1.08 m/s)
const STRIDE = 1.08 * CYCLE / FPS;
const W = { bones: null, q: null, hip: null };
export function prepareWalk() {
  const clip = E.models[E.HERO].animations.find(a => a.name === 'walk');
  const qt = clip.tracks.filter(t => t.name.endsWith('.quaternion'));
  const ht = clip.tracks.find(t => t.name === 'hip.position');
  W.bones = qt.map(t => t.name.slice(0, -11));
  const B = W.bones.length;
  W.q = new Float32Array(CYCLE * B * 4);
  W.hip = new Float32Array(CYCLE * 3);
  const qi = qt.map(t => t.createInterpolant()), hi = ht.createInterpolant();
  for (let f = 0; f < CYCLE; f++) {
    const time = (F0 + f) / FPS;
    qi.forEach((it, b) => W.q.set(it.evaluate(time), (f * B + b) * 4));
    W.hip.set(hi.evaluate(time), f * 3);
  }
  // the hip sways around its own mean: keep the sway, drop the offset
  for (const c of [0, 2]) {
    let m = 0;
    for (let f = 0; f < CYCLE; f++) m += W.hip[f * 3 + c];
    m /= CYCLE;
    for (let f = 0; f < CYCLE; f++) W.hip[f * 3 + c] -= m;
  }
}
const hipBind = name => E.models[name].scene.getObjectByName('hip').position;
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
// puts a walker's bones at a point of the cycle (0..1, wrapping)
function walkPose(p, phase) {
  const f = (((phase % 1) + 1) % 1) * CYCLE, i = Math.floor(f) % CYCLE, j = (i + 1) % CYCLE, w = f - Math.floor(f);
  const B = W.bones.length;
  for (let b = 0; b < B; b++) {
    const bone = p.walkBones[b];
    if (!bone) continue;
    qa.fromArray(W.q, (i * B + b) * 4);
    qb.fromArray(W.q, (j * B + b) * 4);
    bone.quaternion.slerpQuaternions(qa, qb, w);
  }
  const h = W.hip, s = p.legScale, bind = p.hipBind;
  p.bones.hip.position.set(
    bind.x + (h[i * 3] + (h[j * 3] - h[i * 3]) * w) * s,
    (h[i * 3 + 1] + (h[j * 3 + 1] - h[i * 3 + 1]) * w) * s + p.lift,
    bind.z + (h[i * 3 + 2] + (h[j * 3 + 2] - h[i * 3 + 2]) * w) * s,
  );
}
function asWalker(p) {
  if (p.walkBones) return p;
  p.walkBones = W.bones.map(n => p.bones[n]);
  p.legScale = hipBind(p.name).y / hipBind(E.HERO).y;
  p.hipBind = hipBind(p.name).clone();
  p.stride = STRIDE * p.legScale;
  p.lift = 0;
  // the lift is in the hip's own units (the scans are in centimetres)
  const v = new THREE.Vector3();
  p.lift = soleOf(p) / (p.bones.hip.parent.getWorldScale(v).y / p.root.getWorldScale(v).y);
  return p;
}

// The cycle is the hero's, its hip height scaled by leg length; but the bodies' soles sit at different heights under
// their hips (one walked 3 cm into the ground), so each is lifted (or lowered) until the lowest point of its soles
// over the whole cycle just touches the ground. Measured once per body on the shoes' soles (the lowest 3 cm of the
// feet in the bind pose), in metres.
const SOLE = {};
function soleOf(p) {
  if (SOLE[p.name] !== undefined) return SOLE[p.name];
  const save = Object.fromEntries(Object.entries(p.bones).map(([n, b]) => [n, b.quaternion.clone()]));
  const hip = p.bones.hip.position.clone(), inv = new THREE.Matrix4(), v = new THREE.Vector3();
  p.root.updateMatrixWorld(true);
  inv.copy(p.root.matrixWorld).invert();
  const sole = [];
  p.model.traverse(m => {
    if (!m.isSkinnedMesh) return;
    const feet = new Set(['foot_l', 'ball_l', 'foot_r', 'ball_r'].map(n => m.skeleton.bones.indexOf(p.bones[n])));
    const { position, skinIndex, skinWeight } = m.geometry.attributes, pts = [];
    for (let i = 0; i < position.count; i++) {
      let w = 0;
      for (let c = 0; c < 4; c++) if (feet.has(skinIndex.getComponent(i, c))) w += skinWeight.getComponent(i, c);
      if (w > 0.5) pts.push([i, v.fromBufferAttribute(position, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv).y]);
    }
    const low = Math.min(...pts.map(([, y]) => y));
    for (const [i, y] of pts) if (y < low + 0.03) sole.push([m, i]);
  });
  let min = Infinity;
  for (let f = 0; f < CYCLE; f++) {
    walkPose(p, f / CYCLE);
    p.root.updateMatrixWorld(true);
    for (const [m, i] of sole) min = Math.min(min, m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld).applyMatrix4(inv).y);
  }
  for (const [n, b] of Object.entries(p.bones)) b.quaternion.copy(save[n]);
  p.bones.hip.position.copy(hip);
  p.root.updateMatrixWorld(true);
  return (SOLE[p.name] = Number.isFinite(min) ? -min : 0);
}

// ---------- paths ----------

// A walking line on the ground: from a point and a heading, straight pieces [length] and turns [degrees, radius]
// (positive turns left). at(d) gives where a walker is after d metres, and which way it faces; past the end it
// keeps going straight.
export function path(from, heading, pieces = []) {
  const segs = [];
  let x = from[0], z = from[1], h = heading;
  for (const pc of pieces) {
    const [a, r] = pc;
    if (pc.length === 1) { segs.push({ x, z, h, len: a, k: 0 }); x += Math.sin(h) * a; z += Math.cos(h) * a; }
    else {
      const ang = a * D2R, len = Math.abs(ang) * r, k = ang / len;
      segs.push({ x, z, h, len, k });
      x += (Math.cos(h) - Math.cos(h + ang)) / k; z += (Math.sin(h + ang) - Math.sin(h)) / k; h += ang;
    }
  }
  segs.push({ x, z, h, len: Infinity, k: 0 });
  const out = { x: 0, z: 0, h: 0 };
  return d => {
    let s = segs[0];
    for (const g of segs) { s = g; if (d < g.len) break; d -= g.len; }
    if (s.k === 0) { out.x = s.x + Math.sin(s.h) * d; out.z = s.z + Math.cos(s.h) * d; out.h = s.h; }
    else { out.x = s.x + (Math.cos(s.h) - Math.cos(s.h + s.k * d)) / s.k; out.z = s.z + (Math.sin(s.h + s.k * d) - Math.sin(s.h)) / s.k; out.h = s.h + s.k * d; }
    return out;
  };
}

// ---------- steps up and down (kerbs) ----------

// Where the feet are through the cycle on one body: for each foot, the part of the cycle it is on the ground (from
// its first frame down) and, in the walker's own frame, its ankle, ball and middle once it is flat (three frames
// later; the foot then stays put on the ground). Measured once per body.
const FEET = {};
function feetOf(p) {
  if (FEET[p.name]) return FEET[p.name];
  const save = Object.fromEntries(Object.entries(p.bones).map(([n, b]) => [n, b.quaternion.clone()]));
  const hip = p.bones.hip.position.clone(), inv = new THREE.Matrix4();
  const track = { l: [], r: [] };
  for (let f = 0; f < CYCLE; f++) {
    walkPose(p, f / CYCLE);
    p.root.updateMatrixWorld(true);
    inv.copy(p.root.matrixWorld).invert();
    for (const s of ['l', 'r']) track[s].push(['foot_', 'ball_'].map(b => p.bones[b + s].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)));
  }
  for (const [n, b] of Object.entries(p.bones)) b.quaternion.copy(save[n]);
  p.bones.hip.position.copy(hip);
  p.root.updateMatrixWorld(true);
  const out = {};
  for (const s of ['l', 'r']) {
    const T = track[s], ya = Math.min(...T.map(([a]) => a.y)), yb = Math.min(...T.map(([, b]) => b.y));
    // down: heel or ball within 12 mm of its lowest
    const down = T.map(([a, b]) => Math.min(a.y - ya, b.y - yb) < 0.012);
    const hs = down.findIndex((d, f) => d && !down[(f + CYCLE - 1) % CYCLE]);
    const to = down.findIndex((d, f) => d && !down[(f + 1) % CYCLE]);
    const [a, b] = T[(hs + 3) % CYCLE], mid = a.clone().add(b).multiplyScalar(0.5);
    out[s] = { hs: (hs - 0.5) / CYCLE, on: (((to - hs + CYCLE) % CYCLE) + 1) / CYCLE, flat: 3.5 / CYCLE, pts: [a, b, mid].map(v => [v.x, v.z]) };
  }
  return (FEET[p.name] = out);
}

const lv = { h: new THREE.Vector3(), k: new THREE.Vector3(), a: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), u: new THREE.Vector3() };
const lq = { f: new THREE.Quaternion(), p: new THREE.Quaternion(), r: new THREE.Quaternion(), w: new THREE.Quaternion() };
// Moves one ankle dy metres up (or down) and keeps how the foot is turned in the world: the knee bends (or opens)
// to the new length and the thigh swings to aim the leg at the new spot.
function liftFoot(p, s, dy) {
  const up = p.bones['upperleg_' + s], lo = p.bones['lowerleg_' + s], ft = p.bones['foot_' + s];
  const { h, k, a, t, n, u } = lv;
  up.getWorldPosition(h); lo.getWorldPosition(k); ft.getWorldPosition(a); ft.getWorldQuaternion(lq.f);
  const l1 = k.distanceTo(h), l2 = a.distanceTo(k);
  t.copy(a); t.y += dy;
  // the knee's inner angle for a hip-to-ankle length
  const inner = L => Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + l2 * l2 - L * L) / (2 * l1 * l2))));
  const bend = inner(a.distanceTo(h)) - inner(Math.min(t.distanceTo(h), (l1 + l2) * 0.999));
  // it bends about the axis across the leg (the body's left when the leg is straight)
  n.subVectors(k, h).cross(u.subVectors(a, k));
  u.set(1, 0, 0).applyQuaternion(p.root.quaternion);
  if (n.lengthSq() < 1e-8) n.copy(u); else { n.normalize(); if (n.dot(u) < 0) n.negate(); }
  lq.r.setFromAxisAngle(n, bend);
  a.sub(k).applyQuaternion(lq.r).add(k);
  up.getWorldQuaternion(lq.p);
  lo.quaternion.premultiply(lq.w.copy(lq.p).invert().multiply(lq.r).multiply(lq.p));
  // then the thigh turns the bent leg onto the new spot
  lq.r.setFromUnitVectors(u.subVectors(a, h).normalize(), n.subVectors(t, h).normalize());
  up.parent.getWorldQuaternion(lq.p);
  up.quaternion.premultiply(lq.w.copy(lq.p).invert().multiply(lq.r).multiply(lq.p));
  lo.getWorldQuaternion(lq.p);
  ft.quaternion.copy(lq.p.invert().multiply(lq.f));
}

// The walk cycle is for flat ground. For a walker whose ground has sharp steps (level(x, z), e.g. a kerb), every
// heel strike lands on the height under that foot. The hips rise over the stance of the foot that stepped up (so
// early in its swing the trailing foot, still over the lower ground, is held up to 2.5 cm lower than the cycle has
// it), and sink over the stance before a step down, where the legs only bend more. A foot in the air rises to its
// new height before its toes reach the edge (or drops once its heel is past it). Sets the root's height and lifts
// the feet; a pure function of the distance.
function stepper(p, at, phase0, level) {
  const F = feetOf(p), S = p.stride, ft = new THREE.Vector3();
  // a footfall: where the foot lies once flat, and the height it stands at: the higher ground under its ankle or
  // ball (a foot half over a kerb stands on it, heel or toes over the edge; only a toe tip can touch the kerb's side)
  const strike = (phi, s) => {
    const o = at((phi + F[s].flat - phase0) * S), sn = Math.sin(o.h), cs = Math.cos(o.h);
    const [ankle, ball, mid] = F[s].pts.map(([x, z]) => [o.x + sn * z + cs * x, o.z + cs * z - sn * x]);
    return { phi, s, x: mid[0], z: mid[1], lvl: Math.max(level(...ankle), level(...ball)) };
  };
  return d => {
    const phi = phase0 + d / S, list = [];
    for (const s of ['l', 'r']) { const c0 = Math.floor(phi - F[s].hs); for (let c = c0 - 1; c <= c0 + 2; c++) list.push(strike(c + F[s].hs, s)); }
    list.sort((a, b) => a.phi - b.phi);
    // the last heel strike (B) and the ones either side of it
    let k = 0;
    while (list[k + 1].phi <= phi) k++;
    const A = list[k - 1], B = list[k], C = list[k + 1];
    const from = Math.min(A.lvl, B.lvl), to = Math.min(B.lvl, C.lvl);
    const y = from + (to - from) * smooth((phi - B.phi) / (C.phi - B.phi));
    p.root.position.y = y;
    if (list.every(e => e.lvl === y)) return;
    for (const s of ['l', 'r']) {
      let last = null, next = null;
      for (const e of list) if (e.s === s) { if (e.phi <= phi) last = e; else if (!next) next = e; }
      let g = last.lvl;
      if (phi - last.phi > F[s].on && next.lvl !== last.lvl) {
        // in the air between two heights: where the edge is between the two footfalls, and how far along the ankle
        // is (metres). Up: at the new height by the time the toes (0.2 m ahead of the ankle) reach the edge; down:
        // once the heel (0.1 m behind) is past it. Either over at least 0.35 m of the swing, so the foot never jumps.
        const dx = next.x - last.x, dz = next.z - last.z, len = Math.hypot(dx, dz) || 1;
        let lo = 0, hi = 1;
        for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (level(last.x + dx * m, last.z + dz * m) === last.lvl) lo = m; else hi = m; }
        p.bones['foot_' + s].getWorldPosition(ft);
        const along = ((ft.x - last.x) * dx + (ft.z - last.z) * dz) / len, edge = lo * len;
        const from = Math.min(edge + 0.1, len - 0.35);
        const w = next.lvl > last.lvl ? smooth(along / Math.max(0.35, edge - 0.2)) : smooth((along - from) / (len - from));
        g = last.lvl + (next.lvl - last.lvl) * w;
      }
      if (Math.abs(g - y) > 0.002) liftFoot(p, s, g - y);
    }
  };
}

// ---------- layers ----------

// The rotation every bone of a person had when the scene was built, and the bind pose.
function remember(p) {
  if (p.base) return p;
  p.base = {};
  for (const [n, b] of Object.entries(p.bones)) p.base[n] = b.quaternion.clone();
  p.baseHip = p.bones.hip.position.clone();
  return p;
}
// bones a layer changes go back to the built pose at the start of every frame, before the layers run again
function touch(p, bone) { remember(p); (p.touched ||= new Set()).add(bone); }
const bindOf = name => {
  const out = {};
  E.models[name].scene.traverse(o => { if (o.isBone) out[o.name] = o.quaternion; });
  return out;
};

// A turn of one bone about an axis fixed to the person (their own +x is their left, +y up, +z forward),
// added on top of whatever the bone holds when it runs. angle(t) in degrees.
function turn(p, bone, axis, angle) {
  const b = p.bones[bone];
  touch(p, bone);
  // the person's axis in the bone's parent frame, as built (the root never turns for these)
  p.root.updateMatrixWorld(true);
  const Wq = p.root.getWorldQuaternion(new THREE.Quaternion());
  const Pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
  const ax = new THREE.Vector3(...axis).applyQuaternion(Wq).applyQuaternion(Pq.invert()).normalize();
  const q = new THREE.Quaternion();
  return t => { q.setFromAxisAngle(ax, angle(t) * D2R); b.quaternion.premultiply(q); };
}
// a slow nod (about the left axis) and a little side turn of the head, with seeded phases
function nods(p, { amp = 3, period = 2.8, from = 0, turnAmp = 0, k = 0 } = {}) {
  const ph = seed(k, 1) * period, ph2 = seed(k, 2) * 7;
  const w = t => ramp(t, from, from + 1);
  const a = turn(p, 'head', [1, 0, 0], t => w(t) * amp * Math.sin((2 * Math.PI * (t + ph)) / period));
  const b = turn(p, 'neck', [1, 0, 0], t => w(t) * amp * 0.4 * Math.sin((2 * Math.PI * (t + ph - 0.15)) / period));
  const c = turnAmp ? turn(p, 'head', [0, 1, 0], t => w(t) * turnAmp * Math.sin((2 * Math.PI * (t + ph2)) / 7.3)) : null;
  return t => { a(t); b(t); c?.(t); };
}
// turns the neck and head (part of the way) from where they look towards a point, as w(t) goes 0 → 1
function lookToward(p, target, w, { share = 0.85 } = {}) {
  p.root.updateMatrixWorld(true);
  const head = p.bones.head, bindQ = new THREE.Quaternion();
  // the face's direction now: the bind pose faces the person's +z
  const bind = E.models[p.name].scene.getObjectByName('head');
  bind.updateWorldMatrix(true, false);
  bind.getWorldQuaternion(bindQ);
  const Wq = p.root.getWorldQuaternion(new THREE.Quaternion());
  const face = new THREE.Vector3(0, 0, 1).applyQuaternion(Wq.clone().multiply(new THREE.Quaternion().multiplyQuaternions(Wq.clone().invert(), head.getWorldQuaternion(new THREE.Quaternion())).multiply(bindQ.invert()))).normalize();
  const to = new THREE.Vector3(...target).sub(head.getWorldPosition(new THREE.Vector3())).normalize();
  // in the person's own frame: yaw about up, pitch about their left
  const inv = Wq.clone().invert(), f = face.applyQuaternion(inv), d = to.applyQuaternion(inv);
  let yaw = Math.atan2(d.x, d.z) - Math.atan2(f.x, f.z);
  yaw = Math.max(-50, Math.min(50, (Math.atan2(Math.sin(yaw), Math.cos(yaw)) / D2R) * share));
  const pitch = (Math.asin(-d.y) - Math.asin(-f.y)) / D2R * share;
  // the lift first, then the turn about the body's upright axis (turning a lowered head first would roll it);
  // the chest takes a little of the turn
  const parts = [
    turn(p, 'spine_03', [0, 1, 0], t => w(t) * yaw * 0.2),
    turn(p, 'neck', [1, 0, 0], t => w(t) * pitch * 0.45), turn(p, 'neck', [0, 1, 0], t => w(t) * yaw * 0.35),
    turn(p, 'head', [1, 0, 0], t => w(t) * pitch * 0.55), turn(p, 'head', [0, 1, 0], t => w(t) * yaw * 0.45),
  ];
  return t => { for (const f of parts) f(t); };
}
// the 4-4-6 breath of the breathing scene (in for 4 s, hold 4, out over 6), 0 empty .. 1 full
export function breathAt(t) {
  const c = ((t % 14) + 14) % 14;
  return c < 4 ? smooth(c / 4) : c < 8 ? 1 : 1 - smooth((c - 8) / 6);
}
// ---------- gesture keys (baked in the lab: public/v2/motion.json) ----------

let KEYS = {};
export async function loadMotion() {
  try { KEYS = await (await fetch(`${BASE}v2/motion.json`)).json(); } catch { KEYS = {}; }
}
// Blends a person from the built pose towards key poses; weights(t) gives { key: 0..1 }. Each bone turns about one
// fixed axis from its built rotation to the key's. A hand that rolls about half a turn goes the way the twist bone
// of its forearm goes, even when that is the long way: the short way can be the other way round, which wrings the
// wrist and shows the back of the hand halfway through.
function keys(id, p, weights) {
  const set = KEYS[id]?.find(e => e.k === p.k && e.name === p.name);
  if (!set) { console.warn('no motion keys for', id, p.k, p.name); return () => {}; }
  for (const key of Object.values(set.keys)) for (const bn of Object.keys(key.q)) if (p.bones[bn]) touch(p, bn);
  const ks = Object.fromEntries(Object.entries(set.keys).map(([n, key]) => {
    const list = Object.entries(key.q).filter(([bn]) => p.bones[bn]).map(([bn, v]) => {
      // to = base · turn, the turn taken the short way (w ≥ 0)
      const base = p.base[bn], d = base.clone().invert().multiply(new THREE.Quaternion(...v));
      if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
      const s = Math.sqrt(Math.max(0, 1 - d.w * d.w));
      const axis = s < 1e-6 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(d.x / s, d.y / s, d.z / s);
      return { bn, b: p.bones[bn], base, axis, ang: 2 * Math.acos(Math.min(1, d.w)) };
    });
    for (const e of list) {
      const side = /^hand_([lr])$/.exec(e.bn)?.[1], tw = side && list.find(o => o.bn === `lowerarm_twist_${side}`);
      if (!tw || e.ang < 120 * D2R) continue;
      // both are children of the forearm: compare the turns in its frame
      const vh = e.axis.clone().applyQuaternion(e.base), vt = tw.axis.clone().applyQuaternion(tw.base);
      if (vh.dot(vt) * tw.ang < 0) e.ang -= 2 * Math.PI;
    }
    return [n, list];
  }));
  const q = new THREE.Quaternion();
  return t => {
    const w = weights(t);
    for (const [n, list] of Object.entries(ks)) {
      const a = w[n] || 0;
      if (a > 0) for (const e of list) e.b.quaternion.multiply(q.setFromAxisAngle(e.axis, e.ang * a));
    }
  };
}

// ---------- walkers and crowds ----------

// A walker: distance along its path is dist(t), and the legs follow the distance (so the feet don't slide); one whose
// ground has steps in it (level(x, z): kerbs) goes up and down them (see stepper). where(t) says where it is (cheap,
// for planning a crowd) and apply(t) poses it.
function mover(p, at, dist, { phase0 = 0, level = null } = {}) {
  asWalker(p);
  const where = t => at(dist(t));
  const steps = level ? stepper(p, at, phase0, level) : null;
  const apply = t => {
    const d = dist(t), o = at(d);
    p.root.position.set(o.x, p.root.position.y, o.z);
    p.root.rotation.y = o.h;
    walkPose(p, phase0 + d / p.stride);
    steps?.(d);
  };
  return { p, where, apply, hidden: false };
}
// where each mover is over the first `horizon` seconds, every `step`
function tracksOf(movers, horizon = 25, step = 0.1) {
  const n = Math.round(horizon / step);
  return movers.map(m => { const xs = new Float32Array(n), zs = new Float32Array(n); for (let i = 0; i < n; i++) { const o = m.where(i * step); xs[i] = o.x; zs[i] = o.z; } return { xs, zs }; });
}
// Whether a point keeps r metres from every track (the points binned in 1 m cells, so asking is cheap).
function awayFrom(tracks) {
  const cells = new Map(), key = (cx, cz) => (cx + 1000) * 4000 + cz + 2000;
  for (const { xs, zs } of tracks) for (let i = 0; i < xs.length; i++) {
    const c = key(Math.floor(xs[i]), Math.floor(zs[i]));
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c).push(xs[i], zs[i]);
  }
  return (x, z, r) => {
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) {
      const pts = cells.get(key(cx, cz));
      if (pts) for (let i = 0; i < pts.length; i += 2) if (Math.hypot(pts[i] - x, pts[i + 1] - z) < r) return false;
    }
    return true;
  };
}
// Before a crowd plays, every walker is checked over its first seconds against the people standing still and the
// street furniture ([x, z, radius]) and against each other; anyone who would walk into something is left out of the
// scene (decided before it is shown, so nothing pops). Returns what poses the rest.
function clearPaths(movers, still, { gap = 0.55, horizon = 25, step = 0.1, tracks = tracksOf(movers, horizon, step) } = {}) {
  const n = tracks[0]?.xs.length ?? 0;
  // walkers that would pass through something standing (people, poles, trunks: [x, z, radius])
  movers.forEach((m, a) => {
    const { xs, zs } = tracks[a];
    for (let i = 0; i < n && !m.hidden; i++) for (const [x, z, r] of still) if (Math.hypot(xs[i] - x, zs[i] - z) < r) { m.hidden = true; break; }
  });
  // and pairs of walkers that would bump: the later one in the list stays out
  for (let a = 0; a < movers.length; a++) {
    if (movers[a].hidden) continue;
    for (let b = a + 1; b < movers.length; b++) {
      if (movers[b].hidden) continue;
      const A = tracks[a], B = tracks[b];
      for (let i = 0; i < n; i++) if (Math.hypot(A.xs[i] - B.xs[i], A.zs[i] - B.zs[i]) < gap) { movers[b].hidden = true; break; }
    }
  }
  for (const m of movers) if (m.hidden) m.p.root.visible = false;
  return movers.filter(m => !m.hidden).map(m => m.apply);
}
// spreads walkers sharing a lane so each keeps `space` metres from the one ahead (positions along the lane)
function spaceOut(list, key, space) {
  list.sort((a, b) => a[key] - b[key]);
  for (let i = 1; i < list.length; i++) if (list[i][key] - list[i - 1][key] < space) list[i][key] = list[i - 1][key] + space;
}

// ---------- the scenes ----------

// Each entry builds the moving parts of one scene from its built record and returns { update(t, u), ... }.
// `still` is the time shown with reduced motion; `skip` is where a scene entered from below starts.
const people = (r, name, i = 0) => r.people.filter(p => p.name === name)[i];
const SCRIPT = {
  // The meeting: he presents, opening a hand to the table and then turning from the screen to them, looking
  // round the faces; the people round the table nod along.
  s08(r) {
    const parts = r.people.filter(p => p !== r.hero).map(p => nods(p, { amp: 2.2, period: 2.4 + seed(p.k, 4) * 1.2, k: p.k, turnAmp: 1.5, from: seed(p.k, 5) }));
    parts.push(keys('s08', r.hero, t => ({ open: pulse(t, 0.4, 0.7, 1.7, 0.8, 6.5), turn: pulse(t, 3.0, 0.8, 1.7, 0.9, 6.5) })));
    parts.push(turn(r.hero, 'head', [0, 1, 0], t => ramp(t, 0, 1) * 9 * Math.sin((2 * Math.PI * (t - 0.6)) / 6.5)));
    return { parts, still: 0, skip: 0 };
  },
  // Dinner: his family keep looking at him, nodding a little as they talk.
  s10(r) {
    const parts = r.people.filter(p => p !== r.hero).map(p => nods(p, { amp: 2, period: 2.6 + seed(p.k, 4), k: p.k + 10, turnAmp: 1.5, from: 0.3 }));
    return { parts, still: 0, skip: 0 };
  },
  // "Você quer conversar?": she reaches an open hand out to him and nods; he slowly lifts his head to her.
  s12(r) {
    const carla = people(r, 'carla'), parts = [];
    if (carla) {
      parts.push(keys('s12', carla, t => ({ open: 0.9 * pulse(t, 0.9, 0.9, 2.2, 1.1, 8) })));
      parts.push(nods(carla, { amp: 2.5, period: 2.5, k: 21, from: 2.2 }));
      parts.push(lookToward(r.hero, E.boneAt(carla, 'head', [0, 0.06, 0.08]).toArray(), t => ramp(t, 1.4, 3.4), { share: 0.7 }));
    }
    return { parts, still: 0, skip: 0 };
  },
  // Therapy: she talks with one hand, nodding; he listens and nods back.
  s13(r) {
    const claudia = people(r, 'claudia'), parts = [nods(r.hero, { amp: 2, period: 3.2, k: 31, from: 1.2 })];
    if (claudia) {
      parts.push(keys('s13', claudia, t => ({ explain: pulse(t, 0.7, 0.7, 1.7, 0.9, 7) })));
      parts.push(nods(claudia, { amp: 3, period: 2.3, k: 32, from: 0.4, turnAmp: 1.5 }));
    }
    return { parts, still: 0, skip: 0 };
  },
  // Breathe: his chest rises with the 4-4-6 breath the screen counts.
  s14(r) {
    const h = r.hero, b = breathAt;
    const parts = [
      turn(h, 'spine_02', [1, 0, 0], t => -0.8 * b(t)), turn(h, 'spine_03', [1, 0, 0], t => -1.6 * b(t)),
      turn(h, 'shoulder_l', [0, 0, 1], t => 1.2 * b(t)), turn(h, 'shoulder_r', [0, 0, 1], t => -1.2 * b(t)),
      turn(h, 'neck', [1, 0, 0], t => 1.2 * b(t)), turn(h, 'head', [1, 0, 0], t => 0.9 * b(t)),
    ];
    return { parts, still: 0, skip: 0 };
  },
  // Sunday in the park: he walks up the path behind the camera and stops beside his sister.
  s15(r) {
    const hero = remember(asWalker(r.hero));
    const v = 1.08, end = new THREE.Vector3(...hero.pos), D = 2.7, T = 0.8;
    // speed v, then easing to a stop over T seconds: d(t) reaches D at tEnd
    const t1 = (D - (v * T) / 3) / v, tEnd = t1 + T;
    const dist = t => (t < t1 ? v * t : v * t1 + ((v * T) / 3) * (1 - Math.pow(1 - clamp01((t - t1) / T), 3)));
    const at = path([end.x, end.z - Math.cos(hero.heading) * D], hero.heading, []);
    // the stride ends with one foot under him and the other passing it
    const phase0 = hero.stopPhase - D / hero.stride;
    const stand = E.bakedPose('s16', 0), bind = bindOf(hero.name);
    const standQ = {};
    for (const n of Object.keys(hero.bones)) standQ[n] = stand.q[n] ? new THREE.Quaternion(...stand.q[n]) : bind[n].clone();
    const standHip = new THREE.Vector3(...stand.hip);
    const bones = Object.entries(hero.bones);
    const tb = tEnd - 0.35, te = tEnd + 0.45;
    const lock = new THREE.Vector3(), foot = new THREE.Vector3();
    let lockFoot = null;
    const pose = (t, locked) => {
      const d = dist(t), o = at(d);
      hero.root.position.set(o.x, 0, o.z);
      hero.root.rotation.y = o.h;
      // from the built pose every frame (the bones the walk leaves alone are blended below)
      for (const [n, b] of bones) b.quaternion.copy(hero.base[n]);
      walkPose(hero, phase0 + d / hero.stride);
      const w = ramp(t, tb, te);
      if (w > 0) {
        for (const [n, b] of bones) b.quaternion.slerp(standQ[n], w);
        hero.bones.hip.position.lerp(standHip, w);
      }
      // the foot he stands on stays where it landed while he settles
      if (locked && t > tb) {
        hero.root.updateMatrixWorld(true);
        hero.bones[lockFoot].getWorldPosition(foot);
        hero.root.position.x += lock.x - foot.x;
        hero.root.position.z += lock.z - foot.z;
      }
    };
    // which foot is down when the settling starts, and where
    pose(tb, false);
    hero.root.updateMatrixWorld(true);
    const fl = hero.bones.foot_l.getWorldPosition(new THREE.Vector3()), fr = hero.bones.foot_r.getWorldPosition(new THREE.Vector3());
    lockFoot = fl.y < fr.y ? 'foot_l' : 'foot_r';
    lock.copy(lockFoot === 'foot_l' ? fl : fr);
    const parts = [t => pose(t, true)];
    // Carla comes down the path towards the camera on the left; Claudia walks away on the right, far off
    const carla = people(r, 'carla'), claudia = people(r, 'claudia');
    if (carla) parts.push(mover(carla, path([-1.3, carla.pos[2]], 0), t => 1.1 * Math.min(t, 30), { phase0: seed(1) }).apply);
    if (claudia) parts.push(mover(claudia, path([1.25, claudia.pos[2]], Math.PI), t => 1.05 * Math.min(t, 30), { phase0: seed(2) }).apply);
    // the two on the bench talk: small nods
    for (const [n, k] of [['eric', 3], ['sophia', 4]]) { const p = people(r, n); if (p) parts.push(nods(remember(p), { amp: 2.5, period: 3.1, k, turnAmp: 3 })); }
    return { parts, still: te + 1, skip: te + 1, focusHero: true, moves: true };
  },
  // The crossing: everyone walks on and over the street, steps up the far kerb and walks off down the pavement;
  // the people who were standing wait at the kerbs. He stays where he is, and the crossing slowly empties round him.
  s04(r) {
    const SPOT = r.hero.pos;
    // the pavements are 15 cm up, from |x| = 4.5 out
    const level = x => (Math.abs(x) > 4.5 ? 0.15 : 0);
    const crossing = r.people.filter(p => p !== r.hero && p.pos[1] === 0);
    const pavement = r.people.filter(p => p.pos[1] !== 0);
    const still = [[SPOT[0], SPOT[2], 0.85]];
    // street furniture: traffic lights, lamps and trunks
    for (const sx of [-1, 1]) {
      still.push([sx * 4.85, sx < 0 ? -0.6 : 3.1, 0.4]);
      for (let i = 0; i < 7; i++) still.push([sx * 4.9, -3 - i * 9, 0.4]);
      // a trunk is 0.1 m round at the foot
      for (let i = 0; i < 9; i++) still.push([sx * 7.9, 3 - i * 7.5, 0.36]);
    }
    const movers = [];
    // over the crossing: two lanes each way, kept clear of him; each lane steps up the kerb and turns down its own
    // line of the pavement (towards the camera on the right, away on the left), round the traffic light. Both lanes
    // of a way walk at one speed and take turns, 0.7 m apart, so neighbours never close in on each other.
    const LANES = {
      1: { v: 1.08, lanes: [{ z: 2.6, exit: 5.4 }, { z: 2.2, exit: 6.0 }] },
      [-1]: { v: 1.06, lanes: [{ z: -0.05, exit: -5.4 }, { z: 0.4, exit: -6.0 }] },
    };
    const walkers = crossing.filter(p => p.walkAt !== null).map(p => ({ p, dir: Math.sin(p.heading) >= 0 ? 1 : -1, x: p.pos[0] }));
    for (const dir of [1, -1]) {
      const { v, lanes } = LANES[dir], mine = walkers.filter(w => w.dir === dir);
      // some start further back, still on the near pavement, so people keep stepping onto the crossing for longer
      // (no nearer than 0.8 m from the lane's start, so nobody's back foot is in the shop fronts at |x| = 8.8)
      for (const w of mine) w.s = Math.max(0.8, dir * (w.x + dir * 9) - 3.5 * seed(w.p.k, 9));
      spaceOut(mine, 's', 0.7);
      mine.forEach((w, i) => {
        const L = lanes[i % 2], r0 = 0.55, straight = Math.abs(L.exit) - r0 + 9;
        const at = path([-dir * 9, L.z], dir * Math.PI / 2, [[straight], [-90, r0]]);
        movers.push(mover(w.p, at, t => w.s + v * t, { phase0: seed(w.p.k, 5), level }));
      });
    }
    // along the pavements: towards the camera on the outer line, away on the inner one
    for (const side of [-1, 1]) {
      const mine = pavement.filter(p => p.walkAt !== null && Math.sign(p.pos[0]) === side).map(p => ({ p, dir: Math.cos(p.heading) >= 0 ? 1 : -1, z: p.pos[2] }));
      for (const dir of [1, -1]) {
        const lane = mine.filter(w => w.dir === dir);
        spaceOut(lane, 'z', 1.1);
        for (const w of lane) {
          const at = path([side * (dir > 0 ? 7.35 : 6.65), w.z], dir > 0 ? 0 : Math.PI, []);
          movers.push(mover(w.p, at, t => (dir > 0 ? 1.08 : 0.98) * t, { phase0: seed(w.p.k, 6) }));
        }
      }
    }
    // The people who stood stay out of everyone's way: 0.65 m from wherever anyone walks over the next 25 s, so
    // nobody has to be left out for them. The ones from the road wait on the kerbs (their own side first, near the
    // crossing), the rest by the shop fronts.
    const tracks = tracksOf(movers), away = awayFrom(tracks);
    const free = (x, z) => away(x, z, 0.65) && still.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) >= sr + 0.1);
    const place = (s, spots, face) => {
      const at = spots.find(([x, z]) => free(x, z));
      if (!at) { s.root.visible = false; return; }
      s.root.position.set(at[0], 0.15, at[1]);
      if (face !== undefined) s.root.rotation.y = face(at[0]);
      still.push([at[0], at[1], 0.6]);
    };
    const kerb = side => {
      const out = [];
      for (const x of [4.95, 5.6]) for (let z = -1.5; z <= 4.01; z += 0.25) out.push([side * x, z, Math.abs(z - 1.3) + (x - 4.95)]);
      return out.sort((a, b) => a[2] - b[2]);
    };
    const shops = (side, z0) => {
      const out = [];
      for (let i = 0; i <= 40; i++) out.push([side * 8.3, z0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.35]);
      return out;
    };
    const stillHere = [...crossing.filter(p => p.walkAt === null), ...r.statues.filter(s => s.pos[1] === 0)];
    stillHere.forEach((s, i) => {
      const side = s.pos[0] < 0 ? -1 : 1;
      place(s, [...kerb(side), ...kerb(-side), ...shops(side, 1.3), ...shops(-side, 1.3)], x => (x < 0 ? 90 : -90) * D2R + (seed(i, 3) - 0.5) * 0.5);
    });
    // the pavement crowd's standing people move back to the shop fronts
    for (const s of [...pavement.filter(p => p.walkAt === null), ...r.statues.filter(s => s.pos[1] !== 0)]) place(s, shops(s.pos[0] < 0 ? -1 : 1, s.pos[2]));
    const parts = clearPaths(movers, still, { tracks });
    return { parts, still: 0, skip: 0 };
  },
  // The end: behind the people around him, the city keeps walking past, left and right, out of sight and back.
  s16(r) {
    const ring = r.people.filter(p => p.walkAt === null);
    const still = [...ring.map(p => [p.root.position.x, p.root.position.z, 0.8]), ...r.statues.map(s => [s.pos[0], s.pos[2], 0.8])];
    const walkers = r.people.filter(p => p.walkAt !== null).map(p => ({ p, dir: seed(p.k, 7) < 0.5 ? 1 : -1, z: p.pos[2], x: p.pos[0] }));
    // lanes across the back: walkers keep 0.85 m from anyone standing (a phone held out reaches 0.4 m forward) and
    // 0.6 m from the other way's lanes
    const taken = [];
    for (const w of walkers) {
      const ok = z => still.every(([, sz]) => Math.abs(sz - z) > 0.85) && taken.every(([d, tz]) => d === w.dir || Math.abs(tz - z) > 0.6);
      let z = null;
      for (let k = 0; k <= 30 && z === null; k++) for (const c of [w.z + k * 0.1, w.z - k * 0.1]) if (c < -3.2 && c > -14 && ok(c)) { z = c; break; }
      if (z === null) { w.p.root.visible = false; continue; }
      w.z = z; taken.push([w.dir, z]);
    }
    const live = walkers.filter(w => w.p.root.visible);
    // Each lane loops round out of sight: past the side of the widest screen (32:9) at its depth, seen from the
    // farthest the camera goes. Lanes one way closer than 0.6 m share one loop (and one speed), so they keep their
    // distance for good.
    const c = r.cam, camZ = c.pos[2] + 0.1 * (c.pos[2] - c.target[2]), wide = Math.tan((c.fov * D2R) / 2) * 3.6;
    for (const dir of [1, -1]) {
      const mine = live.filter(w => w.dir === dir).sort((a, b) => a.z - b.z);
      for (let i = 0; i < mine.length;) {
        let j = i;
        while (j + 1 < mine.length && mine[j + 1].z - mine[j].z < 0.6) j++;
        const half = Math.max(12, ...mine.slice(i, j + 1).map(w => (camZ - w.z) * wide + 1.2));
        for (let m = i; m <= j; m++) mine[m].half = half;
        i = j + 1;
      }
    }
    const movers = [];
    for (const w of live) {
      const v = w.dir > 0 ? 1.06 : 0.98, span = 2 * w.half;
      const at = d => { const x = ((((w.x + w.half + w.dir * d) % span) + span) % span) - w.half; return { x, z: w.z, h: w.dir * Math.PI / 2 }; };
      movers.push(mover(w.p, at, t => v * t, { phase0: seed(w.p.k, 8) }));
    }
    const parts = clearPaths(movers, still, { gap: 0.5, horizon: 30 });
    return { parts, still: 0, skip: 0 };
  },
};

// Builds the moving parts of a built scene (null when it has none).
export function attach(r) {
  const make = SCRIPT[r.id];
  if (!make || !W.bones) return null;
  // the stop of the walk: a cycle point where the feet pass each other, measured once on the hero
  if (r.hero && r.hero.stopPhase === undefined) measureStop(asWalker(r.hero));
  const m = make(r);
  const reset = r.people.filter(p => p.touched).map(p => [...p.touched].map(n => [p.bones[n].quaternion, p.base[n]]));
  m.update = t => {
    for (const list of reset) for (const [q, b] of list) q.copy(b);
    for (const f of m.parts) f(t);
  };
  m.update(0);
  return m;
}

// Finds the point of the walk cycle where his feet are level front to back (the one in the air passing the one
// he stands on), the right moment to stop.
function measureStop(p) {
  const save = Object.fromEntries(Object.entries(p.bones).map(([n, b]) => [n, b.quaternion.clone()]));
  const hip = p.bones.hip.position.clone();
  const fl = new THREE.Vector3(), fr = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  let best = 0, bestD = Infinity;
  for (let f = 0; f < CYCLE; f++) {
    walkPose(p, f / CYCLE);
    p.root.updateMatrixWorld(true);
    inv.copy(p.root.matrixWorld).invert();
    p.bones.foot_l.getWorldPosition(fl).applyMatrix4(inv);
    p.bones.foot_r.getWorldPosition(fr).applyMatrix4(inv);
    const d = Math.abs(fl.z - fr.z) + Math.abs(fl.y - fr.y) * 0.2;
    // the left foot down and the right one passing
    if (fl.y < fr.y && d < bestD) { bestD = d; best = f / CYCLE; }
  }
  for (const [n, b] of Object.entries(p.bones)) b.quaternion.copy(save[n]);
  p.bones.hip.position.copy(hip);
  p.root.updateMatrixWorld(true);
  p.stopPhase = best;
}
