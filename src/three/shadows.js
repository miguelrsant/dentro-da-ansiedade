import * as THREE from 'three';

// Soft contact shadows: one body blob and two foot blobs per person, as instanced floor quads.
export function createShadows(count, shared) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColorDark: shared.uColorDark, uStrength: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aOpacity;
      varying vec2 vUv;
      varying float vOpacity;
      void main() {
        vUv = uv;
        vOpacity = aOpacity;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorDark;
      uniform float uStrength;
      varying vec2 vUv;
      varying float vOpacity;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.6);
        gl_FragColor = vec4(uColorDark * 0.55, a * vOpacity * uStrength);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  const opacity = new Float32Array(count);
  geo.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
  mesh.position.y = 0.004;
  return { mesh, opacity };
}
