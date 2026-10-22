import { Effect, BlendFunction } from 'postprocessing';

// Film grain. Same idea as postprocessing's NoiseEffect, but hashed from the pixel coordinate with a
// wrapped seed: NoiseEffect feeds uv * time into a sin() hash, which breaks into vertical streaks after
// the page has been open for a minute or two.
const fragmentShader = /* glsl */ `
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 seed = vec2(fract(time * 1.37) * 537.0, fract(time * 2.11) * 311.0);
  outputColor = vec4(vec3(grainHash(gl_FragCoord.xy + seed)), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor({ blendFunction = BlendFunction.OVERLAY, opacity = 0.06 } = {}) {
    super('GrainEffect', fragmentShader, { blendFunction });
    this.blendMode.opacity.value = opacity;
  }
}
