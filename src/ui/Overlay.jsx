import { useEffect, useRef, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { SCENES, ACTS } from '../v2/story.js';
import { ChatBox } from './ChatBox.jsx';
import Credit from './Credit.jsx';

// Offsets of the thought bubbles from his head: dx/dy on wide screens (scaled), mx/my in portrait. tail/mtail:
// the corner the tail leaves from, so that it points at him (b/t: bottom or top, r/l: right or left).
const SPOTS = [
  { dx: -330, dy: -150, mx: -160, my: -110, tail: 'br', mtail: 'br' },
  { dx: 70, dy: -215, mx: 0, my: -40, tail: 'bl', mtail: 'bl' },
  { dx: 120, dy: -60, mx: 20, my: 90, tail: 'bl', mtail: 'tl' },
  { dx: -380, dy: -20, mx: -175, my: 170, tail: 'br', mtail: 'tr' },
];

// The outline of a w × h thought bubble, like the reference's glass ones: round corners, and one bottom corner
// that runs on down into the tail, a rounded point. Drawn for a tail at the bottom right, then mirrored for
// the other corners. th is how far the tail reaches past the body.
function bubblePath(w, h, tail) {
  const r = Math.min(h * 0.32, 18), c = 0.448 * r; // corner radius, and a round corner's handle
  const tw = h * 0.42, th = h * 0.34, k = 3.5, f = 3; // tail base and height; rounding at its tip and joint
  const len = Math.hypot(tw, th), ux = tw / len, uy = th / len;
  const P = (x, y) => `${(tail[1] === 'l' ? w - x : x).toFixed(2)} ${(tail[0] === 't' ? h + th - y : y).toFixed(2)}`;
  const d = `M${P(r, 0)}L${P(w - r, 0)}C${P(w - c, 0)} ${P(w, c)} ${P(w, r)}` +
    `L${P(w, h + th - k)}Q${P(w, h + th)} ${P(w - k * ux, h + th - k * uy)}` +
    `L${P(w - tw + f * ux, h + f * uy)}Q${P(w - tw, h)} ${P(w - tw - f, h)}` +
    `L${P(r, h)}C${P(c, h)} ${P(0, h - c)} ${P(0, h - r)}L${P(0, r)}C${P(0, c)} ${P(c, 0)} ${P(r, 0)}Z`;
  return { d, th };
}

// fits the glass, the rim and the shadow of one bubble to its text and tail corner
function shapeBubble(el, w, h, tail) {
  const { d, th } = bubblePath(w, h, tail);
  const inner = el.firstChild, glass = inner.firstChild, fx = glass.nextSibling;
  const top = tail[0] === 't' ? -th : 0;
  for (const n of [glass, fx]) Object.assign(n.style, { top: `${top}px`, width: `${w}px`, height: `${h + th}px` });
  glass.style.clipPath = `path('${d}')`;
  fx.querySelectorAll('[data-shape]').forEach(n => n.setAttribute('d', d));
  // it grows out of the tip of its tail
  inner.style.transformOrigin = `${tail[1] === 'l' ? 0 : w}px ${tail[0] === 't' ? -th : h + th}px`;
}

function Thought({ text, i, setRef }) {
  const id = `thought${i}`;
  return (
    <div ref={setRef} className="thought">
      <div className="thought-in">
        <i className="thought-glass" />
        <svg className="thought-fx" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="0.3" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.22" />
            </linearGradient>
            <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
            {/* the shadow only shows outside the glass, so the pane stays as light as the reference's */}
            <mask id={`${id}-out`} maskUnits="userSpaceOnUse" x="-100" y="-100" width="1600" height="400">
              <rect x="-100" y="-100" width="1600" height="400" fill="#fff" />
              <path data-shape="" fill="#000" />
            </mask>
          </defs>
          <g mask={`url(#${id}-out)`}><path data-shape="" className="thought-shade" transform="translate(0 7)" filter={`url(#${id}-soft)`} /></g>
          <path data-shape="" className="thought-rim" fill="none" stroke={`url(#${id}-rim)`} />
        </svg>
        <span className="thought-text">{text}</span>
      </div>
    </div>
  );
}

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
  const thoughtBox = useRef([]); // each bubble's measured size and the tail corner it was drawn with
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
        // measured each time it comes on (the text size follows the window), redrawn when that or its side changes
        let box = thoughtBox.current[i];
        if (on && (!box || !el.classList.contains('is-on'))) box = thoughtBox.current[i] = { w: el.offsetWidth, h: el.offsetHeight };
        const tail = portrait ? sp.mtail : sp.tail;
        if (box && box.tail !== tail) { shapeBubble(el, box.w, box.h, tail); box.tail = tail; }
        const w = box?.w ?? el.offsetWidth;
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
          <Thought key={i} text={t} i={i} setRef={el => (thoughtRefs.current[i] = el)} />
        ))}
      </div>
    </main>
  );
}
