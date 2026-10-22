import * as THREE from 'three';
import { CHAPTERS, PALETTES } from '../story.js';
import { store } from '../store.js';
import { Agent, PeopleKit, damp } from './people.js';
import { createPersonMaterial } from './personMaterial.js';
import { createBackdrop } from './backdrop.js';
import { createShadows } from './shadows.js';
import { createGlow } from './glow.js';
import { drawTitle } from './TitleEffect.js';

// Small talking groups around the protagonist. [type, pose, tag]
const GROUPS = [
  { c: [-3.0, -2.1], rot: 0.4, members: [['eric', 'hip'], ['sophia', 'crossed'], ['nathan', 'relaxed']] },
  { c: [3.2, -3.1], rot: 1.2, members: [['carla', 'relaxed2', 'friend'], ['manuel', 'hip2']] },
  { c: [-6.4, -6.8], rot: 2.0, members: [['claudia', 'full'], ['nathan', 'crossed'], ['carla', 'hip']] },
  { c: [5.9, -8.0], rot: 0.2, members: [['sophia', 'relaxed2'], ['eric', 'crossed'], ['manuel', 'full']] },
  { c: [-0.6, -11.0], rot: 1.0, members: [['carla', 'full'], ['eric', 'relaxed']], desktopOnly: true },
  { c: [-10.0, -2.8], rot: 0.7, members: [['manuel', 'crossed'], ['claudia', 'hip2']], desktopOnly: true },
  { c: [9.6, -3.4], rot: 2.4, members: [['nathan', 'hip'], ['sophia', 'full']], desktopOnly: true },
  { c: [-3.9, 3.7], rot: 0.3, members: [['sophia', 'hip'], ['manuel', 'relaxed']] },
  { c: [4.4, 3.3], rot: 0, members: [['eric', 'full']], face: -0.9 },
  { c: [-13.5, -10.5], rot: 0.5, members: [['eric', 'hip'], ['carla', 'crossed']], desktopOnly: true },
  { c: [12.5, -12.0], rot: 1.5, members: [['claudia', 'relaxed'], ['nathan', 'full']], desktopOnly: true },
];
// People crossing the square along fixed lanes.
const WALKERS = [
  { type: 'nathan', z: -4.7, dir: 1, x: -7 },
  { type: 'claudia', z: -5.2, dir: 1, x: 5 },
  { type: 'eric', z: -13.0, dir: -1, x: 3, desktopOnly: true },
  { type: 'carla', z: -13.6, dir: -1, x: -9 },
  { type: 'manuel', z: 7.2, dir: -1, x: 6 },
  { type: 'sophia', z: -9.0, dir: 1, x: -12, desktopOnly: true },
];
const LANE_END = 18;
const UP = new THREE.Vector3(0, 1, 0);
const FRIEND_SPOT = [1.1, 0.3]; // where the friend stands to talk with the protagonist
const CAM_SPACE = 1.7; // nobody walks closer than this to the camera (m)

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function heartbeat(t, bpm) {
  const ph = ((t * bpm) / 60) % 1;
  return Math.exp(-ph * 16) + (ph > 0.2 ? 0.55 * Math.exp(-(ph - 0.2) * 18) : 0);
}

export class Director {
  constructor({ models, scene, camera, shared, effects, mobile }) {
    this.scene = scene;
    this.camera = camera;
    this.shared = shared;
    this.effects = effects;
    this.mobile = mobile;
    this.kit = new PeopleKit(models);
    this.crowdMat = createPersonMaterial(shared);
    this.heroMat = createPersonMaterial(shared, { uLift: { value: 0.04 } });
    this.backdrop = createBackdrop(shared);
    scene.add(this.backdrop);
    this.people = new THREE.Group();
    scene.add(this.people);
    this.agents = [];
    this.spawn();
    this.shadows = createShadows(this.agents.length * 3, shared);
    scene.add(this.shadows.mesh);
    this.glow = createGlow();
    scene.add(this.glow);
    this.palettes = CHAPTERS.map(ch => {
      const p = PALETTES[ch.palette];
      return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, new THREE.Color(v)]));
    });
    this.camPos = new THREE.Vector3().fromArray(CHAPTERS[0].cam.pos);
    this.camTgt = new THREE.Vector3().fromArray(CHAPTERS[0].cam.tgt);
    this.fov = CHAPTERS[0].cam.fov;
    this.time = 0;
    this.mode = null;
    this.glowAmt = 0;
    this.titles = [];
    this.portrait = false;
    this.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    this._pa = new THREE.Vector3(); this._ta = new THREE.Vector3(); this._pb = new THREE.Vector3(); this._tb = new THREE.Vector3();
    this._kp = new THREE.Vector3(); this._kt = new THREE.Vector3();
  }

  add(type, opts) {
    const a = new Agent(this.kit, type, { material: this.crowdMat, ...opts });
    this.agents.push(a);
    this.people.add(a.root);
    return a;
  }

  spawn() {
    this.hero = this.add('claudia', { material: this.heroMat, pos: [0, 0, 0], heading: 0, pose: 'relaxed', role: 'hero' });
    // the two beside the protagonist stand a step back, just behind the opening title
    const m = this.add('manuel', { pos: [-0.72, 0, -0.66], heading: 0.24, pose: 'relaxed2', role: 'partner' });
    const s = this.add('sophia', { pos: [0.74, 0, -0.72], heading: -0.3, pose: 'crossed', role: 'partner' });
    m.away = new THREE.Vector3(-2.3, 0, -1.45); m.awayFace = Math.atan2(-0.7, -0.65);
    s.away = new THREE.Vector3(2.45, 0, -2.4); s.awayFace = Math.atan2(0.75, -0.7);
    m.back = new THREE.Vector3(-0.95, 0, -0.35); s.back = new THREE.Vector3(0.35, 0, -1.0);
    // during the conversation they talk to each other further back, clear of the headline
    m.talk = new THREE.Vector3(2.3, 0, -2.5); s.talk = new THREE.Vector3(2.95, 0, -1.85);
    this.partners = [m, s];
    GROUPS.forEach((g, gi) => {
      if (this.mobile && g.desktopOnly) return;
      const n = g.members.length;
      const members = g.members.map(([type, pose, tag], k) => {
        const ang = g.rot + (k / n) * Math.PI * 2;
        const r = n === 1 ? 0 : n === 2 ? 0.55 : 0.68;
        const x = g.c[0] + Math.sin(ang) * r, z = g.c[1] + Math.cos(ang) * r;
        const heading = n === 1 ? (g.face ?? 0) : Math.atan2(g.c[0] - x, g.c[1] - z);
        const a = this.add(type, { pos: [x, 0, z], heading, pose, role: tag === 'friend' ? 'friend' : 'crowd' });
        a.group = gi;
        if (tag === 'friend') this.friend = a;
        return a;
      });
      members.forEach((a, k) => { a.mates = members.filter(o => o !== a); a.lookIdx = k; });
    });
    WALKERS.forEach(w => {
      if (this.mobile && w.desktopOnly) return;
      const a = this.add(w.type, { pos: [w.x, 0, w.z], heading: w.dir > 0 ? Math.PI / 2 : -Math.PI / 2, pose: 'relaxed', role: 'walker' });
      a.lane = w;
      a.speed = a.T.walkSpeed * 0.95;
      a.walkW = 1;
    });
    this.talkers = [this.agents.find(a => a.group === 0), this.agents.find(a => a.group === 1 && a !== this.friend)].filter(Boolean);
    let i = 0;
    for (const a of this.agents) {
      if (a === this.hero) continue;
      a.orbitR = 2.3 + (i % 6) * 0.95 + Math.random() * 0.3;
      a.orbitDir = 1;
      i++;
    }
  }

  async resize(width, height) {
    this.portrait = width < height * 0.9;
    this.width = width; this.height = height;
    const font = '"Host Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';
    try { await document.fonts.load('700 120px "Host Grotesk"'); } catch (e) { /* fallback font */ }
    this.titles.forEach(t => t && t.tex.dispose());
    this.titles = CHAPTERS.map(ch => (ch.title ? drawTitle(ch.title, width, height, font) : null));
    const te = this.effects.title;
    te.uniforms.get('texel').value.set(1 / this.titles.find(Boolean).W, 1 / this.titles.find(Boolean).H);
  }

  enterMode(mode) {
    this.mode = mode;
    for (const a of this.agents) {
      if (mode === 'stare' || mode === 'close') {
        if (!a.stopPos) a.stopPos = a.pos.clone();
      } else a.stopPos = null;
      if (mode === 'spiral') a.orbitA = Math.atan2(a.pos.x, a.pos.z);
    }
  }

  // Is a ground point inside the headline column of chapter c's framing (left part, near the lens)?
  inTextColumn(c, x, z) {
    if (this.portrait) return false;
    const fov = this.camKey(c, this._kp, this._kt);
    const dir = this._kt.sub(this._kp).normalize();
    const right = this.tmp.d.crossVectors(dir, UP).normalize();
    const rx = x - this._kp.x, ry = 1 - this._kp.y, rz = z - this._kp.z;
    const depth = rx * dir.x + ry * dir.y + rz * dir.z;
    if (depth < 0.3 || depth > 6.5) return false;
    const aspect = (this.width ?? innerWidth) / (this.height ?? innerHeight);
    const ndc = (rx * right.x + rz * right.z) / (depth * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
    return ndc > -1.25 && ndc < 0.1;
  }

  behave(ch, c, dt) {
    const mode = ch.mode;
    const hero = this.hero;
    const heroHead = hero.headWorld(this.tmp.a);
    for (const a of this.agents) {
      if (a === hero) continue;
      a.hasLook = false;
      a.maxSpeed = a.T.walkSpeed;
      if (mode === 'stare' || mode === 'close') {
        const base = a.stopPos ?? a.pos;
        const d = Math.hypot(base.x, base.z);
        let k = mode === 'close' ? Math.max(0, 1 - Math.max(2.1, d * 0.7) / d) : 0;
        // closing in, except where they would stand behind the headline
        if (k > 0 && this.inTextColumn(c, base.x * (1 - k), base.z * (1 - k))) k = 0;
        a.target.set(base.x * (1 - k), 0, base.z * (1 - k));
        a.face = Math.atan2(-a.pos.x, -a.pos.z);
        a.maxSpeed = 0.9;
        a.lookPoint.copy(heroHead); a.hasLook = true;
        continue;
      }
      if (mode === 'spiral') {
        a.orbitA += (a.T.walkSpeed * 1.25 / a.orbitR) * dt;
        const ahead = a.orbitA + 0.5 / a.orbitR;
        a.target.set(Math.sin(ahead) * a.orbitR, 0, Math.cos(ahead) * a.orbitR);
        a.maxSpeed = a.T.walkSpeed * 1.35;
        a.arrive = 0.01;
        a.lookPoint.copy(heroHead); a.hasLook = true;
        continue;
      }
      a.arrive = 0.08;
      if (a.role === 'walker') {
        const w = a.lane;
        if (Math.abs(a.pos.z - w.z) > 0.3 && Math.abs(a.pos.x) < LANE_END - 1) {
          a.target.set(a.pos.x + w.dir * 2, 0, w.z); // rejoin the lane
        } else {
          a.target.set(w.dir * LANE_END, 0, w.z);
        }
        a.maxSpeed = mode === 'calm' ? 0.75 : a.T.walkSpeed * 0.95;
        if (w.dir * a.pos.x > LANE_END - 0.3) { a.pos.x = -w.dir * LANE_END; a.pos.z = w.z; }
        continue;
      }
      if (a.role === 'partner') {
        if (mode === 'gather' || mode === 'calm') { a.target.copy(a.home); a.face = a.homeHeading; a.lookPoint.copy(this.camera.position); a.hasLook = mode === 'gather'; }
        else if (mode === 'together') { a.target.copy(a.back); a.face = Math.atan2(-a.back.x, -a.back.z); a.lookPoint.copy(heroHead); a.hasLook = true; }
        else if (mode === 'talk') {
          const o = this.partners[0] === a ? this.partners[1] : this.partners[0];
          a.target.copy(a.talk); a.face = Math.atan2(o.talk.x - a.talk.x, o.talk.z - a.talk.z);
          o.headWorld(a.lookPoint); a.hasLook = true;
        }
        else { a.target.copy(a.away); a.face = a.awayFace; }
        continue;
      }
      if (a.role === 'friend' && (mode === 'talk' || mode === 'together')) {
        a.target.set(FRIEND_SPOT[0], 0, FRIEND_SPOT[1]);
        a.face = Math.atan2(-FRIEND_SPOT[0], -FRIEND_SPOT[1]);
        a.maxSpeed = 1.0;
        a.lookPoint.copy(heroHead); a.hasLook = true;
        continue;
      }
      // groups: stand at home and look at each other in turns
      a.target.copy(a.home);
      a.face = a.homeHeading;
      if ((mode === 'calm' || mode === 'talk') && this.inTextColumn(c, a.home.x, a.home.z)) {
        // step back from the lens so the headline and the breathing guide stay readable
        const dx = a.home.x - this._kp.x, dz = a.home.z - this._kp.z, l = Math.hypot(dx, dz) || 1;
        a.target.set(a.home.x + (dx / l) * 2.6, 0, a.home.z + (dz / l) * 2.6);
      }
      if (a.mates && a.mates.length) {
        const turn = Math.floor((this.time + a.lookIdx * 2.7) / 4.5);
        const mate = a.mates[turn % a.mates.length];
        mate.headWorld(a.lookPoint);
        a.hasLook = true;
      }
    }

    // protagonist
    hero.pose = ch.heroPose;
    hero.anx = damp(hero.anx, ch.anx ?? 0, 2, dt);
    hero.shake = damp(hero.shake, ch.shake ?? 0, 2, dt);
    hero.hasLook = false;
    let face = 0;
    if (ch.heroLook === 'camera') { hero.lookPoint.copy(this.camera.position); hero.hasLook = true; }
    if (ch.heroLook === 'friend' && this.friend) { this.friend.headWorld(hero.lookPoint); hero.hasLook = true; }
    if ((ch.mode === 'talk' || ch.mode === 'together') && this.friend) {
      const f = this.friend.pos;
      if (Math.hypot(f.x, f.z) < 3) face = Math.atan2(f.x, f.z) * (ch.mode === 'together' ? 0.35 : 1);
    }
    hero.target.set(0, 0, 0);
    hero.face = face;
  }

  camKey(i, outPos, outTgt) {
    const ch = CHAPTERS[i];
    const k = this.portrait ? ch.camMobile ?? ch.cam : ch.cam;
    if (k.orbit) {
      const a = this.time * k.orbit.speed + 0.5;
      outPos.set(Math.sin(a) * k.orbit.radius, k.orbit.height, Math.cos(a) * k.orbit.radius);
    } else outPos.fromArray(k.pos);
    outTgt.fromArray(k.tgt);
    if (!this.portrait && k.side) {
      const dir = this.tmp.c.subVectors(outTgt, outPos).normalize();
      const right = this.tmp.d.crossVectors(dir, UP).normalize();
      outPos.addScaledVector(right, -k.side);
      outTgt.addScaledVector(right, -k.side);
    }
    return k.fov;
  }

  focusDistance(i) {
    const ch = CHAPTERS[i];
    const p = this.tmp.b;
    const b = this.hero.bones;
    if (ch.focus === 'heroHead' && b.head) b.head.getWorldPosition(p);
    else if (ch.focus === 'heroChest' && b.spine_03) b.spine_03.getWorldPosition(p);
    else if (ch.focus === 'pair' && this.friend) { this.hero.headWorld(p); p.add(this.friend.headWorld(this.tmp.c)).multiplyScalar(0.5); }
    else if (typeof ch.focus === 'number') return ch.focus;
    else p.set(0, 1.1, 0);
    return this.camera.position.distanceTo(p);
  }

  update(dtRaw) {
    const dt = Math.min(dtRaw, 1 / 20);
    this.time += dt;
    store.smooth = damp(store.smooth, store.progress, store.reducedMotion ? 30 : 5, dt);
    const p = Math.min(CHAPTERS.length - 1, Math.max(0, store.smooth));
    const i0 = Math.floor(p), i1 = Math.min(CHAPTERS.length - 1, i0 + 1);
    const f = p - i0;
    const t = sstep(0.12, 0.88, f);
    const c = Math.round(p);
    const ch = CHAPTERS[c];
    if (ch.mode !== this.mode) this.enterMode(ch.mode);

    // palette
    const A = this.palettes[i0], B = this.palettes[i1], u = this.shared;
    u.uColorDark.value.copy(A.dark).lerp(B.dark, t);
    u.uColorBright.value.copy(A.bright).lerp(B.bright, t);
    u.uColorFresnel.value.copy(A.fresnel).lerp(B.fresnel, t);
    u.uBgNear.value.copy(A.near).lerp(B.near, t);
    u.uBgMid.value.copy(A.mid).lerp(B.mid, t);
    u.uBgFar.value.copy(A.far).lerp(B.far, t);

    // people
    this.behave(ch, c, dt);
    const breathing = !!ch.breath;
    let breathS = 0;
    if (breathing) {
      const cyc = this.time % 14;
      if (cyc < 4) { breathS = sstep(0, 4, cyc); store.breath = { label: 'Inspire', left: 4 - cyc, s: breathS }; }
      else if (cyc < 8) { breathS = 1; store.breath = { label: 'Segure', left: 8 - cyc, s: 1 }; }
      else { breathS = 1 - sstep(8, 14, cyc); store.breath = { label: 'Solte', left: 14 - cyc, s: breathS }; }
    }
    const avoid = this.camera.position;
    for (const a of this.agents) {
      a.breath = damp(a.breath, breathing ? breathS * (a === this.hero ? 1 : 0.8) : 0, 4, dt);
      if (a === this.hero) a.steer(dt);
      else a.steer(dt, avoid, CAM_SPACE);
      a.animate(dt);
      a.overlay(dt, this.time);
    }

    // camera
    const fa = this.camKey(i0, this._pa, this._ta);
    const fb = this.camKey(i1, this._pb, this._tb);
    this._pa.lerp(this._pb, t);
    this._ta.lerp(this._tb, t);
    const k = store.reducedMotion ? 12 : 3.4;
    this.camPos.set(damp(this.camPos.x, this._pa.x, k, dt), damp(this.camPos.y, this._pa.y, k, dt), damp(this.camPos.z, this._pa.z, k, dt));
    this.camTgt.set(damp(this.camTgt.x, this._ta.x, k, dt), damp(this.camTgt.y, this._ta.y, k, dt), damp(this.camTgt.z, this._ta.z, k, dt));
    this.fov = damp(this.fov, fa + (fb - fa) * t, k, dt);
    const cam = this.camera;
    cam.position.copy(this.camPos);
    cam.lookAt(this.camTgt);
    // a little parallax from the pointer, in camera space
    const px = store.reducedMotion ? 0 : store.pointer.x, py = store.reducedMotion ? 0 : store.pointer.y;
    this.par = this.par ?? { x: 0, y: 0 };
    this.par.x = damp(this.par.x, px, 2.5, dt); this.par.y = damp(this.par.y, py, 2.5, dt);
    cam.translateX(this.par.x * 0.12);
    cam.translateY(this.par.y * 0.06);
    cam.lookAt(this.camTgt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();

    // depth of field
    const dof = this.effects.dof;
    const fd = this.focusDistance(i0) * (1 - t) + this.focusDistance(i1) * t;
    const range = CHAPTERS[i0].range * (1 - t) + CHAPTERS[i1].range * t;
    const bokeh = CHAPTERS[i0].bokeh * (1 - t) + CHAPTERS[i1].bokeh * t;
    dof.cocMaterial.worldFocusDistance = fd;
    dof.cocMaterial.worldFocusRange = range;
    dof.bokehScale = bokeh * (this.mobile ? 0.7 : 1);

    // titles drawn behind the people
    this.updateTitles(p, i0, i1);

    // inner light
    this.updateGlow(ch, dt);

    // contact shadows
    this.updateShadows();

    // screen anchors for the HTML bubbles
    this.updateAnchors();
  }

  updateTitles(p, i0, i1) {
    const te = this.effects.title;
    if (!this.titles.length) return;
    const vis = i => (this.titles[i] ? 1 - sstep(0.16, 0.46, Math.abs(p - i)) : 0);
    const va = vis(i0), vb = i1 !== i0 ? vis(i1) : 0;
    const U = te.uniforms;
    U.get('tA').value = this.titles[i0]?.tex ?? te.blank;
    U.get('tB').value = this.titles[i1]?.tex ?? te.blank;
    U.get('opacityA').value = va;
    U.get('opacityB').value = vb;
    U.get('blurA').value = (1 - va) * 18;
    U.get('blurB').value = (1 - vb) * 18;
    const main = va >= vb ? i0 : i1;
    const spec = CHAPTERS[main].title;
    if (spec) {
      let cutoff = spec.cutoff ?? 8;
      if (spec.cutoffFrom === 'hero') cutoff = this.camera.position.distanceTo(this.tmp.a.set(0, 1.1, 0)) + (spec.cutoffAdd ?? 0.5);
      U.get('cutoff').value = cutoff;
    }
  }

  updateGlow(ch, dt) {
    const hero = this.hero, b = hero.bones;
    const anchor = this.tmp.a;
    let target = 0, k = 4;
    const fwd = this.tmp.c.set(Math.sin(hero.heading), 0, Math.cos(hero.heading));
    if (ch.glow === 'head' && b.head) {
      b.head.getWorldPosition(anchor).addScaledVector(fwd, 0.05).add(this.tmp.d.set(0, 0.09, 0));
      target = 0.75 + 0.15 * Math.sin(this.time * 2.1);
    } else if (b.spine_03) {
      b.spine_03.getWorldPosition(anchor).addScaledVector(fwd, 0.11).add(this.tmp.d.set(0, 0.04, 0));
      if (ch.glow === 'heart') { target = 0.3 + 1.0 * heartbeat(this.time, ch.bpm); k = 22; }
      if (ch.glow === 'breath') target = 0.25 + 0.75 * this.hero.breath;
      if (ch.glow === 'soft') target = 0.22;
    }
    if (ch.glow === 'heart') store.bpm = Math.round(ch.bpm + Math.sin(this.time * 1.3) * 4 + Math.sin(this.time * 3.7) * 2);
    this.glowAmt = damp(this.glowAmt, target, k, dt);
    this.glowPos = this.glowPos ?? anchor.clone();
    this.glowPos.lerp(anchor, 1 - Math.exp(-8 * dt));
    const g = this.glowAmt;
    this.glow.position.copy(this.glowPos);
    const sc = 0.35 + g * 0.5;
    this.glow.scale.set(sc, sc, 1);
    this.glow.material.opacity = Math.min(1, g * 1.1);
    this.glow.visible = g > 0.01;
    const U = this.heroMat.uniforms;
    U.uGlowPos.value.copy(this.glowPos);
    U.uGlowAmt.value = g * 0.9;
    U.uGlowRadius.value = 0.15 + g * 0.05;
  }

  updateShadows() {
    const { mesh, opacity } = this.shadows;
    const { a, m, q, s } = this.tmp;
    let n = 0;
    for (const ag of this.agents) {
      const b = ag.bones;
      q.setFromAxisAngle(UP, ag.heading);
      if (b.hip) b.hip.getWorldPosition(a); else a.copy(ag.pos);
      a.y = 0;
      m.compose(a, q, s.set(0.95, 1, 0.75));
      mesh.setMatrixAt(n, m); opacity[n++] = 0.7;
      for (const fname of ['foot_l', 'foot_r']) {
        const fb = b[fname];
        if (fb) fb.getWorldPosition(a); else a.copy(ag.pos);
        const lift = Math.max(0, a.y - 0.08);
        a.y = 0;
        m.compose(a, q, s.set(0.34, 1, 0.42));
        mesh.setMatrixAt(n, m); opacity[n++] = Math.max(0, 1 - lift * 5);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.attributes.aOpacity.needsUpdate = true;
  }

  updateAnchors() {
    const cam = this.camera, v = this.tmp.a;
    const W = this.width ?? innerWidth, H = this.height ?? innerHeight;
    const put = (name, agent, lift) => {
      if (!agent) return;
      agent.headWorld(v); v.y += lift;
      const behind = this.tmp.b.subVectors(v, cam.position).dot(cam.getWorldDirection(this.tmp.c)) < 0;
      v.project(cam);
      store.anchors[name] = { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: !behind && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
    };
    put('hero', this.hero, 0.16);
    put('friend', this.friend, 0.3);
    this.talkers.forEach((a, i) => put('talker' + i, a, 0.3));
  }
}
