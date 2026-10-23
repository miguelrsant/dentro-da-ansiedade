// Bakes every person's final bone rotations in the 16 storyboard scenes, so the site can pose the
// characters without the mocap takes, the retargeting or the IK. Runs against the storyboard lab (lab-v2.zip) on
// localhost:5174. Usage: node bake-poses.cjs out.json
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 640, height: 360 } });
  pg.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)));
  await pg.goto('http://localhost:5174/board.html?hi=');
  await pg.waitForFunction(() => window.ready, null, { timeout: 120000 });
  await pg.evaluate(() => window.setup());
  const all = {};
  for (let i = 1; i <= 16; i++) {
    const id = 's' + String(i).padStart(2, '0');
    const t0 = Date.now();
    all[id] = await pg.evaluate(async id => {
      await sc[id]();
      const people = [], moved = new Set();
      for (const o of scene.children) {
        const opts = o.userData.opts; if (!opts) continue;
        const model = o.children[0];
        const ref = {};
        models[opts.name].scene.traverse(b => { if (b.isBone) ref[b.name] = b; });
        const q = {};
        model.traverse(b => {
          if (!b.isBone) return;
          const r = ref[b.name];
          if (b.name !== 'hip' && b.position.distanceTo(r.position) > 1e-5) moved.add(b.name);
          if (b.quaternion.angleTo(r.quaternion) > 1e-4 || b.name === 'hip') q[b.name] = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w].map(v => +v.toFixed(5));
        });
        const h = model.getObjectByName('hip').position;
        people.push({ name: opts.name, hip: [h.x, h.y, h.z].map(v => +v.toFixed(5)), q });
      }
      return { people, moved: [...moved] };
    }, id);
    console.log(id, all[id].people.length, 'people', all[id].moved.length ? 'moved: ' + all[id].moved.join(',') : '', Date.now() - t0, 'ms');
    all[id] = all[id].people;
  }
  fs.writeFileSync(out, JSON.stringify(all));
  console.log('bytes', fs.statSync(out).size);
  await b.close();
})();
