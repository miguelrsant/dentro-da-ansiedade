// Shared GLSL for the "stage": a radial floor gradient that fades into a flat far colour,
// the same three-colour scheme the reference uses for its cyclorama.
export const stageUniformsGLSL = /* glsl */ `
uniform vec3 uBgNear;
uniform vec3 uBgMid;
uniform vec3 uBgFar;
uniform float uStageRadius;
`;

export const stageFunctionsGLSL = /* glsl */ `
vec3 stageColor(float d) {
  float x = clamp(d / uStageRadius, 0.0, 1.0);
  float r = 1.0 - smoothstep(0.0, 0.34, x);
  r = pow(r, 1.6);
  float b = pow(smoothstep(0.2, 1.0, x), 0.7);
  return mix(mix(uBgMid, uBgNear, r), uBgFar, b);
}
// colour seen along a ray: the floor (y = 0) or the far backdrop
vec3 envColor(vec3 ro, vec3 rd) {
  if (rd.y < -0.0005) {
    float t = -ro.y / rd.y;
    vec3 p = ro + rd * t;
    float far = smoothstep(0.0, -0.08, rd.y);
    return mix(uBgFar, stageColor(length(p.xz)), far);
  }
  return uBgFar;
}
`;
