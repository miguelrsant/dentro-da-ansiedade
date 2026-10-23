import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { SCENES, ACTS } from '../v2/story.js';
import { toggleSound } from '../audio/music.js';

const useChapter = () => useSyncExternalStore(subscribe, () => store.chapter);
const useSound = () => useSyncExternalStore(subscribe, () => store.sound);

// The music's switch: a speaker, with "Ativar som" beside it until the first click or tap lets the browser
// start the sound.
function SoundButton() {
  const sound = useSound();
  const label = sound === 'on' ? 'Desativar o som' : 'Ativar o som';
  return (
    <button type="button" className={'sound-btn is-' + sound} aria-label={label} title={label} onClick={toggleSound}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 9.4h3.3l4.7-3.9v13l-4.7-3.9H3.5z" fill="currentColor" />
        {sound === 'off'
          ? <path d="M15.4 9.6l4.8 4.8m0-4.8l-4.8 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          : <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14.8 9.3a3.9 3.9 0 0 1 0 5.4" /><path d="M17.5 6.7a7.6 7.6 0 0 1 0 10.6" /></g>}
      </svg>
      {sound === 'armed' && <span>Ativar som</span>}
    </button>
  );
}

// Respira's mark: a circle cut by a slow wave, the rhythm of a calm breath.
export function Logo() {
  const id = 'wave' + useId().replace(/[^\w-]/g, '');
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <mask id={id}>
        <rect width="40" height="40" fill="#fff" />
        <path d="M6.5 22.5c3.4 0 4.6-6.5 8.2-6.5s4.8 9 8.4 9 4.6-6 7.8-6c2 0 3 1.4 3.6 2.4" fill="none" stroke="#000" strokeWidth="3.3" strokeLinecap="round" />
      </mask>
      <circle cx="20" cy="20" r="16.5" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}

export default function Chrome({ goTo }) {
  const chapter = useChapter();
  const [menu, setMenu] = useState(false);
  const indicators = useRef([]);
  const dark = !!SCENES[chapter].dark;

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

      <div className={'hint' + (chapter === 0 ? '' : ' is-off')} aria-hidden="true">
        <span>Role para explorar</span>
        <svg viewBox="0 0 14 8" fill="none"><path d="M1 1l6 6 6-6" stroke="currentColor" strokeWidth="1.4" /></svg>
      </div>
    </div>
  );
}
