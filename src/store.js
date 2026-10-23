// Tiny shared state between the scroll handler, the 3D stage and the HTML overlay.
export const store = {
  progress: 0, // scroll position in scenes (0 .. N-1)
  smooth: 0, // eased progress used by the 3D stage and the overlay
  chapter: 0,
  anchors: {}, // name -> { x, y, visible } in CSS pixels
  bpm: 96,
  sound: 'armed', // the background music: 'armed' (waits for a click or tap), 'on' or 'off' (src/audio/music.js)
  breath: { label: 'Inspire', left: 4, s: 0 },
  loaded: false,
  failed: false,
  loadProgress: 0,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach(fn => fn());
