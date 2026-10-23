// Bakes gesture key poses for the site's movement (public/v2/motion.json): each key is a person's pose in one
// scene with a few pose-spec entries changed (an arm lifted, a palm turned up), built by the lab's own pose
// builder in the scene as it is, so the rest of the person matches the baked pose exactly. Only bones that move
// are kept. Runs against the storyboard lab (lab-v2.zip) on localhost:5174.
// Usage: node bake-motion.cjs out.json [shotdir] [ids...]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [out, shots, ...only] = process.argv.slice(2);
// per scene: who, and the spec entries each key changes (character frame: +x their left, +y up, +z forward;
// rel = the wrist relative to the hip joint)
const KEYS = {
  s08: { name: 'nathan', close: { yaw: -15, pitch: 5, dist: 2.0 }, keys: {
    // the right hand comes up in front, palm up, offering the point to the table
    open: { arm_r: { rel: [-0.24, 0.31, 0.34], pole: [-0.9, -1, -0.3] }, hand_r: { aim: [-0.05, 0.25, 1], palm: [0.3, 1, 0.3] }, open_r: true, curl_r: 12, nudge_r: [0, 0, 0] },
    // the left hand leaves the screen and turns to the people at the table
    turn: { arm_l: { rel: [0.3, 0.3, 0.33], pole: [0.9, -1, -0.3] }, hand_l: { aim: [0.1, 0.25, 1], palm: [-0.3, 1, 0.3] }, open_l: true, curl_l: 12, nudge_l: [0, 0, 0] },
  } },
  s12: { name: 'carla', close: { yaw: -40, pitch: 10, dist: 1.6 }, keys: {
    // her right hand (the side towards him) lifts off her thigh, open, palm up
    open: { arm_r: { rel: [-0.23, 0.3, 0.33], pole: [-0.9, -1, -0.3] }, hand_r: { aim: [-0.75, 0.25, 0.6], palm: [0.1, 1, 0.15] }, open_r: true, curl_r: 16, nudge_r: [0, 0, 0] },
  } },
  s13: { name: 'claudia', close: { yaw: -30, pitch: 10, dist: 1.6 }, keys: {
    // her right hand lifts off the notebook, palm up, as she talks
    explain: { arm_r: { rel: [-0.17, 0.27, 0.37], pole: [-0.9, -1, -0.3] }, hand_r: { aim: [-0.3, 0.3, 1], palm: [0.2, 1, 0.15] }, open_r: true, curl_r: 16, nudge_r: [0, 0, 0] },
  } },
};
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)));
  await pg.goto('http://localhost:5174/board.html?hi=');
  await pg.waitForFunction(() => window.ready, null, { timeout: 180000 });
  await pg.evaluate(() => window.setup());
  // fit() builds people through window.person: the hook swaps in a key's spec entries for one person
  await pg.evaluate(() => {
    const orig = window.person;
    window.person = (n, o) => (window.KEYHOOK && n === window.KEYHOOK.name ? orig(n, { ...o, pose: { ...o.pose, ...window.KEYHOOK.patch } }) : orig(n, o));
  });
  const res = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)) : { v: 1 };
  for (const [id, spec] of Object.entries(KEYS)) {
    if (only.length && !only.includes(id)) continue;
    const harvest = name => pg.evaluate(name => {
      const roots = scene.children.filter(o => o.userData.opts);
      const k = roots.findIndex(o => o.userData.opts.name === name), o = roots[k];
      const q = {};
      o.children[0].traverse(b => { if (b.isBone) q[b.name] = [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]; });
      const self = window.qa.selfHits ? window.qa.selfHits(o) : null;
      return { k, q, self };
    }, name);
    await pg.evaluate(id => { window.KEYHOOK = null; return sc[id](); }, id);
    const base = await harvest(spec.name);
    const shoot = async tag => {
      if (!shots) return;
      await pg.screenshot({ path: `${shots}/${id}-${tag}.png` });
      if (spec.close) { await pg.evaluate(([n, c]) => window.qa.close(n, 'spine_03', c), [spec.name, spec.close]); await pg.screenshot({ path: `${shots}/${id}-${tag}-close.png` }); }
    };
    await shoot('base');
    const entry = { k: base.k, name: spec.name, keys: {} };
    for (const [key, patch] of Object.entries(spec.keys)) {
      await pg.evaluate(([id, name, patch]) => { window.KEYHOOK = { name, patch }; return sc[id](); }, [id, spec.name, patch]);
      const kq = await harvest(spec.name);
      await shoot(key);
      const q = {};
      for (const [bn, v] of Object.entries(kq.q)) {
        const a = base.q[bn], dot = Math.abs(a[0] * v[0] + a[1] * v[1] + a[2] * v[2] + a[3] * v[3]);
        const deg = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
        if (deg > 0.1) q[bn] = v.map(x => +x.toFixed(4));
      }
      entry.keys[key] = { q };
      console.log(id, spec.name, key, Object.keys(q).length, 'bones', 'self:', JSON.stringify(kq.self).slice(0, 300), 'base self:', JSON.stringify(base.self).slice(0, 200));
    }
    await pg.evaluate(id => { window.KEYHOOK = null; return sc[id](); }, id);
    res[id] = [entry];
  }
  fs.writeFileSync(out, JSON.stringify(res));
  console.log('bytes', fs.statSync(out).size);
  await b.close();
})();
