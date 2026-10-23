import * as THREE from 'three';
import * as E from './engine.js';
import * as M from './motion.js';
import * as builders from './scenes.js';
import { SCENES } from './story.js';
import { PALETTES } from '../story.js';
import { store, emit } from '../store.js';

// Runs the 3D side of the scroll story: builds each scene once (in order, in the background), shows the
// one the reader is on, moves its camera with the scroll and dips to the stage colour between scenes.

const N = SCENES.length;
const recs = new Array(N).fill(null);
const pending = new Array(N).fill(null);
let queue = Promise.resolve();

function ensure(i) {
  if (i < 0 || i >= N) return null;
  if (!pending[i]) {
    const id = SCENES[i].id;
    pending[i] = queue = queue.then(async () => {
      E.startBuild(id);
      await builders[id]();
      const r = E.currentBuild();
      r.group.updateMatrixWorld(true);
      r.head = r.hero ? E.boneAt(r.hero, 'head', [0, 0.06, 0.06]) : null;
      r.heart = r.hero ? E.boneAt(r.hero, 'spine_03', [0.03, -0.04, 0.1]) : null;
      r.motion = M.attach(r);
      recs[i] = r;
      return r;
    });
  }
  return pending[i];
}

const ease = t => t * t * (3 - 2 * t);
const V = a => new THREE.Vector3(...a);
const up = new THREE.Vector3(0, 1, 0);

// The camera of scene i at u (0 entering .. 1 leaving): the storyboard frame, travelled through.
function cameraAt(r, move, u, portrait, lift = 0) {
  const c = r.cam, T = V(c.target), P = V(c.pos);
  let pos, tgt = T.clone();
  const off = P.clone().sub(T);
  const orbit = deg => off.clone().applyAxisAngle(up, deg * Math.PI / 180);
  const e = ease(u);
  switch (move) {
    case 'descend': // from high above the bed down to his face
      pos = T.clone().add(off.clone().multiplyScalar(1.25 - 0.3 * e)).add(new THREE.Vector3(0, 1.1 * (1 - e), 0));
      break;
    case 'crane': // the whole street first, then down to him
      pos = T.clone().add(off.clone().multiplyScalar(1.5 - 0.55 * e)).add(new THREE.Vector3(0, 2.5 * (1 - e), 0));
      break;
    case 'orbit':
      pos = T.clone().add(orbit(-24 + 40 * e).multiplyScalar(1.05 - 0.1 * e));
      break;
    case 'sweep':
      pos = T.clone().add(orbit(18 - 30 * e).multiplyScalar(1.04 - 0.08 * e));
      break;
    case 'push':
      pos = T.clone().add(orbit(3 - 6 * e).multiplyScalar(1.1 - 0.22 * e));
      break;
    case 'follow': { // walking behind them into the park
      const step = new THREE.Vector3(0, 0, -1.6 * e);
      pos = P.clone().add(new THREE.Vector3(0, 0, 0.9)).add(step);
      tgt = T.clone().add(step);
      break;
    }
    case 'reveal': // close on him, then everyone around
      pos = T.clone().add(off.clone().multiplyScalar(0.55 + 0.5 * e));
      break;
    default:
      pos = T.clone().add(orbit(4 - 8 * e).multiplyScalar(1.07 - 0.12 * e));
  }
  tgt.y += lift; // tilts the view up, so the people sit lower in the frame
  let fov = c.fov ?? 30;
  // portrait screens: keep most of the frame's width by opening the vertical angle
  if (portrait) {
    const h = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (16 / 9)) * 0.72;
    fov = Math.min(72, (2 * Math.atan(Math.tan(h / 2) / camera.aspect) * 180) / Math.PI);
  }
  const focus0 = c.focus ?? P.distanceTo(T);
  const focus = Math.max(0.3, focus0 + pos.distanceTo(tgt) - P.distanceTo(T));
  return { pos, tgt, fov, focus, range: c.range ?? 1.2, bokeh: c.bokeh ?? 4 };
}

const camera = E.camera;
const veilColor = new THREE.Color(), tmpColor = new THREE.Color();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function createStage({ canvas, veil, mobile }) {
  E.createRenderer(canvas, { mobile });
  E.setSize(canvas.clientWidth, canvas.clientHeight);
  // resizing clears the canvas, so it happens inside the frame that draws it again (no flash of the page colour)
  let resized = false;
  const resize = () => { resized = true; };
  addEventListener('resize', resize);

  E.onProgress(f => { store.loadProgress = Math.round(f * 70); emit(); });
  await Promise.all([E.loadPeople(!mobile), E.loadPoses(), M.loadMotion()]);
  M.prepareWalk();
  store.loadProgress = 80; emit();
  const start = Math.min(N - 1, Math.max(0, Math.round(store.progress)));
  await ensure(start);
  store.loadProgress = 100; store.loaded = true; emit();
  // the rest in story order from where the reader is
  for (let d = 1; d < N; d++) { ensure(start + d); ensure(start - d); }

  let shown = -1, last = performance.now(), slow = 0, ratio = 1, sideNow = 0, downNow = 0;
  let beat = 0, breathFrom = 0; // heartbeats counted so far; when the scene on screen came on
  // for tests and the video capture: the shared state, how many scenes are built, a switch that keeps the
  // resolution fixed, one that runs frames without drawing them (to start a capture mid-story on the same
  // heartbeat), the heartbeats counted, and a moment (seconds) to hold the people's movement at
  const dda = window.__dda = { store, built: () => recs.filter(Boolean).length, fixedResolution: false, skipRender: false, beat: () => beat, timeOverride: null, rec: i => recs[i] };
  const head = new THREE.Vector3();
  const tick = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    let cleared = false;
    if (resized) { resized = false; cleared = true; E.setSize(canvas.clientWidth, canvas.clientHeight); }
    // keep the frame rate: drop the resolution step by step on machines that cannot hold ~35 fps
    slow = slow * 0.97 + (dt > 0.028 ? 0.03 : 0);
    if (slow > 0.7 && ratio > 0.55 && !dda.fixedResolution) { ratio -= 0.15; slow = 0; cleared = true; E.setPixelScale(ratio); }
    store.smooth += (store.progress - store.smooth) * (1 - Math.exp(-dt * (store.reducedMotion ? 30 : 7)));
    const p = store.smooth;
    let i = Math.min(N - 1, Math.max(0, Math.round(p)));
    // until a scene is built, stay on the nearest one that is
    if (!recs[i]) i = shown >= 0 ? shown : i;
    const r = recs[i];
    if (r) {
      const u = Math.min(1, Math.max(0, p - i + 0.5));
      if (shown !== i) {
        // coming back up into a scene from the next one: its movement has already played (a jump from the menu lands
        // on u = 0.5, give or take a pixel of scroll, and starts it)
        if (r.motion && u > 0.6 && shown > i) breathFrom = now / 1000 - r.motion.skip;
        else breathFrom = now / 1000;
        E.show(r); shown = i;
      }
      // the people move with the time since the scene came on (held still for reduced motion)
      if (r.motion) {
        r.motion.update(dda.timeOverride ?? (store.reducedMotion ? r.motion.still : now / 1000 - breathFrom));
        if (r.motion.moves) r.head = E.boneAt(r.hero, 'head', [0, 0.06, 0.06]);
      }
      const s = SCENES[i];
      // his heart: the rate eases toward the scene's, and the beats are counted
      store.bpm += (s.bpm - store.bpm) * (1 - Math.exp(-dt * 1.5));
      beat += dt * store.bpm / 60;
      const portrait = camera.aspect < 0.9;
      const cam = cameraAt(r, s.move, u, portrait, s.lift);
      if (r.motion?.focusHero) cam.focus = cam.pos.distanceTo(r.head);
      camera.position.copy(cam.pos);
      // on wide screens the text column sits on the left: slide the picture right to make room for it
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const side = portrait ? 0 : (s.side ?? (s.final ? 0 : 0.13));
      // on tall screens the text sits on top: lower the picture instead
      const down = portrait && !s.title && !s.final ? 0.12 : 0;
      const glide = 1 - Math.exp(-dt * 4);
      sideNow += (side - sideNow) * glide;
      downNow += (down - downNow) * glide;
      if (Math.abs(sideNow) > 0.002 || downNow > 0.002) camera.setViewOffset(W, H, -sideNow * W, -downNow * H, W, H);
      else camera.clearViewOffset();
      if (camera.fov !== cam.fov) camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(cam.tgt);
      camera.updateMatrixWorld();
      E.setFocus(cam.focus, cam.range, cam.bokeh);

      // heart and breath on the protagonist's glow
      let k = 1;
      if (s.pulse) { const ph = beat % 1; k = 0.8 + 0.5 * Math.exp(-ph * 10) + (ph > 0.25 ? 0.3 * Math.exp(-(ph - 0.25) * 10) : 0); }
      if (s.breath) { // the cycle starts with a breath in when the scene comes on
        const c = (now / 1000 - breathFrom) % 14, inh = c < 4, hold = c >= 4 && c < 8;
        const b = inh ? c / 4 : hold ? 1 : 1 - (c - 8) / 6;
        store.breath = { label: inh ? 'Inspire' : hold ? 'Segure' : 'Solte', left: inh ? 4 - c : hold ? 8 - c : 14 - c, s: b };
        k = 0.55 + 0.9 * b;
      }
      for (const g of r.glows) if (g.name === E.HERO) E.mats[g.name].uniforms.uGlowAmt.value = g.amt * k;

      // where his head is on screen, for the thoughts around it
      if (r.head) {
        head.copy(r.head).project(camera);
        store.anchors.hero = { x: (head.x * 0.5 + 0.5) * innerWidth, y: (-head.y * 0.5 + 0.5) * innerHeight, visible: head.z < 1 };
      }
    }
    // dip into the stage colour between scenes
    const a = Math.min(N - 1, Math.max(0, Math.floor(p))), b = Math.min(N - 1, a + 1), f = p - Math.floor(p);
    const fade = Math.max(sstep(0.3, 0.5, Math.abs(f - (f > 0.5 ? 1 : 0))), recs[Math.round(Math.min(N - 1, Math.max(0, p)))] ? 0 : 1);
    veil.style.opacity = fade.toFixed(3);
    if (fade > 0.001) veil.style.background = '#' + veilColor.set(PALETTES[SCENES[a].pal].near).lerp(tmpColor.set(PALETTES[SCENES[b].pal].near), sstep(0.35, 0.65, f)).getHexString();

    if ((fade < 0.999 || cleared) && !dda.skipRender) E.renderFrame(dt);
    raf = requestAnimationFrame(tick);
  };
  let raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
}
