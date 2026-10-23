import { useEffect, useState, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { Logo } from './Chrome.jsx';

// The loading screen: the protagonist's head and shoulders as a dark sculpture (public/loader-bust.webp,
// rendered from his own model), the title over it, the mark in one corner, the percentage in the other and a
// bar along the bottom edge. The page stays dark until it fades out (index.html starts it dark).
export default function Preloader() {
  const progress = useSyncExternalStore(subscribe, () => store.loadProgress);
  const loaded = useSyncExternalStore(subscribe, () => store.loaded);
  const failed = useSyncExternalStore(subscribe, () => store.failed);
  const [bust, setBust] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      setGone(true);
      document.documentElement.classList.remove('is-loading');
    }, 1200);
    return () => clearTimeout(t);
  }, [loaded]);
  if (gone) return null;
  const pct = loaded ? 100 : progress;
  return (
    <div className={'preloader' + (loaded ? ' is-done' : '')} role="status" aria-live="polite">
      <img className={'preloader-bust' + (bust ? ' is-in' : '')} src={`${import.meta.env.BASE_URL}loader-bust.webp`} alt="" draggable="false" onLoad={() => setBust(true)} />
      <p className="preloader-title" aria-hidden="true">Dentro da Ansiedade</p>
      <p className="preloader-brand"><Logo /><span>Respira</span></p>
      {failed
        ? <p className="preloader-count is-failed">Este navegador não conseguiu abrir a cena em 3D.</p>
        : <p className="preloader-count"><span>Carregando</span><b>{pct}%</b></p>}
      <div className="preloader-bar" aria-hidden="true"><i style={{ transform: `scaleX(${(pct / 100).toFixed(3)})` }} /></div>
    </div>
  );
}
