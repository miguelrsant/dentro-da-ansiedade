import { useCallback, useEffect, useRef, useState } from 'react';
import Overlay from './ui/Overlay.jsx';
import Chrome from './ui/Chrome.jsx';
import Preloader from './ui/Preloader.jsx';
import Scrollbar from './ui/Scrollbar.jsx';
import { SCENES } from './v2/story.js';
import { PALETTES } from './story.js';
import { store, emit } from './store.js';

const SEG = 1.25; // screen heights of scrolling per scene
const isMobile = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches;

function Stage({ mobile }) {
  const canvas = useRef(), veil = useRef();
  useEffect(() => {
    let stop = () => {}, alive = true;
    import('./v2/stage.js').then(({ createStage }) => createStage({ canvas: canvas.current, veil: veil.current, mobile }))
      .then(s => { if (alive) stop = s; else s(); })
      .catch(e => { console.error(e); store.failed = true; emit(); });
    return () => { alive = false; stop(); };
  }, [mobile]);
  return (
    <div className="stage" aria-hidden="true">
      <canvas ref={canvas} />
      <div ref={veil} className="veil" />
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

  // A jump to a scene (the menu, the parts of the story, the CVV pill): a short fade to the scene's own colour,
  // the page moves there at once, and the eased scroll with it, so the 3D does not run through the scenes in
  // between; then the scene fades in.
  const jump = useRef(), timer = useRef(0);
  const goTo = useCallback(i => {
    const top = i * innerHeight * SEG, el = jump.current;
    clearTimeout(timer.current);
    if (store.reducedMotion || !el) { scrollTo({ top, behavior: 'instant' }); store.progress = store.smooth = i; return; }
    el.style.background = PALETTES[SCENES[i].pal].near;
    el.classList.add('is-on');
    timer.current = setTimeout(() => {
      scrollTo({ top, behavior: 'instant' });
      store.progress = store.smooth = i;
      if (store.chapter !== i) { store.chapter = i; emit(); }
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-on')));
    }, 400);
  }, []);

  return (
    <>
      <div className="track" style={{ height: trackHeight }} />
      <Stage mobile={mobile} />
      <Overlay />
      <div ref={jump} className="jump" aria-hidden="true" />
      <Chrome goTo={goTo} />
      <Scrollbar seg={SEG} />
      <Preloader />
    </>
  );
}
