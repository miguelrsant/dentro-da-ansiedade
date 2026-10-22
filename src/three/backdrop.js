import * as THREE from 'three';
import { stageUniformsGLSL, stageFunctionsGLSL } from './stage.glsl.js';

// A large inverted sphere that paints the floor gradient and the far colour for every view ray.
export function createBackdrop(shared) {
  const material = new THREE.ShaderMaterial({
    uniforms: shared,
    side: THREE.BackSide,
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${stageUniformsGLSL}
      varying vec3 vWorld;
      ${stageFunctionsGLSL}
      float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main() {
        vec3 rd = normalize(vWorld - cameraPosition);
        vec3 c = envColor(cameraPosition, rd);
        c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
