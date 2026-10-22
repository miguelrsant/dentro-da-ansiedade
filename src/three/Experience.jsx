import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { EffectComposer, RenderPass, EffectPass, DepthOfFieldEffect, BloomEffect, VignetteEffect } from 'postprocessing';
import { Director } from './director.js';
import { createSharedUniforms } from './personMaterial.js';
import { TitleEffect } from './TitleEffect.js';
import { GrainEffect } from './GrainEffect.js';
import { INLINED } from './inlineModels.js';
import { store, emit } from '../store.js';

export const PEOPLE = ['claudia', 'carla', 'eric', 'sophia', 'nathan', 'manuel'];
const modelUrl = name => `${import.meta.env.BASE_URL}models/${name}.glb`;
const URLS = PEOPLE.map(modelUrl);
// Inlined models are already decoded, so only the normal build needs the meshopt (WebAssembly) decoder.
URLS.forEach(u => useGLTF.preload(u, false, !INLINED));

export default function Experience({ mobile }) {
  const gltfs = useGLTF(URLS, false, !INLINED);
  const { gl, scene, camera, size } = useThree();

  const { director, composer } = useMemo(() => {
    const shared = createSharedUniforms();
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: mobile ? 0 : 4 });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 6, worldFocusRange: 1.4, bokehScale: 4, resolutionScale: mobile ? 0.5 : 0.75 });
    composer.addPass(new EffectPass(camera, dof));
    const title = new TitleEffect();
    const bloom = new BloomEffect({ intensity: 0.6, luminanceThreshold: 0.93, luminanceSmoothing: 0.12, mipmapBlur: true, radius: 0.75 });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.3 });
    const grain = new GrainEffect({ opacity: 0.06 });
    composer.addPass(new EffectPass(camera, title, bloom, vignette, grain));
    const models = Object.fromEntries(PEOPLE.map((n, i) => [n, gltfs[i]]));
    const director = new Director({ models, scene, camera, shared, effects: { dof, title, bloom }, mobile });
    return { director, composer };
  }, []);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    director.resize(size.width, size.height);
  }, [size.width, size.height]);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has('capture')) return;
    // Screenshot helper: run the simulation forward without waiting for (slow, headless) frames.
    window.__advance = (seconds, step = 1 / 30) => { for (let t = 0; t < seconds; t += step) director.update(step); };
    window.__director = director;
    return () => { delete window.__advance; delete window.__director; };
  }, []);

  useEffect(() => {
    // compile every material before the first visible frame
    gl.compile(scene, camera);
    store.loaded = true;
    emit();
    return () => composer.dispose();
  }, []);

  useFrame((state, dt) => {
    director.update(dt);
    composer.render(dt);
  }, 1);

  return null;
}
