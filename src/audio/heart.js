import { store, emit } from '../store.js';

// The heartbeat the visitor hears: a deep "tu" on each of his heartbeats and a lighter "tum" a quarter beat
// later, the same beats as the glow on his chest and the flush on the screen (stage.js), as loud as he is
// anxious in the scene. Browsers only start sound after a click, a tap or a key, so it comes on with the
// first one, unless the visitor turned it off before; the button in the corner turns it on and off, and
// the choice is remembered.

const KEY = 'dda-sound';
const LEVEL = 0.7;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = v => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } };
// the video capture runs the site on a virtual clock and lays its own soundtrack under it
const capture = typeof window !== 'undefined' && !!window.__clock;

// 'armed': on, waiting for the first gesture; 'on': playing; 'off': turned off by the visitor
store.sound = capture ? 'on' : read() === 'off' ? 'off' : 'armed';

let ctx = null, out = null, tone = null, lubs = [], dubs = [], take = 0, next = null;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = 0;
  // muffled while he is calm, harder as he gets anxious
  tone = ctx.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = 400; tone.Q.value = 0.5;
  tone.connect(out); out.connect(ctx.destination);
  // three takes of each sound, so no two beats are exactly alike
  lubs = [0, 1, 2].map(() => thump(ctx, 62, 40, 0.06, 1, Math.random));
  dubs = [0, 1, 2].map(() => thump(ctx, 74, 50, 0.045, 0.7, Math.random));
  ctx.onstatechange = settle;
  return true;
}

// once the browser lets the sound run, fade it in
function settle() {
  if (ctx.state !== 'running' || store.sound !== 'armed') return;
  store.sound = 'on';
  out.gain.cancelScheduledValues(ctx.currentTime);
  out.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.5);
  emit();
}

function start() {
  if (capture || (!ctx && !build())) return;
  store.sound = 'armed';
  if (ctx.state === 'running') return settle();
  ctx.resume().then(settle, () => {});
  // older iPhones only open the output for a sound started inside the gesture
  const s = ctx.createBufferSource();
  s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  s.connect(ctx.destination); s.start();
}

// the first click, tap or key anywhere (the button handles its own)
const onGesture = e => {
  if (store.sound === 'armed' && !e.target?.closest?.('.sound-btn')) start();
};
if (!capture && typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) addEventListener(type, onGesture, { capture: true, passive: true });
  // nothing plays in a hidden tab
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (store.sound === 'on') ctx.resume();
  });
}

export function toggleSound() {
  if (capture) return;
  if (store.sound === 'on') {
    store.sound = 'off';
    write('off');
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
    emit();
    return;
  }
  write('on');
  start();
  emit();
}

// Called by stage.js every frame with the beats counted so far, the heart rate and how anxious he is (0..1):
// puts the beats of the next 120 ms on the audio clock, at the moment the counter will cross them.
export function heartbeat(beat, bpm, anx) {
  if (!ctx || store.sound !== 'on' || ctx.state !== 'running') { next = null; return; }
  const per = 60 / bpm;
  if (next === null || next < beat - 0.02) next = Math.ceil(beat);
  while ((next - beat) * per < 0.12) {
    const at = ctx.currentTime + Math.max(0, (next - beat) * per - (ctx.outputLatency || 0));
    play(at, per, anx);
    next++;
  }
}

function play(at, per, anx) {
  if (anx < 0.02) return;
  const g = ctx.createGain();
  g.gain.value = Math.min(1, anx);
  g.connect(tone);
  tone.frequency.setTargetAtTime(220 + 900 * anx, at, 0.1);
  for (const [buf, t] of [[lubs[take % 3], at], [dubs[(take + 1) % 3], at + per * 0.25]]) {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.connect(g); s.start(t);
  }
  take++;
}

// One heartbeat sound: a sine that drops from f1 to f2 Hz with its octave and twelfth, and a muffled knock
// of low noise, rounded by a soft clip so small speakers still hear the knock. The video's soundtrack
// (score.js) uses the same function.
export function thump(ctx, f1, f2, decay, level, R) {
  const SR = ctx.sampleRate, n = Math.floor((decay * 10 + 0.05) * SR);
  const buf = ctx.createBuffer(1, n, SR), d = buf.getChannelData(0);
  const w0 = (2 * Math.PI * 300) / SR, al = Math.sin(w0) / (2 * 0.7), a0 = 1 + al;
  const b0 = (1 - Math.cos(w0)) / 2 / a0, b1 = (1 - Math.cos(w0)) / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - al) / a0;
  const drive = 2.2, norm = Math.tanh(drive);
  let ph = 0, x1 = 0, x2 = 0, z1 = 0, z2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, f = t < 0.12 ? f1 * Math.pow(f2 / f1, t / 0.12) : f2;
    ph += (2 * Math.PI * f) / SR;
    const e1 = t < 0.008 ? t / 0.008 : t < 0.02 ? 1 : Math.exp(-(t - 0.02) / decay);
    const e2 = t < 0.006 ? t / 0.006 : t < 0.015 ? 1 : Math.exp(-(t - 0.015) / (decay * 0.5));
    const en = t < 0.003 ? t / 0.003 : t < 0.006 ? 1 : Math.exp(-(t - 0.006) / 0.02);
    const x = (R() * 2 - 1) * en * 1.4;
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * z1 - a2 * z2;
    x2 = x1; x1 = x; z2 = z1; z1 = y;
    const v = Math.sin(ph) * e1 + (0.32 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph)) * e2 + y;
    d[k] = (level * Math.tanh(drive * v)) / norm;
  }
  return buf;
}
