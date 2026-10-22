import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { stageUniformsGLSL, stageFunctionsGLSL } from '../three/stage.glsl.js';

// Furniture and objects in the same unlit language as the people: a dark -> bright ramp driven by
// the asset's own AO map and a soft key, a tinted rim, and the stage haze. The AO pass adds contact.
const vertexShader = /* glsl */ `
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vViewNormal;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vViewPosition = -mv.xyz;
  vWorldPosition = wp.xyz;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uPropDark;
uniform vec3 uPropBright;
uniform vec3 uColorFresnel;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTone;
uniform float uEmissive;
uniform float uTexMix;
#ifdef USE_AO
uniform sampler2D uAo;
#endif
#ifdef USE_NORMAL
uniform sampler2D uNormal;
uniform vec2 uNormalScale;
#endif
#ifdef USE_DIFF
uniform sampler2D uDiff;
#endif
${stageUniformsGLSL}
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vViewNormal;
varying vec2 vUv;
${stageFunctionsGLSL}
vec3 safeNormalize(vec3 v) { return v * inversesqrt(max(dot(v, v), 1e-8)); }
vec3 perturbNormal(vec3 surfPos, vec3 surfNorm, vec2 uv, vec3 mapN) {
  vec3 q0 = dFdx(surfPos), q1 = dFdy(surfPos);
  vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1perp = cross(q1, surfNorm), q0perp = cross(surfNorm, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = det == 0.0 ? 0.0 : inversesqrt(det);
  return safeNormalize(T * (mapN.x * scale) + B * (mapN.y * scale) + surfNorm * mapN.z);
}
void main() {
  vec3 n = safeNormalize(vViewNormal) * (gl_FrontFacing ? 1.0 : -1.0);
#ifdef USE_NORMAL
  vec3 mapN = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  mapN.xy *= uNormalScale;
  n = perturbNormal(-vViewPosition, n, vUv, mapN);
#endif
  vec3 N = safeNormalize((vec4(n, 0.0) * viewMatrix).xyz);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  float ao = 1.0;
#ifdef USE_AO
  ao = texture2D(uAo, vUv).r;
#endif
  float tex = 1.0;
#ifdef USE_DIFF
  vec3 d = texture2D(uDiff, vUv).rgb;
  tex = mix(1.0, clamp(dot(d, vec3(0.299, 0.587, 0.114)) * 1.6 + 0.25, 0.5, 1.2), uTexMix);
#endif
  float key = clamp(dot(N, normalize(vec3(-0.55, 0.65, 0.5))) * 0.5 + 0.5, 0.0, 1.0);
  float sky = N.y * 0.5 + 0.5;
  float lum = clamp(pow(ao, 1.4) * (0.42 + 0.38 * key + 0.2 * sky) * tex + uTone, 0.0, 1.0);
  vec3 color = mix(uPropDark, uPropBright, lum);
  float edge = 1.0 - clamp(abs(dot(N, V)), 0.0, 1.0);
  color = mix(color, uColorFresnel, clamp(pow(edge, 2.0) * 0.35 * ao, 0.0, 0.4));
  color += uEmissive;
  vec3 rd = normalize(vWorldPosition - cameraPosition);
  float fogF = smoothstep(uFogNear, uFogFar, length(vWorldPosition - cameraPosition));
  color = mix(color, envColor(cameraPosition, rd), fogF);
  gl_FragColor = vec4(color, 1.0);
}`;

export function propMaterial(shared, { ao = null, normal = null, normalScale = [1, 1], diff = null, texMix = 0.35, tone = 0, emissive = 0, side = THREE.FrontSide } = {}) {
  const uniforms = {
    ...shared,
    uTone: { value: tone },
    uEmissive: { value: emissive },
    uTexMix: { value: texMix },
    uAo: { value: ao },
    uNormal: { value: normal },
    uNormalScale: { value: new THREE.Vector2(...normalScale) },
    uDiff: { value: diff },
  };
  const defines = {};
  if (ao) defines.USE_AO = '';
  if (normal) defines.USE_NORMAL = '';
  if (diff) defines.USE_DIFF = '';
  return new THREE.ShaderMaterial({ uniforms, defines, vertexShader, fragmentShader, side });
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = {}, pending = {};
// packed by scripts/pack-props.mjs: one compressed .glb per prop
export async function loadProps(shared, ids) {
  await Promise.all(ids.map(id => (pending[id] ??= load(shared, id))));
}
async function load(shared, id) {
  const g = await loader.loadAsync(`${import.meta.env.BASE_URL}props/${id}.glb`);
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    o.material = propMaterial(shared, {
      ao: m.aoMap || null,
      normal: m.normalMap || null,
      normalScale: m.normalScale ? [m.normalScale.x, m.normalScale.y] : [1, 1],
      diff: m.map || null,
      side: m.side,
    });
  });
  cache[id] = g.scene;
}

// A placed copy of a loaded prop: prop('dining_table', { pos, rot (deg), scale })
export function prop(id, { pos = [0, 0, 0], rot = 0, scale = 1, tone = 0 } = {}) {
  const o = cache[id].clone(true);
  o.position.set(...pos);
  o.rotation.y = rot * Math.PI / 180;
  o.scale.setScalar(scale);
  if (tone) o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.uniforms.uTone.value = tone; } });
  return o;
}

// Procedural pieces (walls, beds, sofas, desks, screens) as soft rounded boxes.
export function rbox(shared, [w, h, d], { pos = [0, 0, 0], rot = 0, r = 0.02, tone = 0, emissive = 0, seg = 3 } = {}) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)), propMaterial(shared, { tone, emissive }));
  m.position.set(pos[0], pos[1] + h / 2, pos[2]);
  m.rotation.y = rot * Math.PI / 180;
  return m;
}
