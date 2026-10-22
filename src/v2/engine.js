import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EffectComposer, RenderPass, EffectPass, DepthOfFieldEffect, BloomEffect, VignetteEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { createSharedUniforms, createPersonMaterial } from '../three/personMaterial.js';
import { createBackdrop } from '../three/backdrop.js';
import { GrainEffect } from '../three/GrainEffect.js';
import { stageUniformsGLSL, stageFunctionsGLSL } from '../three/stage.glsl.js';
import { seated } from './posing.js';
export { seated };

// The storyboard renderer, for the site: the same unlit people, props and post effects as the approved
// storyboard frames, one scene at a time. Poses come baked (public/v2/poses.json), so the site needs no
// motion-capture files or IK: every person() call takes the next baked pose of the scene being built.

THREE.ColorManagement.enabled = false;
const BASE = import.meta.env.BASE_URL;
export const PEOPLE = ['claudia', 'carla', 'eric', 'sophia', 'nathan', 'manuel'];
// posed scans without a skeleton: Dennis in a suit, Mei with a binder, Fabienne holding Percy
export const STATUES = ['dennis', 'mei', 'fabienne'];
export const HERO = 'nathan';

export const shared = createSharedUniforms();
shared.uPropDark = { value: new THREE.Color('#5b62c8') };
shared.uPropBright = { value: new THREE.Color('#c9cdf6') };

export const world = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
world.add(createBackdrop(shared));
// a real floor at y = 0 with the stage gradient, so the AO pass has a surface to darken under people
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: shared,
  vertexShader: 'varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: `${stageUniformsGLSL}
    varying vec3 vWorld;
    ${stageFunctionsGLSL}
    void main(){ vec3 rd = normalize(vWorld - cameraPosition); gl_FragColor = vec4(envColor(cameraPosition, rd), 1.0); }`,
}));
floor.renderOrder = -9;
world.add(floor);

// ---------- renderer and post effects ----------

let renderer, composer, ao, dof, baseRatio = 1, bokehMul = 1;
export function createRenderer(canvas, { mobile = false } = {}) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  baseRatio = Math.min(devicePixelRatio, mobile ? 1.25 : 1.5);
  bokehMul = mobile ? 0.6 : 1; // the half-resolution blur on phones shows halos at full strength
  renderer.setPixelRatio(baseRatio);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: mobile ? 0 : 4 });
  composer.addPass(new RenderPass(world, camera));
  ao = new N8AOPostPass(world, camera, 2, 2);
  ao.configuration.aoRadius = 0.6;
  ao.configuration.distanceFalloff = 0.6;
  ao.configuration.intensity = 2.0;
  ao.configuration.color = new THREE.Color('#2a2f80');
  ao.configuration.halfRes = mobile;
  ao.setQualityMode(mobile ? 'Low' : 'Medium');
  composer.addPass(ao);
  dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 4, worldFocusRange: 1.2, bokehScale: 4, resolutionScale: mobile ? 0.5 : 0.75 });
  const bloom = new BloomEffect({ intensity: 0.6, luminanceThreshold: 0.93, luminanceSmoothing: 0.12, mipmapBlur: true, radius: 0.75 });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.3 });
  const grain = new GrainEffect({ opacity: 0.06 });
  // one pass after the AO, drawn straight to the screen: a second pass that reads depth would draw into the
  // buffer that holds the depth texture when there is no multisampling (phones), and WebGL drops that draw
  composer.addPass(new EffectPass(camera, dof, bloom, vignette, grain));
  return renderer;
}
export function setSize(w, h) {
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
export function renderFrame(dt) { composer.render(dt); }
// a fraction of the starting pixel ratio, for slow machines
export function setPixelScale(f) {
  renderer.setPixelRatio(baseRatio * f);
  const s = renderer.getSize(new THREE.Vector2());
  setSize(s.x, s.y);
}
export function setFocus(distance, range, bokeh) {
  dof.cocMaterial.worldFocusDistance = distance;
  dof.cocMaterial.worldFocusRange = range;
  dof.bokehScale = bokeh * bokehMul;
}

// ---------- assets ----------

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();
export const models = {};
export const mats = {};
const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); // a flat normal, no cavity
flat.needsUpdate = true;
let progressCb = () => {};
export const onProgress = cb => { progressCb = cb; };

// The nine people, each with a placeholder detail map until its own arrives (the hero's at 4K).
export async function loadPeople(hiDetail = true) {
  const names = [...PEOPLE, ...STATUES];
  let done = 0;
  await Promise.all(names.map(async n => {
    models[n] = await loader.loadAsync(`${BASE}models/${n}.glb`);
    mats[n] = createPersonMaterial(shared, { uDetail: { value: flat } });
    progressCb(++done / names.length);
  }));
  const detail = n => {
    const url = n === HERO && hiDetail ? `${BASE}detail4k/${n}.webp` : `${BASE}detail/${n}.webp`;
    return texLoader.loadAsync(url).then(t => {
      t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      mats[n].uniforms.uDetail.value = t;
    });
  };
  // the hero first; the others follow in the background
  await detail(HERO);
  Promise.all(names.filter(n => n !== HERO).map(detail)).catch(e => console.warn(e));
}

let baked = null;
export async function loadPoses() {
  baked = await (await fetch(`${BASE}v2/poses.json`)).json();
}

// ---------- building a scene ----------

// The scene being built: its own group, palette, glows, camera and hero. scenes.js adds to `scene`.
export let scene = null;
let rec = null, k = 0;
export function startBuild(id) {
  scene = new THREE.Group();
  rec = { id, group: scene, palette: null, glows: [], cam: null, hero: null };
  k = 0;
  return rec;
}
export const currentBuild = () => rec;

// A person in the baked pose of the k-th person() call of this scene.
export function person(name, { pos = [0, 0, 0], heading = 0 } = {}) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(models[name].scene);
  root.add(model);
  const bones = {};
  model.traverse(o => {
    if (o.isSkinnedMesh) { o.material = mats[name]; o.frustumCulled = false; }
    if (o.isBone) bones[o.name] = o;
  });
  const b = baked?.[rec.id]?.[k++];
  if (b && b.name === name) {
    for (const [bn, q] of Object.entries(b.q)) bones[bn]?.quaternion.set(q[0], q[1], q[2], q[3]);
    bones.hip.position.set(b.hip[0], b.hip[1], b.hip[2]);
  } else console.warn('no baked pose for', rec.id, k - 1, name);
  root.position.set(...pos);
  root.rotation.y = heading;
  root.updateMatrixWorld(true);
  scene.add(root);
  const p = { root, model, bones, name };
  if (name === HERO && !rec.hero) rec.hero = p;
  return p;
}

// A posed scan (no skeleton), feet at its origin.
export function statue(name, { pos = [0, 0, 0], heading = 0 } = {}) {
  const root = models[name].scene.clone();
  root.traverse(o => { if (o.isMesh) o.material = mats[name]; });
  root.position.set(...pos);
  root.rotation.y = heading;
  scene.add(root);
  return { root, name };
}

// World position of a bone (or a point offset from it, in the person's own frame).
export function boneAt(p, bone, off = [0, 0, 0]) {
  p.root.updateMatrixWorld(true);
  const q = p.root.getWorldQuaternion(new THREE.Quaternion());
  return p.bones[bone].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...off).applyQuaternion(q));
}

export function setPalette(p) {
  for (const [key, v] of Object.entries(p)) if (shared[key]) {
    if (shared[key].value.isColor) shared[key].value.set(v); else shared[key].value = v;
  }
}

// Shows a built scene: its group in the world, its palette and the glows on its people.
let shown = null;
export function show(r) {
  if (shown === r) return;
  if (shown) world.remove(shown.group);
  world.add(r.group);
  setPalette(r.palette);
  for (const m of Object.values(mats)) m.uniforms.uGlowAmt.value = 0;
  for (const g of r.glows) {
    const u = mats[g.name].uniforms;
    u.uGlowPos.value.copy(g.at); u.uGlowAmt.value = g.amt; u.uGlowRadius.value = g.radius; u.uGlowColor.value.set(g.color);
  }
  shown = r;
}
