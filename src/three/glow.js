import * as THREE from 'three';

// Additive halo used for the protagonist's racing heart and the "thought" light in the head.
export function createGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.08, 'rgba(255,248,252,0.95)');
  gr.addColorStop(0.25, 'rgba(255,220,240,0.45)');
  gr.addColorStop(0.55, 'rgba(210,190,255,0.12)');
  gr.addColorStop(1, 'rgba(200,180,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  // faint rays, like light leaking through glass
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, len = 40 + Math.random() * 80;
    const lg = g.createLinearGradient(128, 128, 128 + Math.cos(a) * len, 128 + Math.sin(a) * len);
    lg.addColorStop(0, 'rgba(255,255,255,0.10)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = lg;
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * len, 128 + Math.sin(a) * len); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 }));
  sprite.renderOrder = 20;
  return sprite;
}
