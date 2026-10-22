import * as THREE from 'three';
import { stageUniformsGLSL, stageFunctionsGLSL } from './stage.glsl.js';

// Port of the reference's character shading: no lights at all. Colour comes from baked
// ambient occlusion (dark -> bright), a tinted fresnel rim, a soft facing highlight and,
// on skin, a glassy look that shows the stage behind the body.
// Vertex colour channels written by scripts/bake: r = AO (30 cm), g = AO (110 cm), b = skin, a = hair.

const vertexShader = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float uAoPow;
uniform float uAoMix;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vViewNormal;
varying vec3 vWorldNormal;
varying float vAo;
varying float vSkin;
varying float vHair;
varying vec2 vUv;
void main() {
  vUv = uv;
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vViewPosition = -mvPosition.xyz;
  vWorldPosition = worldPosition.xyz;
  vViewNormal = normalize(transformedNormal);
  vWorldNormal = normalize((vec4(vViewNormal, 0.0) * viewMatrix).xyz);
  float ao = mix(color.g, color.r, uAoMix);
  vAo = pow(clamp(ao, 0.0, 1.0), uAoPow);
  vSkin = color.b;
  vHair = color.a;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColorDark;
uniform vec3 uColorBright;
uniform vec3 uColorFresnel;
uniform float uSkinGlass;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uGlowColor;
uniform vec3 uGlowPos;
uniform float uGlowAmt;
uniform float uGlowRadius;
uniform float uLift;
uniform float uFresnelPow;
uniform float uFacing;
uniform float uRim;
uniform float uKeyMin;
uniform float uSatin;
uniform float uSkinBase;
uniform float uSkinAo;
${stageUniformsGLSL}
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vViewNormal;
varying vec3 vWorldNormal;
varying float vAo;
varying float vSkin;
varying float vHair;
varying vec2 vUv;
#ifdef USE_DETAIL
// per-character detail texture: rg = tangent-space normal, b = cavity (1 open, darker in creases)
uniform sampler2D uDetail;
uniform float uDetailCloth;
uniform float uDetailSkin;
uniform float uDetailHair;
uniform float uDetailBias;
uniform float uCavity;
uniform float uHairCavity;
#endif
${stageFunctionsGLSL}
float linearStep(float e0, float e1, float x) { return clamp((x - e0) / (e1 - e0), 0.0, 1.0); }
// Interpolated normals on the crumpled hair scans can pass through zero; normalize() would give NaN
// there and the blur passes smear it into black specks.
vec3 safeNormalize(vec3 v) { return v * inversesqrt(max(dot(v, v), 1e-8)); }
#ifdef USE_DETAIL
// normal mapping without tangents, from screen-space derivatives (three's perturbNormal2Arb)
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
#endif
vec3 hue2RGBSmooth(float hue) {
  vec3 rgb = clamp(abs(mod(fract(hue) * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return rgb * rgb * (3.0 - 2.0 * rgb);
}
void main() {
  float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
  vec3 viewNormal = safeNormalize(vViewNormal) * faceDirection;
  float cavity = 1.0;
#ifdef USE_DETAIL
  // folds, seams and hair strands from the scan; skin reads a blurrier mip so faces stay glassy
  float skinW = clamp(vSkin, 0.0, 1.0), hairW = clamp(vHair, 0.0, 1.0);
  vec4 detail = texture2D(uDetail, vUv, uDetailBias + skinW * 1.5 - hairW * 0.6);
  vec2 nxy = detail.rg * 2.0 - 1.0;
  vec3 mapN = vec3(nxy * mix(mix(uDetailCloth, uDetailSkin, skinW), uDetailHair, hairW), sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  viewNormal = perturbNormal(-vViewPosition, viewNormal, vUv, mapN);
  cavity = mix(1.0, detail.b, clamp(uCavity * mix(1.0, 0.3, skinW) * mix(1.0, uHairCavity, hairW), 0.0, 1.0));
#endif
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 N = safeNormalize((vec4(viewNormal, 0.0) * viewMatrix).xyz);
  float edge = 1.0 - clamp(abs(dot(N, V)), 0.001, 1.0); // 0 facing the camera, 1 at the silhouette
  float fresnel = pow(edge, mix(uFresnelPow, 1.0, vHair));
  float ao = vAo * cavity;
  // glints from a soft key above-left of the camera
  float gloss = max(0.0, dot(viewNormal, normalize(vec3(-0.35, 0.55, 0.75))));

  // a soft key from the upper left gives the forms some volume
  float key = clamp(dot(N, normalize(vec3(-0.55, 0.65, 0.5))) * 0.5 + 0.5, 0.0, 1.0);

  // clothes and hair
  vec3 color = mix(uColorDark, uColorBright, clamp(ao * mix(uKeyMin, 1.0, key) + vHair * 0.1 + uLift, 0.0, 1.0));
  // pink rim: blends towards the fresnel colour instead of adding, so silhouettes glow pink, not white
  float rim = fresnel * (0.35 + ao * 0.65) * (0.5 + linearStep(0.25, 1.25, fresnel) * 2.0 * ao) * mix(1.0, 0.5, vHair) * uRim;
  color = mix(color, uColorFresnel, clamp(rim * 0.6, 0.0, 0.62));
  color += uColorFresnel * min(rim, 0.6) * 0.18;
  color += pow(gloss, 6.0) * mix(uColorBright, vec3(1.0), 0.5) * uSatin * ao * (1.0 - 0.75 * vHair);
  color += smoothstep(0.88, 1.0, viewNormal.z) * mix(uColorFresnel, uColorBright, 0.75) * uFacing * ao;

  // skin: glass that shows the stage behind it and turns blue towards the silhouette
  vec3 rd = normalize(vWorldPosition - cameraPosition);
  vec3 behind = envColor(vWorldPosition, refract(rd, N, 1.0 / 1.45));
  float aoS = mix(1.0, ao, 0.45); // glass hides most of the face's small creases
  vec3 glass = behind * (uSkinBase + uSkinAo * aoS) + uColorBright * 0.12 * aoS;
  vec3 skin = mix(glass, mix(uColorDark, uColorBright, 0.3 + 0.55 * aoS * key), smoothstep(0.15, 0.85, edge));
  skin += pow(gloss, 9.0) * 0.5 * (0.4 + 0.6 * ao);
  skin += edge * (0.35 + ao * 0.65) * (0.75 + linearStep(0.25, 1.4, edge) * ao) * hue2RGBSmooth(viewNormal.z) * 0.18 * ao;
  skin += uColorFresnel * pow(edge, 2.5) * 0.3 * ao;
  color = mix(color, skin, clamp(vSkin, 0.0, 1.0) * uSkinGlass);

  // inner light (chest or head)
  float gd = length(vWorldPosition - uGlowPos);
  color += uGlowColor * uGlowAmt * exp(-gd * gd / (uGlowRadius * uGlowRadius));

  // distance haze into whatever the stage shows behind this pixel
  float fogF = smoothstep(uFogNear, uFogFar, length(vWorldPosition - cameraPosition));
  color = mix(color, envColor(cameraPosition, rd), fogF);
  color = mix(uColorDark * 0.5, color, smoothstep(-0.05, 0.05, vWorldPosition.y));
  gl_FragColor = vec4(clamp(color, 0.0, 8.0), 1.0);
}
`;

export function createSharedUniforms() {
  return {
    uColorDark: { value: new THREE.Color('#4a55d8') },
    uColorBright: { value: new THREE.Color('#9fb0ff') },
    uColorFresnel: { value: new THREE.Color('#ff8fd8') },
    uBgNear: { value: new THREE.Color('#c2c1ef') },
    uBgMid: { value: new THREE.Color('#b6b5ea') },
    uBgFar: { value: new THREE.Color('#b3b2e7') },
    uStageRadius: { value: 30 },
    uAoPow: { value: 2.6 },
    uAoMix: { value: 0.45 },
    uSkinGlass: { value: 1 },
    uFogNear: { value: 16 },
    uFogFar: { value: 46 },
    uLift: { value: 0 },
    uFresnelPow: { value: 1.5 },
    uRim: { value: 0.6 },
    uKeyMin: { value: 0.4 },
    uSatin: { value: 0.5 },
    uFacing: { value: 0 },
    uSkinBase: { value: 0.5 },
    uSkinAo: { value: 0.35 },
    uDetailCloth: { value: 1.1 },
    uDetailSkin: { value: 0.35 },
    uDetailHair: { value: 1.4 },
    uDetailBias: { value: 0.15 },
    uCavity: { value: 0.95 },
    uHairCavity: { value: 1.2 },
  };
}

export function createPersonMaterial(shared, own = {}) {
  const uniforms = {
    ...shared,
    uGlowColor: { value: new THREE.Color('#ffe6f4') },
    uGlowPos: { value: new THREE.Vector3(0, -10, 0) },
    uGlowAmt: { value: 0 },
    uGlowRadius: { value: 0.18 },
    ...own,
  };
  const defines = uniforms.uDetail ? { USE_DETAIL: '' } : {};
  return new THREE.ShaderMaterial({ uniforms, defines, vertexShader, fragmentShader, vertexColors: true });
}
