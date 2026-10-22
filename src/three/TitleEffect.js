import * as THREE from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

// Big display type composited into the 3D image, only where the scene is farther than
// `cutoff` metres, so people standing in front of it cover the letters (as on the reference).
// It runs after depth of field, so the type stays sharp unless we blur it on purpose.
const fragmentShader = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform float opacityA;
uniform float opacityB;
uniform float blurA;
uniform float blurB;
uniform float cutoff;
uniform vec2 texel;
uniform vec3 inkA;
uniform vec3 inkB;

float sampleBlur(sampler2D t, vec2 uv, float r) {
  if (r < 0.01) return texture2D(t, uv).a;
  float s = 0.0;
  vec2 d = texel * r;
  s += texture2D(t, uv).a * 0.2;
  s += texture2D(t, uv + vec2(d.x, 0.0)).a * 0.1;
  s += texture2D(t, uv - vec2(d.x, 0.0)).a * 0.1;
  s += texture2D(t, uv + vec2(0.0, d.y)).a * 0.1;
  s += texture2D(t, uv - vec2(0.0, d.y)).a * 0.1;
  s += texture2D(t, uv + d * 0.7).a * 0.1;
  s += texture2D(t, uv - d * 0.7).a * 0.1;
  s += texture2D(t, uv + vec2(d.x, -d.y) * 0.7).a * 0.1;
  s += texture2D(t, uv + vec2(-d.x, d.y) * 0.7).a * 0.1;
  return s;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  float behind = smoothstep(cutoff - 0.25, cutoff + 0.25, -viewZ);
  float a = sampleBlur(tA, uv, blurA) * opacityA;
  float b = sampleBlur(tB, uv, blurB) * opacityB;
  vec3 c = inputColor.rgb;
  c = mix(c, inkA, a * behind);
  c = mix(c, inkB, b * behind);
  outputColor = vec4(c, inputColor.a);
}
`;

export class TitleEffect extends Effect {
  constructor() {
    const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    blank.needsUpdate = true;
    super('TitleEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['tA', new THREE.Uniform(blank)],
        ['tB', new THREE.Uniform(blank)],
        ['opacityA', new THREE.Uniform(0)],
        ['opacityB', new THREE.Uniform(0)],
        ['blurA', new THREE.Uniform(0)],
        ['blurB', new THREE.Uniform(0)],
        ['cutoff', new THREE.Uniform(8)],
        ['texel', new THREE.Uniform(new THREE.Vector2(1 / 1024, 1 / 1024))],
        ['inkA', new THREE.Uniform(new THREE.Color('#ffffff'))],
        ['inkB', new THREE.Uniform(new THREE.Color('#ffffff'))],
      ]),
    });
    this.blank = blank;
  }
}

// Renders a title into a canvas texture the size of the screen.
// spec: { lines: [{ text, ink? }], size (fraction of width), y (0..1 from top), align: 'center'|'left', x (0..1) }
export function drawTitle(spec, width, height, fontFamily) {
  const scale = Math.min(1.5, 2048 / Math.max(width, height));
  const W = Math.round(width * scale), H = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const portrait = width < height;
  const sizeFrac = portrait ? (spec.sizePortrait ?? spec.size * 1.6) : spec.size;
  let fontPx = sizeFrac * W;
  if (spec.maxHeightFrac) fontPx = Math.min(fontPx, spec.maxHeightFrac * H);
  g.font = `${spec.weight ?? 700} ${fontPx}px ${fontFamily}`;
  if ('letterSpacing' in g) g.letterSpacing = `${-(spec.tracking ?? 0.045) * fontPx}px`;
  // shrink to fit the width with a margin
  const maxW = W * (portrait ? 0.9 : 0.86);
  const widest = Math.max(...spec.lines.map(l => g.measureText(l.text ?? l).width));
  if (widest > maxW) {
    fontPx *= maxW / widest;
    g.font = `${spec.weight ?? 700} ${fontPx}px ${fontFamily}`;
    if ('letterSpacing' in g) g.letterSpacing = `${-(spec.tracking ?? 0.045) * fontPx}px`;
  }
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  const align = portrait ? 'center' : (spec.align ?? 'center');
  g.textAlign = align;
  const lh = fontPx * (spec.leading ?? 0.98);
  const y0 = (portrait ? (spec.yPortrait ?? spec.y) : spec.y) * H - ((spec.lines.length - 1) * lh) / 2;
  const x = align === 'center' ? W / 2 : (spec.x ?? 0.08) * W;
  spec.lines.forEach((l, i) => g.fillText(l.text ?? l, x, y0 + i * lh));
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return { tex, W, H };
}
