import * as THREE from 'three';
import models from 'virtual:inline-models';

// `npm run build:inline` ships the models inside the bundle, already decoded from meshopt. Seed three's file
// cache with them before any module starts loading (Experience.jsx preloads at import time), so the loaders
// never hit the network.
export const INLINED = Object.keys(models).length > 0;
if (INLINED) {
  THREE.Cache.enabled = true;
  for (const [url, b64] of Object.entries(models)) THREE.Cache.add(url, Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer);
}
