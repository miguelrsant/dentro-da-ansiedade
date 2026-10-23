import { useEffect, useRef } from 'react';
import { store } from '../store.js';

// The page's own scroll bar (the browser's is hidden in styles.css): a thin line on the right edge with a
// thumb for where the reader is in the story. The thumb can be dragged, and a click on the line moves one
// scene toward it. It brightens while the page moves; on touch screens it only shows then.
export default function Scrollbar({ seg }) {
  const bar = useRef(), thumb = useRef();

  useEffect(() => {
    const el = bar.current, th = thumb.current, doc = document.documentElement;
    let drag = null, idle = 0, h = 0;
    const room = () => Math.max(1, doc.scrollHeight - innerHeight);
    const update = () => {
      const H = el.clientHeight;
      h = Math.max(40, (H * innerHeight) / Math.max(innerHeight, doc.scrollHeight));
      th.style.height = `${h.toFixed(1)}px`;
      th.style.transform = `translate3d(0, ${((H - h) * Math.min(1, scrollY / room())).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      update();
      el.classList.add('is-active');
      clearTimeout(idle);
      idle = setTimeout(() => el.classList.remove('is-active'), 1100);
    };
    const onDown = e => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (e.target === th) {
        drag = { y: e.clientY, top: scrollY, k: room() / Math.max(1, el.clientHeight - h) };
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-drag');
        return;
      }
      const dir = e.clientY < th.getBoundingClientRect().top ? -1 : 1;
      scrollTo({ top: (store.chapter + dir) * innerHeight * seg, behavior: 'smooth' });
    };
    const onMove = e => { if (drag) scrollTo({ top: drag.top + (e.clientY - drag.y) * drag.k, behavior: 'instant' }); };
    const onUp = () => { drag = null; el.classList.remove('is-drag'); };

    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', update);
    // the story's height is set after the first render
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', update);
      ro.disconnect();
      clearTimeout(idle);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [seg]);

  return (
    <div ref={bar} className="scrollbar" aria-hidden="true">
      <i ref={thumb} />
    </div>
  );
}
