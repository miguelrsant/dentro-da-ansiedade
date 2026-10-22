import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Experience from './three/Experience.jsx';
import Overlay from './ui/Overlay.jsx';
import Chrome from './ui/Chrome.jsx';
import Preloader from './ui/Preloader.jsx';
import { CHAPTERS } from './story.js';
import { store, emit } from './store.js';

const SEG = 1.2; // screen heights of scrolling per chapter
const isMobile = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches;

export default function App() {
  const [mobile] = useState(isMobile);
  const [trackHeight, setTrackHeight] = useState(0);

  useEffect(() => {
    const measure = () => setTrackHeight(innerHeight * (SEG * (CHAPTERS.length - 1) + 1));
    const onScroll = () => {
      const seg = innerHeight * SEG;
      store.progress = Math.min(CHAPTERS.length - 1, Math.max(0, scrollY / seg));
      const c = Math.round(store.progress);
      if (c !== store.chapter) { store.chapter = c; emit(); }
    };
    const onPointer = e => {
      store.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      store.pointer.y = -((e.clientY / innerHeight) * 2 - 1);
    };
    measure(); onScroll();
    addEventListener('resize', measure);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('pointermove', onPointer, { passive: true });
    return () => { removeEventListener('resize', measure); removeEventListener('scroll', onScroll); removeEventListener('pointermove', onPointer); };
  }, []);

  const goTo = useCallback(i => {
    scrollTo({ top: i * innerHeight * SEG, behavior: store.reducedMotion ? 'auto' : 'smooth' });
  }, []);

  return (
    <>
      <div className="track" style={{ height: trackHeight }} />
      <div className="stage" aria-hidden="true">
        <Canvas
          legacy
          linear
          flat
          dpr={[1, mobile ? 1.5 : 1.75]}
          gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
          camera={{ fov: 30, near: 0.1, far: 170, position: [0, 1.08, 4.3] }}
        >
          <Suspense fallback={null}>
            <Experience mobile={mobile} />
          </Suspense>
        </Canvas>
      </div>
      <Overlay />
      <Chrome goTo={goTo} />
      <Preloader />
    </>
  );
}
