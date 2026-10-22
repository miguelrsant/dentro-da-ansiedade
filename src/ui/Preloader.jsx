import { useEffect, useState, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { Logo } from './Chrome.jsx';

export default function Preloader() {
  const progress = useSyncExternalStore(subscribe, () => store.loadProgress);
  const loaded = useSyncExternalStore(subscribe, () => store.loaded);
  const failed = useSyncExternalStore(subscribe, () => store.failed);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setGone(true), 1200);
    return () => clearTimeout(t);
  }, [loaded]);
  if (gone) return null;
  return (
    <div className={'preloader' + (loaded ? ' is-done' : '')} role="status" aria-live="polite">
      <Logo />
      <p>{failed ? 'Este navegador não conseguiu abrir a cena em 3D.' : loaded ? 'Pronto' : `Chamando as pessoas · ${progress}%`}</p>
    </div>
  );
}
