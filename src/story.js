// Everything the scroll story needs per chapter: palette, camera, crowd behaviour, titles.
// Colours are screen colours (the canvas renders without colour management, like the reference).

export const PALETTES = {
  lavender: { dark: '#3a46d8', bright: '#8fa8ff', fresnel: '#ff86d6', near: '#c5c4f2', mid: '#b9b8ec', far: '#b4b3e8' },
  mist: { dark: '#46508c', bright: '#b4bee6', fresnel: '#ffad78', near: '#b3bad0', mid: '#a9b0c9', far: '#a6adc6' },
  dusk: { dark: '#3d4c8c', bright: '#aec1ea', fresnel: '#ff9874', near: '#a9b5cf', mid: '#a1adca', far: '#9eabc8' },
  plum: { dark: '#30246f', bright: '#b6a8e0', fresnel: '#ffa98c', near: '#958db9', mid: '#8a82b2', far: '#8780af' },
  deep: { dark: '#1c2a8f', bright: '#7c9ff0', fresnel: '#ff6a3d', near: '#7f9fd0', mid: '#7194c8', far: '#6d90c6' },
  night: { dark: '#03061e', bright: '#2c49cc', fresnel: '#57d6d6', near: '#121c55', mid: '#0e174a', far: '#0c1443' },
  tide: { dark: '#1f4373', bright: '#a4ead4', fresnel: '#ff7f90', near: '#9ccac5', mid: '#90bfbb', far: '#8cbcb8' },
  rose: { dark: '#4f3f92', bright: '#c4b4ec', fresnel: '#ffc2ab', near: '#c9c0d8', mid: '#c0b6d1', far: '#bdb3cd' },
  dawn: { dark: '#5059d6', bright: '#b3c0ff', fresnel: '#ff9fdc', near: '#d2ccf3', mid: '#cbc5ef', far: '#c8c2ed' },
};

// cam: position, look target, vertical fov. side pushes the subject right so the left column stays free.
// focus: 'hero' | 'heroHead' | 'heroChest' | 'pair' | number (metres from camera). range: in-focus depth (m).
export const CHAPTERS = [
  {
    key: 'abertura', nav: 'Abertura', act: 0, palette: 'lavender', theme: 'light',
    cam: { pos: [0, 1.08, 4.3], tgt: [0, 1.0, 0], fov: 30, side: 0 },
    camMobile: { pos: [0, 1.05, 3.9], tgt: [0, 1.1, 0], fov: 46 },
    focus: 'hero', range: 1.4, bokeh: 4.2,
    mode: 'gather', heroPose: 'relaxed', heroLook: 'camera',
    title: { lines: ['Ansiedade'], size: 0.155, y: 0.43, yPortrait: 0.4, sizePortrait: 0.2, cutoffFrom: 'hero', cutoffAdd: 0.3 },
  },
  {
    key: 'tamanho', nav: 'O tamanho', act: 0, palette: 'mist', theme: 'light',
    cam: { pos: [0, 4.4, 12.5], tgt: [0, 0.6, -2.5], fov: 33, side: 0 },
    camMobile: { pos: [0, 5.2, 15], tgt: [0, 0.4, -2.5], fov: 44 },
    focus: 'hero', range: 3.5, bokeh: 3.2,
    mode: 'gather', heroPose: 'relaxed', heroLook: 'none',
    title: { lines: ['9,3%'], size: 0.3, y: 0.42, yPortrait: 0.36, sizePortrait: 0.42, cutoff: 13.2 },
  },
  {
    key: 'multidao', nav: 'Multidão', act: 0, palette: 'dusk', theme: 'light',
    cam: { pos: [0.4, 10.5, 8.2], tgt: [0, 0, -0.6], fov: 32, side: 1.6 },
    camMobile: { pos: [0.3, 12, 9.5], tgt: [0, 0, -2.6], fov: 44 },
    focus: 'hero', range: 3.5, bokeh: 3,
    mode: 'alone', heroPose: 'crossed', heroLook: 'down', anx: 0.25,
  },
  {
    key: 'pensamentos', nav: 'Pensamentos', act: 1, palette: 'plum', theme: 'light',
    cam: { pos: [0, 1.58, 2.5], tgt: [0, 1.5, 0], fov: 34, side: 0.8 },
    camMobile: { pos: [0, 1.55, 3.5], tgt: [0, 1.75, 0], fov: 48 },
    focus: 'heroHead', range: 0.7, bokeh: 5,
    mode: 'stare', heroPose: 'crossed', heroLook: 'down', anx: 0.7, glow: 'head',
  },
  {
    key: 'corpo', nav: 'O corpo', act: 1, palette: 'deep', theme: 'light',
    cam: { pos: [0, 1.3, 1.95], tgt: [0, 1.28, 0], fov: 36, side: 0.62 },
    camMobile: { pos: [0, 1.3, 2.9], tgt: [0, 1.55, 0], fov: 50 },
    focus: 'heroChest', range: 0.6, bokeh: 5,
    mode: 'close', heroPose: 'crossed', heroLook: 'down', anx: 1, glow: 'heart', bpm: 112,
  },
  {
    key: 'espiral', nav: 'Espiral', act: 1, palette: 'night', theme: 'dark',
    cam: { orbit: { radius: 6.4, height: 2.3, speed: 0.22 }, tgt: [0, 1.05, 0], fov: 38, side: 0 },
    camMobile: { orbit: { radius: 8.2, height: 2.6, speed: 0.22 }, tgt: [0, 1.2, 0], fov: 50 },
    focus: 'hero', range: 1.6, bokeh: 4,
    mode: 'spiral', heroPose: 'crossed', heroLook: 'down', anx: 1, shake: 1, glow: 'heart', bpm: 138,
  },
  {
    key: 'respire', nav: 'Respire', act: 2, palette: 'tide', theme: 'light',
    cam: { pos: [0, 1.42, 3.7], tgt: [0, 1.25, 0], fov: 34, side: 1.15 },
    camMobile: { pos: [0, 1.4, 5], tgt: [0, 1.55, 0], fov: 48 },
    focus: 'heroChest', range: 1.2, bokeh: 4,
    mode: 'calm', heroPose: 'relaxed', heroLook: 'camera', breath: true, glow: 'breath',
  },
  {
    key: 'conversa', nav: 'Conversa', act: 2, palette: 'rose', theme: 'light',
    // side-on to the pair (protagonist at the origin, friend at 1.1, 0.3), facing each other
    cam: { pos: [-0.75, 1.5, 4.95], tgt: [0.55, 1.32, 0.15], fov: 34, side: 1.05 },
    camMobile: { pos: [-0.9, 1.55, 5.3], tgt: [0.55, 1.65, 0.15], fov: 48 },
    focus: 'pair', range: 1.3, bokeh: 4,
    mode: 'talk', heroPose: 'relaxed', heroLook: 'friend', glow: 'soft',
  },
  {
    key: 'final', nav: 'Você não está só', act: 2, palette: 'dawn', theme: 'light',
    cam: { pos: [0, 2.2, 12.5], tgt: [0, 1.15, -1], fov: 32, side: 0 },
    camMobile: { pos: [0, 2.4, 15.5], tgt: [0, 1.6, -1], fov: 46 },
    focus: 'hero', range: 3, bokeh: 3,
    mode: 'together', heroPose: 'relaxed', heroLook: 'camera',
    title: { lines: ['Você não', 'está só.'], size: 0.118, y: 0.29, yPortrait: 0.3, sizePortrait: 0.19, leading: 0.95, cutoff: 9.5 },
  },
];

export const ACTS = [
  { name: 'O peso', from: 0, to: 2 },
  { name: 'Por dentro', from: 3, to: 5 },
  { name: 'A saída', from: 6, to: 8 },
];
