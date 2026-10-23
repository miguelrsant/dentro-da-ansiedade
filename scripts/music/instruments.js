const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// One felt-piano note: inharmonic partials that fade faster the higher they are (a quick drop, then a long
// tail), the two strings of the lower partials a cent apart and a little apart in stereo, placed where the
// note sits on the keyboard, and the thud of a felt hammer.
function pianoNote(ctx, m, seconds, R) {
  const SR = ctx.sampleRate, n = Math.ceil(seconds * SR), f = mtof(m);
  const buf = ctx.createBuffer(2, n, SR), L = buf.getChannelData(0), Rt = buf.getChannelData(1);
  const pan = Math.min(0.55, Math.max(-0.55, (m - 62) / 30));
  const tau0 = 2.6 * Math.pow(262 / f, 0.5), attack = Math.floor(0.005 * SR);
  for (let p = 1; p <= 12; p++) {
    const fp = f * p * Math.sqrt(1 + 0.00035 * p * p);
    if (fp > 7000) break;
    const a = Math.pow(p, -1.15) * Math.exp(-(p - 1) * 0.33);
    if (a < 0.004) continue;
    const tau = tau0 / (1 + 0.65 * (p - 1));
    const strings = p <= 3 ? [[-1.1, -0.12], [1.1, 0.12]] : [[0, 0]];
    for (const [cents, spread] of strings) {
      const w = (2 * Math.PI * fp * Math.pow(2, cents / 1200)) / SR, c2 = 2 * Math.cos(w);
      const th = ((Math.min(1, Math.max(-1, pan + spread)) + 1) * Math.PI) / 4, amp = a / strings.length;
      const gl = Math.cos(th) * amp, gr = Math.sin(th) * amp, ph = R() * 2 * Math.PI;
      let y1 = Math.sin(ph - w), y0 = Math.sin(ph), ef = 0.62, es = 0.38;
      const df = Math.exp(-1 / (SR * 0.25 * tau)), ds = Math.exp(-1 / (SR * 1.3 * tau));
      for (let k = 0; k < n; k++) {
        const e = (ef + es) * (k < attack ? k / attack : 1);
        L[k] += y0 * e * gl; Rt[k] += y0 * e * gr;
        const y = c2 * y0 - y1; y1 = y0; y0 = y;
        ef *= df; es *= ds;
        if (es < 2e-4) break;
      }
    }
  }
  // the hammer: a short thud of noise through a resonant bandpass around the note's brightest partials
  const fc = Math.min(2400, Math.max(300, f * 2.5)), q = 0.8, w0 = (2 * Math.PI * fc) / SR, al = Math.sin(w0) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - al) / a0;
  const th = ((pan + 1) * Math.PI) / 4, hl = Math.cos(th), hr = Math.sin(th), up = 0.002 * SR, fall = 0.01 * SR;
  let x1 = 0, x2 = 0, z1 = 0, z2 = 0;
  for (let k = 0; k < Math.min(n, Math.floor(0.08 * SR)); k++) {
    const env = k < up ? k / up : Math.exp(-(k - up) / fall), x = (R() * 2 - 1) * env * 0.12;
    const y = b0 * x + b2 * x2 - a1 * z1 - a2 * z2;
    x2 = x1; x1 = x; z2 = z1; z1 = y;
    L[k] += y * hl; Rt[k] += y * hr;
  }
  return buf;
}

// A synthetic hall: decaying noise that darkens as it fades, after a few early reflections.
function hall(ctx, seconds, rt60, R) {
  const SR = ctx.sampleRate, n = Math.floor(seconds * SR), pre = Math.floor(0.016 * SR);
  const b = ctx.createBuffer(2, n, SR);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const x = (i - pre) / SR, k = 0.12 + 0.8 * Math.min(1, x / 2.4);
      lp += (1 - k) * (R() * 2 - 1 - lp);
      d[i] = lp * Math.exp((-6.9 * x) / rt60) * (1 + 1.5 * k);
    }
    for (const [ms, a] of [[9, 0.45], [17, 0.32], [26, 0.26], [38, 0.2], [51, 0.14]]) {
      d[pre + Math.floor(((ms + c * 2.5) * SR) / 1000)] += (R() < 0.5 ? -1 : 1) * a * 0.3;
    }
  }
  return b;
}
