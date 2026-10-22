// Bakes the RenderPeople characters into assets-src/raw/*.glb (AO, skin and hair masks in vertex colours).
//
// Setup (only needed to re-bake; the baked files are already in assets-src/raw):
//   1. Download the free RenderPeople characters listed below (FBX) into assets-src/renderpeople/<name>/,
//      plus small PNG copies of each diffuse and the two clothing masks into assets-src/renderpeople/small/.
//   2. From the project root: npx http-server -p 8765 -c-1   (any static server on the project root works)
//   3. node scripts/bake/run-bake.cjs [names...]   then   node scripts/optimize.mjs
// Needs Playwright with Chromium (WebGL through SwiftShader is enough).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'assets-src/raw/');
const SERVER = process.env.BAKE_SERVER || 'http://localhost:8765';
const RP = '/assets-src/renderpeople';
const L = [
  { out: 'sophia', fbx: `${RP}/rp_sophia_animated_003_idling/rp_sophia_animated_003_idling.fbx`, prefix: 'rp_sophia_animated_003_idling_', clip: 'idle', tex: `${RP}/small/rp_sophia_animated_003` },
  { out: 'nathan', fbx: `${RP}/rp_nathan_animated_003_walking/rp_nathan_animated_003_walking.fbx`, prefix: 'rp_nathan_animated_003_walking_', clip: 'walk', inPlace: true, tex: `${RP}/small/rp_nathan_animated_003` },
  { out: 'eric', fbx: `${RP}/rp_eric_rigged_001/rp_eric_rigged_001_u3d.fbx`, tex: `${RP}/small/rp_eric_rigged_001` },
  { out: 'carla', fbx: `${RP}/rp_carla_rigged_001/rp_carla_rigged_001_u3d.fbx`, tex: `${RP}/small/rp_carla_rigged_001` },
  { out: 'claudia', fbx: `${RP}/rp_claudia_rigged_002/rp_claudia_rigged_002_u3d.fbx`, tex: `${RP}/small/rp_claudia_rigged_002` },
  { out: 'manuel', fbx: `${RP}/rp_manuel_animated_001_dancing/rp_manuel_animated_001_dancing.fbx`, prefix: 'rp_manuel_animated_001_dancing_', tex: `${RP}/small/rp_manuel_animated_001` },
];
const only = process.argv.slice(2);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=8192'] });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
  await pg.goto(`${SERVER}/scripts/bake/bake.html`);
  await pg.waitForFunction(() => window.ready);
  for (const cfg of L) {
    // sophia carries the idle clip the others are posed with for the AO bake, so she always goes first
    if (only.length && !only.includes(cfg.out) && cfg.out !== 'sophia') continue;
    const r = await pg.evaluate(c => window.bake(c), cfg);
    fs.writeFileSync(OUT + cfg.out + '.glb', Buffer.from(r.b64, 'base64'));
    console.log(JSON.stringify(r.info));
  }
  await b.close();
})();
