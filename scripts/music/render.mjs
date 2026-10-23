// Renders the site music to a WAV (needs Playwright; NODE_PATH pointing at its node_modules):
//   node scripts/music/render.mjs out/musica.wav
// then: ffmpeg -i out/musica.wav -c:a libmp3lame -b:a 128k public/audio/respira.mp3
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.dirname(fileURLToPath(import.meta.url));
const [dest = 'out/musica.wav'] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : 'text/javascript' });
    res.end(data);
  });
}).listen(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('erro:', e.message));
  page.on('console', m => console.error('console:', m.text().slice(0, 300)));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  const t0 = Date.now();
  const info = await page.evaluate(async () => {
    const buf = await renderMusic();
    const ch = buf.numberOfChannels, n = buf.length, data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    const bytes = new Uint8Array(44 + n * ch * 2), dv = new DataView(bytes.buffer);
    const w = (o, s) => { for (let i = 0; i < 4; i++) bytes[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, buf.sampleRate, true);
    dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    let o = 44, peak = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
      const x = data[c][i];
      peak = Math.max(peak, Math.abs(x));
      const y = Math.max(-1, Math.min(1, x));
      dv.setInt16(o, y < 0 ? y * 0x8000 : y * 0x7fff, true); o += 2;
    }
    window.__wav = bytes;
    return { size: bytes.length, peak, sr: buf.sampleRate, loop: LOOP };
  });
  const parts = [];
  for (let off = 0; off < info.size; off += 3 << 20) {
    const b64 = await page.evaluate(({ off, len }) => {
      const u = window.__wav.subarray(off, off + len);
      let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    }, { off, len: 3 << 20 });
    parts.push(Buffer.from(b64, 'base64'));
  }
  fs.mkdirSync(path.dirname(path.resolve(root, dest)), { recursive: true });
  fs.writeFileSync(path.resolve(root, dest), Buffer.concat(parts));
  console.log(`${dest}: pico ${(20 * Math.log10(info.peak)).toFixed(1)} dBFS, loop ${info.loop.toFixed(3)} s, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} finally {
  await browser.close();
  server.close();
}
