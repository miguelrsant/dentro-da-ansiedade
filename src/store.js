// Tiny shared state between the scroll handler, the 3D stage and the HTML overlay.
export const store = {
  progress: 0, // scroll position in scenes (0 .. N-1)
  smooth: 0, // eased progress used by the 3D stage and the overlay
  chapter: 0,
  anchors: {}, // name -> { x, y, visible } in CSS pixels
  bpm: 96,
  anx: 0.45, // how anxious he is (0..1), eased toward each scene's own
  pulse: 0, // the heart's envelope this frame (0..1): the flush on the screen and the readouts beat with it
  sound: 'armed', // the heartbeat sound: 'armed' (waits for a click or tap), 'on' or 'off' (src/audio/heart.js)
  breath: { label: 'Inspire', left: 4, s: 0 },
  loaded: false,
  failed: false,
  loadProgress: 0,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach(fn => fn());
