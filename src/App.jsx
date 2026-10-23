import { useCallback, useEffect, useRef, useState } from 'react';
import Overlay from './ui/Overlay.jsx';
import Chrome from './ui/Chrome.jsx';
import Preloader from './ui/Preloader.jsx';
import { SCENES } from './v2/story.js';
import { store, emit } from './store.js';

const SEG = 1.25; // screen heights of scrolling per scene
const isMobile = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches;

function Stage({ mobile }) {
  const canvas = useRef(), veil = useRef(), flush = useRef();
  useEffect(() => {
    let stop = () => {}, alive = true;
    import('./v2/stage.js').then(({ createStage }) => createStage({ canvas: canvas.current, veil: veil.current, flush: flush.current, mobile }))
      .then(s => { if (alive) stop = s; else s(); })
      .catch(e => { console.error(e); store.failed = true; emit(); });
    return () => { alive = false; stop(); };
  }, [mobile]);
  return (
    <div className="stage" aria-hidden="true">
      <canvas ref={canvas} />
      <div ref={veil} className="veil" />
      <div ref={flush} className="flush" />
    </div>
  );
}

export default function App() {
  const [mobile] = useState(isMobile);
  const [trackHeight, setTrackHeight] = useState(0);

  useEffect(() => {
    const measure = () => setTrackHeight(innerHeight * (SEG * (SCENES.length - 1) + 1));
    const onScroll = () => {
      const seg = innerHeight * SEG;
      store.progress = Math.min(SCENES.length - 1, Math.max(0, scrollY / seg));
      const c = Math.round(store.progress);
      if (c !== store.chapter) { store.chapter = c; emit(); }
    };
    measure(); onScroll();
    addEventListener('resize', measure);
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('resize', measure); removeEventListener('scroll', onScroll); };
  }, []);

  const goTo = useCallback(i => {
    scrollTo({ top: i * innerHeight * SEG, behavior: store.reducedMotion ? 'auto' : 'smooth' });
  }, []);

  return (
    <>
      <div className="track" style={{ height: trackHeight }} />
      <Stage mobile={mobile} />
      <Overlay />
      <Chrome goTo={goTo} />
      <Preloader />
    </>
  );
}
