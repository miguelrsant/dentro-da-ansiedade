// Tiny shared state between the scroll handler, the 3D director and the HTML overlay.
export const store = {
  progress: 0, // scroll position in chapters (0 .. N-1)
  smooth: 0, // eased progress used by the 3D scene and the overlay
  chapter: 0,
  pointer: { x: 0, y: 0 },
  anchors: {}, // name -> { x, y, visible } in CSS pixels
  bpm: 72,
  breath: { label: 'Inspire', left: 4, s: 0 },
  loaded: false,
  loadProgress: 0,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const listeners = new Set();
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach(fn => fn());
