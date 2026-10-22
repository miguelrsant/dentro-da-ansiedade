import { useEffect, useRef, useSyncExternalStore } from 'react';
import { store, subscribe } from '../store.js';
import { CHAPTERS } from '../story.js';
import { ChatBox } from './ChatBox.jsx';

// Offsets from the protagonist's head: dx/dy on wide screens (scaled), mx/my in portrait.
const THOUGHTS = [
  { text: 'E se eu errar?', dx: -250, dy: -150, mx: -170, my: -40 },
  { text: 'Todo mundo está olhando.', dx: 70, dy: -205, mx: 10, my: -30 },
  { text: 'Eu deveria estar melhor.', dx: 110, dy: -70, mx: 25, my: 90 },
  { text: 'Esqueci alguma coisa?', dx: -330, dy: -30, mx: -185, my: 160 },
  { text: 'Não vou dar conta.', dx: -150, dy: -280, mx: 5, my: 232 },
];

const useChapter = () => useSyncExternalStore(subscribe, () => store.chapter);

function Headline({ lines }) {
  return (
    <h2 className="headline">
      {lines.map((l, i) => (
        <span key={i} className={'line' + (l.em ? ' em' : '')}>{l.em ?? l}</span>
      ))}
    </h2>
  );
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function Overlay() {
  const chapter = useChapter();
  const refs = useRef([]);
  const thoughtRefs = useRef([]);
  const thoughtW = useRef([]); // bubble widths, measured when each one appears
  const dotRefs = useRef({});
  const bpmRef = useRef();
  const breathRefs = useRef({});

  useEffect(() => {
    let raf;
    const loop = () => {
      const p = store.smooth;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const d = p - i;
        const vis = 1 - sstep(0.14, 0.44, Math.abs(d));
        el.style.opacity = vis.toFixed(3);
        el.style.visibility = vis < 0.005 ? 'hidden' : 'visible';
        el.style.filter = vis > 0.995 ? 'none' : `blur(${((1 - vis) * 14).toFixed(1)}px)`;
        el.style.transform = `translate3d(0, ${(-d * 46).toFixed(1)}px, 0)`;
        el.classList.toggle('is-live', vis > 0.6);
      });
      // thought bubbles around the protagonist's head (chapter 4 = index 3)
      const hero = store.anchors.hero;
      const scale = Math.min(1, innerWidth / 1500);
      const portrait = innerWidth < innerHeight * 0.9;
      thoughtRefs.current.forEach((el, i) => {
        if (!el || !hero) return;
        const local = p - 3;
        const on = hero.visible && local > -0.42 + i * 0.07 && local < 0.42;
        const th = THOUGHTS[i];
        const bob = Math.sin(performance.now() / 900 + i * 1.7) * 4;
        if (on && !el.classList.contains('is-on')) thoughtW.current[i] = el.offsetWidth;
        const w = thoughtW.current[i] ?? el.offsetWidth;
        const x = Math.min(Math.max(hero.x + (portrait ? th.mx : th.dx * scale), 12), innerWidth - w - 12);
        const y = hero.y + (portrait ? th.my : th.dy * scale) + bob;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.classList.toggle('is-on', on);
      });
      // "typing" bubbles over people
      const dotPlan = { talker0: [0, 2], talker1: [0, 2], friend: [7, 7] };
      for (const [name, el] of Object.entries(dotRefs.current)) {
        const a = store.anchors[name];
        if (!el || !a) continue;
        const [from, to] = dotPlan[name];
        const inside = a.x > 70 && a.x < innerWidth - 70 && a.y > 90;
        const on = a.visible && inside && p > from - 0.35 && p < to + 0.35 && (name !== 'talker1' || p > 1.6);
        el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) translate(-20%, -100%)`;
        el.classList.toggle('is-on', on);
      }
      if (bpmRef.current) bpmRef.current.textContent = store.bpm;
      const br = breathRefs.current;
      if (br.fill) {
        br.fill.style.transform = `scale(${(0.5 + 0.5 * store.breath.s).toFixed(3)})`;
        if (br.label.textContent !== store.breath.label) br.label.textContent = store.breath.label;
        br.count.textContent = `${Math.ceil(store.breath.left)} s`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const set = i => el => (refs.current[i] = el);
  const live = i => chapter === i;

  return (
    <main className="overlay">
      <section ref={set(0)} className="ch ch--hero" aria-label="Abertura">
        <h1 className="sr-only">Ansiedade</h1>
        <ChatBox text="Por que meu coração não desacelera?" active={live(0)} />
      </section>

      <section ref={set(1)} className="ch ch--statement" aria-label="O tamanho">
        <p className="sr-only">9,3%</p>
        <p className="statement">dos brasileiros vivem com algum transtorno de ansiedade. <strong>A maior taxa do mundo.</strong></p>
        <p className="source">OMS, 2017 · cerca de 18,6 milhões de pessoas</p>
      </section>

      <section ref={set(2)} className="ch ch--info" aria-label="Multidão">
        <Headline lines={['No meio de', 'tanta gente,', { em: 'e ainda assim, só.' }]} />
        <ChatBox text="Alguém mais se sente assim?" active={live(2)} status="18,6 milhões de pessoas sentindo o mesmo agora…" />
      </section>

      <section ref={set(3)} className="ch ch--info" aria-label="Pensamentos">
        <Headline lines={['A mente cria', 'perguntas que', { em: 'não têm fim.' }]} />
        <ChatBox text="E se der tudo errado?" active={live(3)} status="Pensamento 1 de 37…" />
      </section>

      <section ref={set(4)} className="ch ch--info" aria-label="O corpo">
        <Headline lines={['O corpo', 'acredita em', { em: 'cada um deles.' }]} />
        <div className="vitals"><b ref={bpmRef}>112</b><span>batimentos<br />por minuto</span></div>
        <ul className="chips"><li>Coração acelerado</li><li>Falta de ar</li><li>Mãos frias</li><li>Aperto no peito</li><li>Ombros tensos</li></ul>
      </section>

      <section ref={set(5)} className="ch ch--statement ch--dark" aria-label="Espiral">
        <p className="statement big">Tudo parece urgente. <strong>Nada parece seguro.</strong></p>
        <p className="source">É a espiral da ansiedade: o medo de sentir medo alimenta o próprio medo.</p>
      </section>

      <section ref={set(6)} className="ch ch--info" aria-label="Respire">
        <Headline lines={['Respire', { em: 'junto.' }]} />
        <div className="breath">
          <div className="ring"><i ref={el => (breathRefs.current.fill = el)} /></div>
          <div>
            <p className="breath-label" ref={el => (breathRefs.current.label = el)}>Inspire</p>
            <p className="breath-count" ref={el => (breathRefs.current.count = el)}>4 s</p>
          </div>
        </div>
        <p className="note">Puxe o ar por 4 segundos, segure por 4 e solte devagar por 6. Soltar o ar mais devagar do que puxa ajuda o corpo a desacelerar.</p>
      </section>

      <section ref={set(7)} className="ch ch--info" aria-label="Conversa">
        <Headline lines={['Às vezes, a saída', 'começa com', { em: 'uma pergunta.' }]} />
        <ChatBox text="Ei, tá tudo bem? Quer conversar?" active={live(7)} status="Alguém perto de você está ouvindo…" />
      </section>

      <section ref={set(8)} className="ch ch--final" id="ajuda" aria-label="Você não está só">
        <h2 className="sr-only">Você não está só.</h2>
        <p className="statement small">Ansiedade tem tratamento. Se está pesando, fale com alguém. Pedir ajuda é um gesto de cuidado.</p>
        <div className="help">
          <div className="help-card"><strong>188</strong><span>CVV, Centro de Valorização da Vida. Ligação gratuita, 24 horas, ou chat em <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer">cvv.org.br</a>.</span></div>
          <div className="help-card"><strong>CAPS e UBS</strong><span>Atendimento em saúde mental pelo SUS. Procure a unidade mais perto de você.</span></div>
        </div>
        <p className="fine">Em emergência, ligue 192 (SAMU). Esta é uma história informativa e não substitui acompanhamento profissional.</p>
      </section>

      <div className="anchors" aria-hidden="true">
        {THOUGHTS.map((t, i) => (
          <div key={i} ref={el => (thoughtRefs.current[i] = el)} className="thought">{t.text}</div>
        ))}
        {['talker0', 'talker1', 'friend'].map(n => (
          <div key={n} ref={el => (dotRefs.current[n] = el)} className="dots-bubble"><i /><i /><i /></div>
        ))}
      </div>
    </main>
  );
}

export { CHAPTERS };
