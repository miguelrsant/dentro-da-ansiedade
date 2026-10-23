/* "Respira": the site's background music. A felt piano over a soft string pad, 68 BPM, in F major and its
   relative D minor, 32 bars that end on C and start again on D minor, so it never quite resolves and can loop
   forever. The file holds one pass from silence plus its reverb tail; the site starts the next pass exactly
   LOOP seconds after the last one, so each tail rings over the next start.
   Uses the piano and the hall of the video's score (instruments.js). */

const BPM = 68, BEAT = 60 / BPM, BAR = 4 * BEAT, BARS = 32;
const LOOP = BARS * BAR; // 112.94 s
const TAIL = 4;
const MASTER = 1.0; // set from the measured loudness, about -18 LUFS

// chords: bass (held sine), pad (strings), arp (piano, low to high)
const C = {
  Dm9: { bass: 38, pad: [57, 60, 64, 65], arp: [50, 57, 64, 65, 69, 72] },
  Bbmaj9: { bass: 34, pad: [57, 60, 62, 65], arp: [46, 53, 60, 62, 65, 69] },
  FA: { bass: 33, pad: [57, 60, 64, 67], arp: [45, 52, 60, 64, 65, 67] },
  Gm9: { bass: 31, pad: [58, 62, 65, 69], arp: [43, 50, 58, 62, 65, 69] },
  FC: { bass: 36, pad: [57, 60, 64, 67], arp: [48, 53, 57, 60, 64, 67] },
  Csus: { bass: 36, pad: [55, 60, 65, 67], arp: [48, 55, 60, 65, 67, 72] },
  C: { bass: 36, pad: [55, 60, 64, 67], arp: [48, 55, 60, 64, 67, 72] },
  FA9: { bass: 33, pad: [53, 57, 60, 67], arp: [45, 53, 57, 60, 65, 67] },
  Cadd9: { bass: 36, pad: [55, 60, 62, 64], arp: [48, 55, 62, 64, 67, 72] },
  Bbmaj7: { bass: 34, pad: [57, 62, 65], arp: [46, 53, 57, 62, 65, 69] },
  Am7: { bass: 33, pad: [55, 60, 64], arp: [45, 52, 55, 60, 64, 67] },
};
const A = ['Dm9', 'Bbmaj9', 'FA', 'Gm9', 'Dm9', 'Bbmaj9', 'FC', 'Csus'];
const B = ['Bbmaj9', 'FA9', 'Gm9', 'Cadd9', 'Bbmaj7', 'Am7', 'Gm9', 'Csus'];
const FORM = [...A, ...B, ...A, ...B];

// per bar: piano touch, pattern, pad level, bass level (0 = none)
function feel(bar) {
  const sec = Math.floor(bar / 8), k = bar % 8;
  if (sec === 0) return { vel: 0.2 + 0.006 * k, style: 'flow', pad: 0.26 + 0.02 * k, bass: k >= 4 ? 0.18 : 0 };
  if (sec === 1) return { vel: 0.26, style: 'warm', pad: 0.42, bass: 0.26 };
  if (sec === 2) return { vel: 0.24, style: 'flow', pad: 0.38, bass: 0.24 };
  // the last part thins out into the start again
  const fade = k < 4 ? 1 : 1 - (k - 3) * 0.11;
  return { vel: 0.27 * fade, style: 'warm', pad: 0.44 * fade, bass: 0.26 * fade };
}

// melodies: [bar, beat (1-based), note, beats]
const MELODY = [
  // A: A C E | D | C A G | F E
  [4, 2, 69, 1], [4, 3, 72, 1], [4, 4, 76, 1], [5, 1, 74, 3], [6, 1, 72, 1.5], [6, 2.5, 69, 0.5], [6, 3, 67, 2], [7, 1, 65, 2], [7, 3, 64, 2],
  // B: F D C | C A C | D C Bb | G ; F E D | E C | D C Bb A | G F E
  [8, 1, 77, 2], [8, 3, 74, 1], [8, 4, 72, 1], [9, 1, 72, 2], [9, 3, 69, 1], [9, 4, 72, 1], [10, 1, 74, 1.5], [10, 2.5, 72, 0.5], [10, 3, 70, 2], [11, 1, 67, 4],
  [12, 1, 77, 2], [12, 3, 76, 1], [12, 4, 74, 1], [13, 1, 76, 2], [13, 3, 72, 2], [14, 1, 74, 1.5], [14, 2.5, 72, 0.5], [14, 3, 70, 1], [14, 4, 69, 1], [15, 1, 67, 2], [15, 3, 65, 1], [15, 4, 64, 1],
  // A': A E F | D C | C A | Bb A G | A C E | F | E D C | D E
  [16, 1, 81, 2], [16, 3, 76, 1], [16, 4, 77, 1], [17, 1, 74, 3], [17, 4, 72, 1], [18, 1, 72, 2], [18, 3, 69, 2], [19, 1, 70, 1], [19, 2, 69, 1], [19, 3, 67, 2],
  [20, 2, 69, 1], [20, 3, 72, 1], [20, 4, 76, 1], [21, 1, 77, 3], [22, 1, 76, 1.5], [22, 2.5, 74, 0.5], [22, 3, 72, 2], [23, 1, 74, 2], [23, 3, 76, 2],
  // B': as B, then it lets go
  [24, 1, 77, 2], [24, 3, 74, 1], [24, 4, 72, 1], [25, 1, 72, 2], [25, 3, 69, 1], [25, 4, 72, 1], [26, 1, 74, 1.5], [26, 2.5, 72, 0.5], [26, 3, 70, 2], [27, 1, 67, 4],
  [28, 1, 77, 3], [29, 1, 76, 2], [29, 3, 72, 2], [30, 1, 74, 4],
];
// glass bells in A': [bar, beat, note]
const BELLS = [[16, 1, 88], [18, 1, 84], [20, 3, 88], [21, 1, 86], [22, 1, 84]];

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function renderMusic({ sampleRate = 44100 } = {}) {
  const SR = sampleRate, R = mulberry(2026);
  const ctx = new OfflineAudioContext(2, Math.ceil((LOOP + TAIL) * SR), SR);
  const at = (bar, beat = 1) => bar * BAR + (beat - 1) * BEAT;

  // mix: buses into a hall, a gentle compressor and a limiter
  const hp = ctx.createBiquadFilter(), level = ctx.createGain(), comp = ctx.createDynamicsCompressor(), limit = ctx.createDynamicsCompressor();
  hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.6;
  level.gain.value = MASTER;
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 1.8; comp.attack.value = 0.03; comp.release.value = 0.4;
  limit.threshold.value = -4; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.15;
  // a little air on top, so the felt piano still speaks on laptop speakers
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf'; air.frequency.value = 2600; air.gain.value = 3;
  hp.connect(air); air.connect(level); level.connect(comp); comp.connect(limit); limit.connect(ctx.destination);
  const verb = ctx.createConvolver(), verbIn = ctx.createBiquadFilter();
  verb.buffer = hall(ctx, 4, 3.1, R);
  verbIn.type = 'highpass'; verbIn.frequency.value = 200; verbIn.Q.value = 0.5;
  verbIn.connect(verb); verb.connect(hp);
  const bus = (lv, dry, wet) => {
    const g = ctx.createGain(), d = ctx.createGain(), w = ctx.createGain();
    g.gain.value = lv; d.gain.value = dry; w.gain.value = wet;
    g.connect(d); d.connect(hp); g.connect(w); w.connect(verbIn);
    return g;
  };
  const pianoBus = bus(0.5, 0.78, 0.5), padBus = bus(0.42, 0.65, 0.55), bassBus = bus(0.065, 1, 0.08), bellBus = bus(0.4, 0.55, 0.7);

  // the piano: notes first, then each pitch is synthesised once and played back
  const notes = [];
  const piano = (t, m, vel, dur) => notes.push({ t: Math.max(0, t), m, vel, dur });

  FORM.forEach((name, bar) => {
    const ch = C[name], f = feel(bar), t0 = at(bar);
    const arp = ch.arp;
    const pat = f.style === 'warm' ? [0, 2, 3, 4, 5, 4, 3, 2] : [0, 1, 2, 3, 5, 3, 2, 1];
    const acc = f.style === 'warm' ? [1.2, 0.86, 0.92, 0.9, 1.04, 0.9, 0.92, 0.84] : [1.25, 0.86, 0.94, 0.9, 1.04, 0.9, 0.94, 0.84];
    for (let k = 0; k < 8; k++) {
      // the sus4 bar resolves on its third beat
      const notesOf = name === 'Csus' && k >= 4 ? C.C.arp : arp;
      const t = t0 + k * BEAT / 2 + (R() - 0.5) * 0.012 + (k === 0 ? 0 : 0.004);
      piano(t, notesOf[pat[k]], f.vel * acc[k] * (0.9 + 0.2 * R()), k === 0 ? 4 * BEAT : 1.7 * BEAT);
    }
    // the pad crossfades from chord to chord
    const padChord = (c, a, b) => pad(a, b, c, f.pad);
    if (name === 'Csus') { padChord(C.Csus.pad, t0 - 0.12, t0 + 2 * BEAT); padChord(C.C.pad, t0 + 2 * BEAT - 0.2, t0 + BAR + 0.1); }
    else padChord(ch.pad, t0 - 0.12, t0 + BAR + 0.1);
    if (f.bass) bassHold(t0, t0 + BAR, ch.bass, f.bass);
  });
  for (const [bar, beat, m, len] of MELODY) {
    const f = feel(bar), t = at(bar, beat);
    piano(t + (R() - 0.5) * 0.01, m, Math.min(0.5, f.vel * 1.5) * (0.94 + 0.12 * R()), len * BEAT * 1.08);
  }
  for (const [bar, beat, m] of BELLS) bell(at(bar, beat), m, 0.06, 2.2, bellBus, 0.25);

  const need = {};
  for (const n of notes) need[n.m] = Math.max(need[n.m] || 0, n.dur + 1.6);
  const samples = {};
  for (const m in need) samples[m] = pianoNote(ctx, +m, Math.min(12, need[m]), R);
  for (const n of notes) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), end = n.t + n.dur;
    s.buffer = samples[n.m];
    g.gain.setValueAtTime(n.vel, n.t);
    g.gain.setTargetAtTime(0, end, 0.16);
    s.connect(g); g.connect(pianoBus);
    s.start(n.t); s.stop(Math.min(n.t + s.buffer.duration, end + 1.6));
  }

  // A string pad: a sawtooth and a triangle per note, through a lowpass that drifts slowly.
  function pad(t0, t1, chord, lv, { attack = 1.3, release = 0.6, cutoff = 950 } = {}) {
    const env = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.3;
    lfo.frequency.value = 0.08 + R() * 0.05; depth.gain.value = cutoff * 0.22;
    lfo.connect(depth); depth.connect(lp.frequency);
    const a = Math.max(0, t0), hold = Math.max(a + attack, t1), end = hold + release * 9;
    env.gain.setValueAtTime(0, a);
    env.gain.linearRampToValueAtTime(lv, a + attack);
    env.gain.setValueAtTime(lv, hold);
    env.gain.setTargetAtTime(0, hold, release);
    lp.connect(env); env.connect(padBus);
    lfo.start(a); lfo.stop(end);
    chord.forEach((m, k) => {
      const pan = ctx.createStereoPanner();
      pan.pan.value = chord.length > 1 ? (k / (chord.length - 1) - 0.5) * 0.8 : 0;
      pan.connect(lp);
      for (const [type, dc, l] of [['sawtooth', -6, 0.3], ['triangle', 5, 0.6]]) {
        const o = ctx.createOscillator(), v = ctx.createGain();
        o.type = type; o.frequency.value = mtof(m); o.detune.value = dc + (R() - 0.5) * 4;
        v.gain.value = l / chord.length;
        o.connect(v); v.connect(pan);
        o.start(a); o.stop(end);
      }
    });
  }
  // Bass: a sine with a little of its second and third harmonics, so small speakers hear the note.
  function bassHold(t0, t1, m, lv, { attack = 0.3, release = 0.4 } = {}) {
    const g = ctx.createGain(), hold = Math.max(t0 + attack, t1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(lv, t0 + attack);
    g.gain.setValueAtTime(lv, hold);
    g.gain.setTargetAtTime(0, hold, release);
    g.connect(bassBus);
    for (const [r, a] of [[1, 1], [2, 0.28], [3, 0.07]]) {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.frequency.value = mtof(m) * r; v.gain.value = a;
      o.connect(v); v.connect(g);
      o.start(t0); o.stop(hold + release * 9);
    }
  }
  function bell(t, m, amp, decay, dest, panv = 0) {
    const f = mtof(m);
    for (const [r, a, d] of [[1, 1, 1], [2, 0.3, 0.5], [3, 0.12, 0.3], [4.16, 0.06, 0.18], [5.43, 0.03, 0.12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
      o.frequency.value = f * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * a, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, decay * d);
      p.pan.value = panv;
      o.connect(g); g.connect(p); p.connect(dest);
      o.start(t); o.stop(t + decay * d * 9 + 0.01);
    }
  }

  return ctx.startRendering();
}
