import { useEffect, useRef, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { SCENES, ACTS } from '../v2/story.js';
import { ChatBox } from './ChatBox.jsx';
import Credit from './Credit.jsx';

// Offsets of the thought bubbles from his head: dx/dy on wide screens (scaled), mx/my in portrait.
const SPOTS = [
  { dx: -330, dy: -150, mx: -160, my: -70 },
  { dx: 70, dy: -215, mx: 0, my: -40 },
  { dx: 120, dy: -60, mx: 20, my: 90 },
  { dx: -380, dy: -20, mx: -175, my: 170 },
];

const useChapter = () => useSyncExternalStore(subscribe, () => store.chapter);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function Headline({ lines }) {
  return (
    <h2 className="headline">
      {lines.map((l, i) => {
        const em = l.startsWith('*') && l.endsWith('*');
        return <span key={i} className={'line' + (em ? ' em' : '')}>{em ? l.slice(1, -1) : l}</span>;
      })}
    </h2>
  );
}

// Messages as on a phone: theirs on the left with the sender's name, his own on the right.
function Messages({ list, status }) {
  return (
    <div className="msgs">
      {list.map((m, i) => (
        <p key={i} className={'msg' + (m.from ? '' : ' msg--me')} style={{ transitionDelay: `${0.25 + i * 0.9}s` }}>
          {m.from && <small>{m.from}</small>}
          <span>{m.text}</span>
        </p>
      ))}
      {status && <p className="msg-status" style={{ transitionDelay: `${0.6 + list.length * 0.9}s` }}>{status}</p>}
    </div>
  );
}

function Scene({ s, i, live, sectionRef, bpmRef, breathRefs }) {
  const act = ACTS.find(a => a.from === i);
  const layout = s.final ? 'final' : s.title ? 'hero' : 'info';
  return (
    <section ref={sectionRef} className={`ch ch--${layout}${s.dark ? ' ch--dark' : ''}`} aria-label={s.nav}>
      {(s.time || s.place) && (
        <p className="kicker">
          {act && <span className="kicker-act">{act.name}</span>}
          {s.time && <b>{s.time}</b>}
          {s.place && <span>{s.place}</span>}
        </p>
      )}
      {s.title && <h2 className={'title' + (s.final ? ' title--final' : '')}>{s.title}</h2>}
      {s.bubble && <ChatBox text={s.bubble} active={live} />}
      {s.chat && s.chatFirst && <Messages list={s.chat} status={s.status} />}
      {s.headline && <Headline lines={s.headline} />}
      {s.chat && !s.chatFirst && <Messages list={s.chat} status={s.status} />}
      {s.stat && (
        <div className="stat">
          <b>{s.stat.big}</b>
          <p>{s.stat.text}</p>
          <small>{s.stat.source}</small>
        </div>
      )}
      {s.vitals && <div className="vitals"><b ref={bpmRef}>112</b><span>batimentos<br />por minuto</span></div>}
      {s.chips && <ul className="chips">{s.chips.map((c, k) => <li key={c} style={{ transitionDelay: `${0.2 + k * 0.18}s` }}>{c}</li>)}</ul>}
      {s.notifications && (
        <ul className="notifs" aria-label="Notificações">
          {s.notifications.map(([app, text], k) => (
            <li key={app} style={{ transitionDelay: `${0.3 + k * 0.45}s` }}><b>{app}</b><span>{text}</span><small>agora</small></li>
          ))}
        </ul>
      )}
      {s.thoughts && s.status && <p className="msg-status is-plain">{s.status}</p>}
      {s.breath && (
        <div className="breath">
          <div className="ring"><i ref={el => (breathRefs.current.fill = el)} /></div>
          <div>
            <p className="breath-label" ref={el => (breathRefs.current.label = el)}>Inspire</p>
            <p className="breath-count" ref={el => (breathRefs.current.count = el)}>4 s</p>
          </div>
        </div>
      )}
      {s.note && <p className="note">{s.note}</p>}
      {s.final && (
        <div className="tail">
          <p className="statement small">Ansiedade tem tratamento. Se está pesando, fale com alguém. Pedir ajuda é um gesto de cuidado.</p>
          <div className="help" id="ajuda">
            <div className="help-card"><strong>188</strong><span>CVV, Centro de Valorização da Vida. Ligação gratuita, 24 horas, ou chat em <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer">cvv.org.br</a>.</span></div>
            <div className="help-card"><strong>CAPS e UBS</strong><span>Atendimento em saúde mental pelo SUS. Procure a unidade mais perto de você.</span></div>
          </div>
          <p className="fine">Em emergência, ligue 192 (SAMU). Esta é uma história informativa e não substitui acompanhamento profissional.</p>
        </div>
      )}
      {s.final && <Credit />}
    </section>
  );
}

export default function Overlay() {
  const chapter = useChapter();
  const refs = useRef([]);
  const thoughtRefs = useRef([]);
  const thoughtW = useRef([]);
  const bpmRef = useRef();
  const breathRefs = useRef({});
  const thoughtsAt = SCENES.findIndex(s => s.thoughts);

  useEffect(() => {
    let raf;
    const loop = () => {
      const p = store.smooth;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const d = p - i;
        const vis = 1 - sstep(0.12, 0.4, Math.abs(d));
        el.style.opacity = vis.toFixed(3);
        el.style.visibility = vis < 0.005 ? 'hidden' : 'visible';
        el.style.filter = vis > 0.995 ? 'none' : `blur(${((1 - vis) * 14).toFixed(1)}px)`;
        el.style.transform = `translate3d(0, ${(-d * 46).toFixed(1)}px, 0)`;
        el.classList.toggle('is-live', vis > 0.6);
      });
      // thoughts around his head in the close-up
      const hero = store.anchors.hero;
      const scale = Math.min(1, innerWidth / 1500);
      const portrait = innerWidth < innerHeight * 0.9;
      thoughtRefs.current.forEach((el, i) => {
        if (!el || !hero) return;
        const local = p - thoughtsAt;
        const on = hero.visible && local > -0.3 + i * 0.08 && local < 0.4;
        const sp = SPOTS[i];
        const bob = Math.sin(performance.now() / 900 + i * 1.7) * 4;
        if (on && !el.classList.contains('is-on')) thoughtW.current[i] = el.offsetWidth;
        const w = thoughtW.current[i] ?? el.offsetWidth;
        const x = Math.min(Math.max(hero.x + (portrait ? sp.mx : sp.dx * scale), 12), innerWidth - w - 12);
        const y = hero.y + (portrait ? sp.my : sp.dy * scale) + bob;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.classList.toggle('is-on', on);
      });
      if (bpmRef.current) bpmRef.current.textContent = Math.round(store.bpm);
      const br = breathRefs.current;
      if (br.fill) {
        br.fill.style.transform = `scale(${(0.5 + 0.5 * store.breath.s).toFixed(3)})`;
        if (br.label.textContent !== store.breath.label) br.label.textContent = store.breath.label;
        br.count.textContent = `${Math.max(1, Math.ceil(store.breath.left))} s`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [thoughtsAt]);

  return (
    <main className="overlay">
      <h1 className="sr-only">Dentro da Ansiedade</h1>
      {SCENES.map((s, i) => (
        <Scene key={s.id} s={s} i={i} live={chapter === i} sectionRef={el => (refs.current[i] = el)} bpmRef={s.vitals ? bpmRef : undefined} breathRefs={breathRefs} />
      ))}
      <div className="anchors" aria-hidden="true">
        {SCENES[thoughtsAt].thoughts.map((t, i) => (
          <div key={i} ref={el => (thoughtRefs.current[i] = el)} className="thought">{t}</div>
        ))}
      </div>
    </main>
  );
}
