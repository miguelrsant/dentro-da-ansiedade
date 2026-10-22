import { useEffect, useState, useSyncExternalStore } from 'react';
import { useProgress } from '@react-three/drei';
import { store, subscribe } from '../store.js';
import { Logo } from './Chrome.jsx';

export default function Preloader() {
  const { progress } = useProgress();
  const loaded = useSyncExternalStore(subscribe, () => store.loaded);
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
      <p>{loaded ? 'Pronto' : `Chamando as pessoas · ${Math.round(progress)}%`}</p>
    </div>
  );
}
