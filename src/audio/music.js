import { store, emit, subscribe } from '../store.js';

// The background music: an original piano piece (public/audio/respira.mp3) that loops for as long as the
// visitor stays. Each pass starts exactly LOOP seconds after the one before, while the last notes of that one
// still ring, so the seam is not heard. Browsers only start sound after a click, a tap or a key, so it comes
// on with the first one, unless the visitor turned it off before; the button in the corner turns it on and
// off, and the choice is remembered.

const FILE = `${import.meta.env.BASE_URL}audio/respira.mp3`;
const LOOP = (32 * 4 * 60) / 68; // one pass: 32 bars at 68 BPM (the file holds 4 s more of reverb tail)
const LEVEL = 0.8;
const KEY = 'dda-sound';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = v => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } };
// the video capture runs the site on a virtual clock and lays its own soundtrack under it
const capture = typeof window !== 'undefined' && !!window.__clock;

// 'armed': on, waiting for the first gesture; 'on': playing; 'off': turned off by the visitor
store.sound = capture ? 'on' : read() === 'off' ? 'off' : 'armed';

let ctx = null, out = null, buffer = null, loading = null, next = 0, pumpTimer = 0, sleepTimer = 0;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);
  ctx.onstatechange = settle;
  return true;
}

// The file is fetched once the story has loaded and decoded at 32 kHz (nothing in the piano is higher, and
// it takes a third less memory than the usual 48 kHz).
function load() {
  if (loading) return;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const decoder = OAC ? new OAC(2, 1, 32000) : ctx;
  if (!decoder) return;
  loading = fetch(FILE)
    .then(r => { if (!r.ok) throw new Error(`${FILE}: ${r.status}`); return r.arrayBuffer(); })
    .then(data => new Promise((res, rej) => decoder.decodeAudioData(data, res, rej)))
    .then(b => { buffer = b; pump(); })
    .catch(e => { console.warn(e); loading = null; });
}

// keeps the next pass on the audio clock a few seconds ahead
function pump() {
  clearTimeout(pumpTimer);
  if (!buffer || !ctx || store.sound !== 'on' || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (next < now) next = now + 0.1;
  while (next < now + 6) {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.connect(out);
    s.start(next);
    next += LOOP;
  }
  pumpTimer = setTimeout(pump, 2000);
}

// once the browser lets the sound run, fade it in
function settle() {
  if (!ctx || ctx.state !== 'running') return;
  if (store.sound === 'armed') { store.sound = 'on'; emit(); }
  if (store.sound !== 'on') return;
  out.gain.cancelScheduledValues(ctx.currentTime);
  out.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.9);
  pump();
}

function start() {
  if (capture || (!ctx && !build())) return;
  clearTimeout(sleepTimer);
  load();
  if (ctx.state === 'running') return settle();
  ctx.resume().then(settle, () => {});
  // older iPhones only open the output for a sound started inside the gesture
  const s = ctx.createBufferSource();
  s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  s.connect(ctx.destination); s.start();
}

if (!capture && typeof window !== 'undefined') {
  // the first click, tap or key anywhere (the button handles its own)
  const onGesture = e => {
    if (store.sound === 'armed' && !e.target?.closest?.('.sound-btn')) start();
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) addEventListener(type, onGesture, { capture: true, passive: true });
  // nothing plays in a hidden tab
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (store.sound === 'on') ctx.resume().then(pump, () => {});
  });
  // the music downloads after the story, so it never slows the scene down
  const unsub = subscribe(() => { if (store.loaded) { unsub(); if (store.sound !== 'off') load(); } });
}

export function toggleSound() {
  if (capture) return;
  if (store.sound === 'on') {
    store.sound = 'off';
    write('off');
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    // the clock stops with the sound, so the music picks up where it was when it comes back
    sleepTimer = setTimeout(() => { if (store.sound === 'off') ctx.suspend(); }, 700);
    emit();
    return;
  }
  write('on');
  store.sound = 'armed';
  start();
  emit();
}
