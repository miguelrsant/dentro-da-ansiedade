import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { SCENES, ACTS } from '../v2/story.js';
import { toggleSound } from '../audio/heart.js';

const useChapter = () => useSyncExternalStore(subscribe, () => store.chapter);
const useSound = () => useSyncExternalStore(subscribe, () => store.sound);

// The heartbeat's sound switch: a speaker whose waves beat with the heart while it plays, with "Ativar som"
// beside it until the first click or tap lets the browser start the sound.
function SoundButton() {
  const sound = useSound();
  const waves = useRef();
  useEffect(() => {
    if (sound !== 'on') return;
    let raf;
    const loop = () => {
      if (waves.current) waves.current.style.opacity = (0.45 + 0.55 * store.pulse * Math.min(1, 0.3 + store.anx)).toFixed(3);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [sound]);
  const label = sound === 'on' ? 'Desativar o som' : 'Ativar o som';
  return (
    <button type="button" className={'sound-btn is-' + sound} aria-label={label} title={label} onClick={toggleSound}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 9.4h3.3l4.7-3.9v13l-4.7-3.9H3.5z" fill="currentColor" />
        {sound === 'off'
          ? <path d="M15.4 9.6l4.8 4.8m0-4.8l-4.8 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          : <g ref={waves} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14.8 9.3a3.9 3.9 0 0 1 0 5.4" /><path d="M17.5 6.7a7.6 7.6 0 0 1 0 10.6" /></g>}
      </svg>
      {sound === 'armed' && <span>Ativar som</span>}
    </button>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path fill="currentColor" d="M20 9.2c3.3-5.6 9.6-7.4 13.4-3.6s2 10.1-3.6 13.4v2c5.6 3.3 7.4 9.6 3.6 13.4s-10.1 2-13.4-3.6h-2c-3.3 5.6-9.6 7.4-13.4 3.6s-2-10.1 3.6-13.4v-2C2.6 15.7.8 9.4 4.6 5.6s10.1-2 13.4 3.6h2Z" />
    </svg>
  );
}

export default function Chrome({ goTo }) {
  const chapter = useChapter();
  const [menu, setMenu] = useState(false);
  const indicators = useRef([]);
  const dark = !!SCENES[chapter].dark;
  const breathAt = SCENES.findIndex(s => s.breath);

  useEffect(() => {
    let raf;
    const loop = () => {
      ACTS.forEach((act, i) => {
        const el = indicators.current[i];
        if (!el) return;
        const f = Math.min(1, Math.max(0, (store.smooth - act.from) / (act.to - act.from)));
        el.style.transform = `scaleY(${f.toFixed(3)})`;
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setMenu(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const actIndex = ACTS.findIndex(a => chapter >= a.from && chapter <= a.to);

  return (
    <div className={'chrome' + (dark ? ' is-dark' : '')}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); goTo(0); }} aria-label="Respira, voltar ao início">
        <Logo />
        <span>Respira</span>
      </a>

      <SoundButton />
      <button className={'menu-btn' + (menu ? ' is-open' : '')} type="button" aria-expanded={menu} aria-controls="menu" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenu(m => !m)}>
        <i /><i />
      </button>
      <nav id="menu" className="menu" hidden={!menu} aria-label="Capítulos">
        <p className="menu-title">Capítulos</p>
        <ol>
          {SCENES.map((ch, i) => (
            <li key={ch.id}>
              <a href="#" className={i === chapter ? 'is-active' : ''} onClick={e => { e.preventDefault(); setMenu(false); goTo(i); }}>
                <small>{String(i + 1).padStart(2, '0')}</small>{ch.nav}
              </a>
            </li>
          ))}
        </ol>
        <p className="menu-about">Uma história interativa sobre ansiedade. Não substitui atendimento profissional.</p>
      </nav>

      <nav className="acts" aria-label="Partes da história">
        {ACTS.map((act, i) => (
          <button key={act.name} type="button" className={'act' + (i === actIndex ? ' is-active' : '')} onClick={() => goTo(act.from)}>
            <span className="act-text">{act.name}</span>
            <span className="act-dot"><i ref={el => (indicators.current[i] = el)} /></span>
          </button>
        ))}
      </nav>
      <p className="acts-mobile" aria-hidden="true"><b>{actIndex + 1}</b><span>/</span>{ACTS.length}<em>{ACTS[actIndex]?.name}</em></p>

      <button type="button" className="pill pill--left" onClick={() => goTo(SCENES.length - 1)}>
        <span className="pulse" aria-hidden="true"><i /><i /><i /><b /></span>
        <span>CVV · ligue 188</span>
      </button>
      <button type="button" className="pill pill--right" onClick={() => goTo(breathAt)}>
        <span>Respirar agora</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.5" opacity=".55" /></svg>
      </button>

      <div className={'hint' + (chapter === 0 ? '' : ' is-off')} aria-hidden="true">
        <span>Role para explorar</span>
        <svg viewBox="0 0 14 8" fill="none"><path d="M1 1l6 6 6-6" stroke="currentColor" strokeWidth="1.4" /></svg>
      </div>
    </div>
  );
}
