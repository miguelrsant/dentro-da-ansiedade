// Bakes the posed scans without a skeleton (Dennis, Mei, Fabienne with Percy) into assets-src/raw/*.glb, in the
// same vertex-colour layout as the rigged people. Setup as in run-bake.cjs: the free RenderPeople posed OBJ
// downloads go in assets-src/renderpeople/posed/<name>/, a static server runs on the project root, then
//   node scripts/bake/run-bake-static.cjs [names...]   and   node scripts/optimize.mjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets-src/raw/');
const SERVER = process.env.BAKE_SERVER || 'http://localhost:8765';
const P = '/assets-src/renderpeople/posed/';
const L = [
  {
    out: 'dennis', obj: P + 'rp_dennis_posed_004/rp_dennis_posed_004_30k.obj', tex: P + 'rp_dennis_posed_004/tex/rp_dennis_posed_004_dif_2k.jpg',
    hairRects: [[800, 95, 975, 255, 0.3, 1]],
  },
  {
    out: 'mei', obj: P + 'rp_mei_posed_001/rp_mei_posed_001_30k.obj', tex: P + 'rp_mei_posed_001/tex/rp_mei_posed_001_dif_2k.jpg',
    hairRects: [[385, 0, 490, 92], [40, 88, 265, 395]],
  },
  {
    out: 'fabienne', obj: P + 'rp_fabienne_percy_posed_001/rp_fabienne_percy_posed_001_60k.obj', tex: P + 'rp_fabienne_percy_posed_001/tex/rp_fabienne_percy_posed_001_dif_2k.jpg',
    minL: 0.12,
    notSkin: [[165, 45, 350, 190], [40, 45, 180, 155], [830, 485, 1024, 645], [845, 25, 975, 95], [0, 700, 300, 1024], [55, 110, 250, 305], [205, 290, 330, 395], [705, 640, 840, 710]],
    hairRects: [[55, 110, 250, 305, 0, 0.22], [0, 700, 300, 1024], [205, 290, 330, 395], [705, 640, 840, 710]],
  },
];
const only = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
  await pg.goto(`${SERVER}/scripts/bake/bake-static.html`);
  await pg.waitForFunction(() => window.ready);
  for (const cfg of L) {
    if (only.length && !only.includes(cfg.out)) continue;
    const r = await pg.evaluate(c => window.bake(c), cfg);
    fs.writeFileSync(OUT + cfg.out + '.glb', Buffer.from(r.b64, 'base64'));
    console.log(JSON.stringify(r.info));
  }
  await b.close();
})();
