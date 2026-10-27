import * as THREE from 'three';

// Pose building for still frames (sitting, lying, holding things), on top of the bind pose or of a frame
// of the idle / walk capture. Character space: +z forward, +y up, +x the character's left, floor at y = 0.
// A pose maps names to:
//   bone: { aim: [x, y, z], twist }   point the bone (towards its main child) along a direction
//   bone: { rot: [x, y, z, order] }   extra rotation (degrees) on top of the parent's
//   hand_l / hand_r: { palm: [x, y, z] } turn the palm towards a direction (the forearm takes half the twist)
//   leg_l / leg_r / arm_l / arm_r: two-bone IK. { to: [x, y, z] } puts the foot sole (legs) or the wrist (arms)
//     at a point; { rel: [x, y, z] } is the same point relative to the hip joint, in the body frame;
//     { at: ['head', [x, y, z]] } is relative to a bone that is already posed. pole: where the knee / elbow points.
//   hip: { pos, rot } places and turns the pelvis. curl_l / curl_r: finger curl in degrees (grip_l / grip_r: its
//   share per joint, knuckle to tip).
//   level: (lab) the chest is brought upright sideways and the head level, after the pose is built.
//   frame: 'body' reads every aim, pole and rel point in the frame of the turned pelvis, so a pose can be
//     designed upright and then laid down by hip.rot.
//   look: [x, y, z] turns the neck and head so the face points at a spot (character space), whatever the
//     starting pose's head was doing.
//   plant: legs without their own target keep the starting pose's feet where they were (moved along with the
//     hip sideways, not up), so a captured sitting pose can be put on a seat of another height.
//   flat: feet with a `to` target stand flat on the floor the way the person's own shoes stand in the bind pose
//     (heels included), turned the way the knee points, instead of keeping the capture's foot angle and height.
// On a captured base, knees and elbows bend the way the capture bends them unless a pole is given, and the
// collarbones follow arms that reach up or forward.
const AIM_CHILD = {
  hip: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck', neck: 'head',
  upperleg_l: 'lowerleg_l', lowerleg_l: 'foot_l', foot_l: 'ball_l',
  upperleg_r: 'lowerleg_r', lowerleg_r: 'foot_r', foot_r: 'ball_r',
  shoulder_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l',
  shoulder_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', hand_r: 'middle_01_r',
};
const LIMBS = {
  leg_l: ['upperleg_l', 'lowerleg_l', 'foot_l'], leg_r: ['upperleg_r', 'lowerleg_r', 'foot_r'],
  arm_l: ['upperarm_l', 'lowerarm_l', 'hand_l'], arm_r: ['upperarm_r', 'lowerarm_r', 'hand_r'],
};
const LIMB_AT = Object.fromEntries(Object.entries(LIMBS).map(([k, [a]]) => [a, k]));
// where the second bone of each limb bends to in the bind T-pose, and default knee / elbow directions
const FLEX = { leg_l: [0, 0, -1], leg_r: [0, 0, -1], arm_l: [0, 0, 1], arm_r: [0, 0, 1] };
const POLE = { leg_l: [0.15, 0, 1], leg_r: [-0.15, 0, 1], arm_l: [0.5, -0.5, -1], arm_r: [-0.5, -0.5, -1] };
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
// a relaxed hand curls more towards the little finger, and least at the knuckle
const CURL_F = { thumb: 0.4, index: 0.78, middle: 0.95, ring: 1.08, pinky: 1.22 };
const CURL_K = [0.75, 1.1, 0.95];
const D2R = Math.PI / 180;
const V = (a = [0, 0, 0]) => new THREE.Vector3(a[0], a[1], a[2]);
const wpos = o => o.getWorldPosition(new THREE.Vector3());
const wquat = o => o.getWorldQuaternion(new THREE.Quaternion());
const eulerQ = r => new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * D2R, r[1] * D2R, r[2] * D2R, r[3] || 'XYZ'));

// signed angle that turns a onto b about axis, both projected onto the plane normal to axis
function twistAngle(a, b, axis) {
  const pa = a.clone().addScaledVector(axis, -a.dot(axis)), pb = b.clone().addScaledVector(axis, -b.dot(axis));
  if (pa.lengthSq() < 1e-8 || pb.lengthSq() < 1e-8) return 0;
  pa.normalize(); pb.normalize();
  return Math.atan2(axis.dot(pa.clone().cross(pb)), pa.dot(pb));
}

// palm normal of a hand, from its finger roots (world space)
function palmNormal(p, s) {
  const h = wpos(p.bones['hand_' + s]);
  const fwd = wpos(p.bones['middle_01_' + s]).sub(h);
  const across = wpos(p.bones['index_01_' + s]).sub(wpos(p.bones['pinky_01_' + s]));
  const n = fwd.clone().cross(across).normalize();
  return s === 'l' ? n : n.negate();
}

export function rememberBind(p) {
  p.bind = {};
  p.root.updateMatrixWorld(true);
  for (const [n, b] of Object.entries(p.bones)) p.bind[n] = { q: b.quaternion.clone(), p: b.position.clone(), wq: wquat(b) };
  // how the shoes stand on the floor in the bind pose: ankle height and the feet's turn against the body
  const R = wpos(p.root), QI = wquat(p.root).invert();
  p.sole = {};
  for (const s of ['l', 'r']) if (p.bones['foot_' + s]) p.sole[s] = { ankle: wpos(p.bones['foot_' + s]).y - R.y, QI };
}

export function resetPose(p) {
  for (const [n, b] of Object.entries(p.bones)) { b.quaternion.copy(p.bind[n].q); b.position.copy(p.bind[n].p); }
  p.root.updateMatrixWorld(true);
}

export function applyPose(p, pose, { keepBase = false } = {}) {
  if (!keepBase) resetPose(p);
  p.root.updateMatrixWorld(true);
  const B = p.bones;
  const Qc = wquat(p.root), Rw = wpos(p.root), QcI = Qc.clone().invert();
  const Hrot = pose.hip?.rot ? eulerQ(pose.hip.rot) : new THREE.Quaternion();
  const hipBase = wpos(B.hip).sub(Rw).applyQuaternion(QcI);
  const hipPos = pose.hip?.pos ? V(pose.hip.pos) : hipBase.clone();
  const body = pose.frame === 'body' || pose.frame === 'pelvis';
  // 'pelvis': the frame of the starting pose's own pelvis (a captured lying or slumped body)
  const Fq = pose.frame === 'pelvis' ? Qc.clone().multiply(Hrot).multiply(QcI).multiply(wquat(B.hip)).multiply(p.bind.hip.wq.clone().invert())
    : body ? Qc.clone().multiply(Hrot) : Qc;
  const dirW = a => V(a).normalize().applyQuaternion(Fq);
  const charToW = v => v.applyQuaternion(Qc).add(Rw);

  // the starting pose: world orientation, aim direction and limb lengths of every bone
  const Qb = {}, Db = {}, len = {};
  for (const [n, b] of Object.entries(B)) {
    Qb[n] = wquat(b);
    const c = AIM_CHILD[n] && B[AIM_CHILD[n]];
    if (c) { const d = wpos(c).sub(wpos(b)); len[n] = d.length(); Db[n] = d.normalize(); }
  }
  const palmB = { l: palmNormal(p, 'l'), r: palmNormal(p, 'r') };
  const ankleH = { l: wpos(B.foot_l).y - Rw.y, r: wpos(B.foot_r).y - Rw.y };
  // bend directions of the starting pose: the T-pose ones carried along by each bone's rotation since the bind
  const flexB = {};
  for (const [k, [a]] of Object.entries(LIMBS)) {
    const rel = Qb[a].clone().multiply(Qc.clone().multiply(p.bind[a].wq).invert());
    flexB[k] = V(FLEX[k]).applyQuaternion(Qc).applyQuaternion(rel);
  }

  // how each limb bends in the starting pose (world), used as its pole on a captured base
  const bendB = {}, endB = {};
  for (const [k, [a, m, e]] of Object.entries(LIMBS)) {
    const A = wpos(B[a]), K = wpos(B[m]), E = wpos(B[e]);
    endB[k] = E.clone();
    const d = K.sub(A.add(E).multiplyScalar(0.5));
    if (d.length() > 0.015) bendB[k] = d.normalize();
  }
  if (pose.plant) {
    pose = { ...pose };
    for (const s of ['l', 'r']) if (!pose['leg_' + s]) {
      const f = wpos(B['foot_' + s]).sub(Rw).applyQuaternion(QcI);
      f.x += hipPos.x - hipBase.x; f.z += hipPos.z - hipBase.z;
      pose['leg_' + s] = { w: charToW(f) };
    }
  }

  const delta = {}, aimOf = {}, palmTwist = {}, footYaw = {};
  const target = (g, side, isLeg) => {
    let t;
    if (g.w) return g.w.clone();
    if (g.at) { const [bn, off] = g.at; t = wpos(B[bn]).add(V(off).applyQuaternion(delta[bn] ? delta[bn].clone().multiply(Qc) : Qc)); }
    else if (g.rel && pose.frame === 'pelvis') t = charToW(hipPos.clone()).add(V(g.rel).applyQuaternion(Fq));
    else if (g.rel) t = charToW(V(g.rel).applyQuaternion(Hrot).add(hipPos));
    else t = charToW(V(g.to));
    // `to` is where the sole goes, the ankle sits above it
    if (isLeg && !g.at && !g.rel) t.y += pose.flat && p.sole?.[side] ? p.sole[side].ankle : ankleH[side];
    // nudge_l / nudge_r: a small shift of a wrist target in character space (the lab's contact fitting sets it)
    if (!isLeg && pose['nudge_' + side]) t.add(V(pose['nudge_' + side]).applyQuaternion(Qc));
    return t;
  };
  const visit = b => {
    const n = b.name, spec = pose[n] || {};
    const parentDelta = (b.parent && b.parent.isBone && delta[b.parent.name]) || new THREE.Quaternion();
    // two-bone IK at a limb root: its position is known now that the parent is posed
    const limb = LIMB_AT[n];
    if (limb && pose[limb]) {
      const [a, m, e] = LIMBS[limb], g = pose[limb], side = limb.slice(-1), isLeg = limb.startsWith('leg');
      const A = wpos(b), T = target(g, side, isLeg);
      const l1 = len[a], l2 = len[m];
      const AT = T.clone().sub(A);
      const d = THREE.MathUtils.clamp(AT.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
      const u = AT.normalize();
      // the capture's own bend only while the hand or foot stays near where the capture had it
      const pole = g.pole ? dirW(g.pole) : pose.base && bendB[limb] && endB[limb].distanceTo(T) < 0.25 ? bendB[limb].clone() : dirW(POLE[limb]);
      const w = pole.addScaledVector(u, -pole.dot(u)).normalize();
      const ca = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
      const K = A.clone().addScaledVector(u, l1 * ca).addScaledVector(w, l1 * Math.sqrt(1 - ca * ca));
      aimOf[a] = K.clone().sub(A).normalize();
      aimOf[m] = A.clone().addScaledVector(u, d).sub(K).normalize();
      if (isLeg && !pose[e]) aimOf[e] = Db[e].clone(); // feet keep their starting angle (flat on the floor)
      // flat feet turn with the knee: the thigh's heading on the floor, in character space
      if (isLeg && pose.flat) { const k = K.clone().sub(A).applyQuaternion(QcI); footYaw[side] = Math.atan2(k.x, k.z); }
    }
    // the hand's own aim and palm twist are worked out at the forearm, which takes half of the twist
    if (n.startsWith('lowerarm_')) {
      const s = n.slice(-1), hs = pose['hand_' + s] || {};
      const myAim = aimOf[n] || (spec.aim && dirW(spec.aim));
      if (hs.aim) aimOf['hand_' + s] = dirW(hs.aim);
      else if (hs.palm && myAim) aimOf['hand_' + s] = myAim.clone();
      const ha = aimOf['hand_' + s];
      if (hs.palm && ha) {
        const Dh = new THREE.Quaternion().setFromUnitVectors(Db['hand_' + s], ha);
        palmTwist[s] = twistAngle(palmB[s].clone().applyQuaternion(Dh), dirW(hs.palm), ha);
      }
    }
    // the collarbone lifts and comes forward a little with an arm that reaches up or forward
    if (n.startsWith('shoulder_') && pose['arm_' + n.slice(-1)] && !spec.aim && Db[n]) {
      const s = n.slice(-1), T = target(pose['arm_' + s], s, false);
      const u = T.sub(wpos(B['upperarm_' + s]));
      if (u.lengthSq() > 1e-6) {
        u.normalize();
        const up = V([0, 1, 0]).applyQuaternion(wquat(b.parent));
        const elev = Math.asin(THREE.MathUtils.clamp(u.dot(up), -1, 1)) / D2R;
        const ang = THREE.MathUtils.clamp(0.25 * (elev + 10), 0, 18) * D2R;
        const a = Db[n].clone(), axis = a.clone().cross(u);
        if (ang > 0 && axis.lengthSq() > 1e-6) aimOf[n] = a.applyAxisAngle(axis.normalize(), ang);
      }
    }
    let D;
    const aim = aimOf[n] || (spec.aim && dirW(spec.aim));
    if (aim && Db[n]) {
      D = new THREE.Quaternion().setFromUnitVectors(Db[n], aim);
      // limb roots turn about their own axis so the knee / elbow hinge lines up with the bend
      if (limb && aimOf[LIMBS[limb][1]]) {
        const next = aimOf[LIMBS[limb][1]];
        const bend = next.clone().addScaledVector(aim, -next.dot(aim));
        if (bend.length() > 0.17) D.premultiply(new THREE.Quaternion().setFromAxisAngle(aim, twistAngle(flexB[limb].clone().applyQuaternion(D), bend, aim)));
      }
      const s = n.slice(-1);
      if (n.startsWith('hand_') && palmTwist[s]) D.premultiply(new THREE.Quaternion().setFromAxisAngle(aim, palmTwist[s]));
      if (n.startsWith('lowerarm_') && palmTwist[s]) D.premultiply(new THREE.Quaternion().setFromAxisAngle(aim, palmTwist[s] * 0.5));
      if (spec.twist) D.premultiply(new THREE.Quaternion().setFromAxisAngle(aim, spec.twist * D2R));
    } else {
      D = parentDelta.clone();
    }
    if (spec.rot) {
      const F = n === 'hip' || !body ? Qc : Fq;
      D.premultiply(eulerQ(spec.rot).premultiply(F).multiply(F.clone().invert()));
    }
    // flat feet (and toes): the bind's stance on the floor, turned with the knee
    const fs = /^(foot|ball)_[lr]$/.test(n) && n.slice(-1);
    if (fs && pose.flat && p.sole?.[fs] && footYaw[fs] !== undefined && !pose['foot_' + fs]) {
      const turn = new THREE.Quaternion().setFromAxisAngle(V([0, 1, 0]), footYaw[fs]);
      D = Qc.clone().multiply(turn).multiply(p.sole[fs].QI).multiply(p.bind[n].wq).multiply(Qb[n].clone().invert());
    }
    delta[n] = D;
    const Qd = D.clone().multiply(Qb[n]);
    b.quaternion.copy(wquat(b.parent).invert().multiply(Qd));
    if (n === 'hip' && pose.hip?.pos) b.position.copy(b.parent.worldToLocal(charToW(hipPos.clone())));
    b.updateMatrixWorld(true);
    // the neck goes first so arm targets can refer to the head
    const kids = b.children.filter(c => c.isBone).sort((x, y) => (y.name === 'neck') - (x.name === 'neck'));
    for (const c of kids) visit(c);
  };
  visit(B.hip);

  // the gaze: yaw and pitch in the chest's frame, limited the way a neck is (80 degrees to the side, 50 down,
  // 40 up), the neck taking 40% of it; the head stays level instead of rolling along a shortest arc
  if (pose.look) {
    const C = wquat(B.spine_03).multiply(p.bind.spine_03.wq.clone().invert());
    const eye = wpos(B.head).add(V([0, 0.06, 0.09]).applyQuaternion(C));
    const d = charToW(V(pose.look)).sub(eye).applyQuaternion(C.clone().invert()).normalize();
    const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -80 * D2R, 80 * D2R);
    const pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), -50 * D2R, 40 * D2R);
    for (const [bn, f] of [['neck', 0.4], ['head', 1]]) {
      const q = C.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch * f, yaw * f, 0, 'YXZ'))).multiply(p.bind[bn].wq);
      B[bn].quaternion.copy(wquat(B[bn].parent).invert().multiply(q));
      B[bn].updateMatrixWorld(true);
    }
  }

  // finger curl about each hand's bending axis (from the starting pose, in the finger's own frame)
  for (const s of ['l', 'r']) {
    // open_l / open_r: start from the rig's straight fingers instead of the capture's
    const open = pose['open_' + s];
    if (open) for (const f of FINGERS) for (let k = 1; k <= 3; k++) { const b = B[`${f}_0${k}_${s}`]; if (b) b.quaternion.copy(p.bind[b.name].q); }
    const curl = pose['curl_' + s] ?? (p.noFingers ? 22 : pose.base ? 0 : 25);
    if (!curl) continue;
    // grip_l / grip_r: how the curl is shared out from the knuckle to the tip, instead of a relaxed hand's
    const K = pose['grip_' + s] || CURL_K;
    const fwd = Db['hand_' + s];
    const axisW = fwd.clone().cross(palmB[s]).normalize();
    for (const f of FINGERS) for (let k = 1; k <= 3; k++) {
      const b = B[`${f}_0${k}_${s}`]; if (!b) continue;
      const amt = CURL_F[f] * K[k - 1] * curl * D2R;
      if (open) b.parent.updateMatrixWorld(true);
      const wq = open ? b.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(b.quaternion) : Qb[b.name];
      const axisL = axisW.clone().applyQuaternion(wq.clone().invert());
      b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axisL, amt));
    }
  }
  for (const s of ['l', 'r']) spreadTwist(p, s);
  p.root.updateMatrixWorld(true);
}

// Turning the hand over (pronation, supination) happens along the forearm, not at the elbow. Whatever turn
// about its own axis the forearm took against the upper arm goes on to the hand (which keeps its place and
// facing), and the forearm's twist bone takes half of the hand's turn, so the skin winds evenly from the elbow
// to the wrist instead of wringing at one joint.
const X = new THREE.Vector3(1, 0, 0); // every bone of these rigs points along its local x
function twistAbout(q, axis) {
  const v = new THREE.Vector3(q.x, q.y, q.z), a = axis.dot(v);
  const t = new THREE.Quaternion(axis.x * a, axis.y * a, axis.z * a, q.w);
  return t.lengthSq() < 1e-12 ? new THREE.Quaternion() : t.normalize();
}
function spreadTwist(p, s) {
  const B = p.bones, la = B['lowerarm_' + s], h = B['hand_' + s], tw = B['lowerarm_twist_' + s];
  if (!la || !h) return;
  p.root.updateMatrixWorld(true);
  const handW = wquat(h);
  // the forearm keeps only its swing (the elbow's bend) from the bind
  const lb = p.bind[la.name].q;
  const d = lb.clone().invert().multiply(la.quaternion);
  const swing = d.clone().multiply(twistAbout(d, X).invert());
  la.quaternion.copy(lb).multiply(swing);
  la.updateMatrixWorld(true);
  h.quaternion.copy(wquat(la).invert().multiply(handW));
  h.updateMatrixWorld(true);
  if (!tw) return;
  // the hand's turn about the forearm, in the forearm's frame, against the bind; half of it to the twist bone
  const c = h.quaternion.clone().multiply(p.bind[h.name].q.clone().invert());
  const t = twistAbout(c, X);
  const half = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), t, 0.5);
  tw.quaternion.copy(half).multiply(p.bind[tw.name].q);
  tw.updateMatrixWorld(true);
}

const SIT_BACK = { spine_01: { rot: [4, 0, 0] }, spine_02: { rot: [3, 0, 0] }, neck: { rot: [4, 0, 0] }, head: { rot: [4, 0, 0] } };
const seat = (h, back = -0.02) => ({ pos: [0, h + 0.085, back], rot: [-4, 0, 0] });
const feet = (z = 0.46, x = 0.12, y = 0) => ({ leg_l: { to: [x, y, z] }, leg_r: { to: [-x, y, z] } });
const palmsDown = (inward = 0.15, down = 0.3) => ({ hand_l: { aim: [-inward, -down, 1], palm: [0, -1, 0] }, hand_r: { aim: [inward, -down, 1], palm: [0, -1, 0] } });

// A copy of a seated pose for a seat of another height (metres).
export function seated(name, h, back) {
  const P = POSES[name];
  return { ...P, hip: { ...P.hip, pos: [P.hip.pos[0], h + 0.085, back ?? P.hip.pos[2]] } };
}

// Bases from real captures (CMU takes, see retarget.js), times in seconds. A captured body gives the
// weight shifts, slumps and asymmetries a hand-built pose lacks; IK only places the hands and feet that
// have to touch something.
const cmu = (id, t) => ({ clip: 'cmu:' + id, t });
// the takes the poses use, loaded once by setup()
export const TAKES = ['77_02', '82_08', '113_21', '40_10', '114_05', '18_12', '22_03', '82_05', '140_08', '13_05'];
const onSeat = (h = 0.46, back = 0) => ({ pos: [0, h + 0.085, back] });
// feet flat and well forward under a dining table, so the knees sit low and the thighs pass under its top
// (about 0.6 m up), the knees a hand apart
const underTable = { leg_l: { to: [0.1, 0, 0.6], pole: [0.1, 0, 1] }, leg_r: { to: [-0.1, 0, 0.6], pole: [-0.1, 0, 1] } };

export const POSES = {
  // on a chair, leaning back a little, hands on the thighs
  sit: { base: cmu('114_05', 0.5), hip: onSeat(), plant: true },
  // upright against the backrest, hands resting on the thighs, eyes a little down (metro and waiting room seats)
  sitRest: {
    base: cmu('13_05', 20), hip: onSeat(), plant: true, level: true, leg_l: { to: [0.13, 0, 0.47] }, leg_r: { to: [-0.12, 0, 0.45] },
    neck: { rot: [8, 0, 0] }, head: { rot: [6, 0, 0] },
    arm_l: { rel: [0.15, 0.1, 0.3], pole: [0.6, -0.4, -1] }, arm_r: { rel: [-0.15, 0.1, 0.3], pole: [-0.6, -0.4, -1] },
    hand_l: { aim: [-0.2, -0.45, 1], palm: [0.1, -1, 0] }, hand_r: { aim: [0.2, -0.45, 1], palm: [-0.1, -1, 0] }, curl_l: 26, curl_r: 26,
  },
  // the same with the knees together, feet flat (heels too) and the hands resting on the thighs (women, and low
  // sofas); seat it deep with seated(name, h, -0.1)
  sitNeat: {
    base: cmu('13_05', 20), hip: onSeat(), plant: true, level: true, flat: true,
    leg_l: { to: [0.1, 0, 0.38], pole: [0.1, 0.3, 1] }, leg_r: { to: [-0.09, 0, 0.36], pole: [-0.1, 0.3, 1] },
    neck: { rot: [8, 0, 0] }, head: { rot: [6, 0, 0] },
    arm_l: { rel: [0.11, 0.19, 0.3], pole: [0.6, -0.4, -1] }, arm_r: { rel: [-0.1, 0.19, 0.3], pole: [-0.6, -0.4, -1] },
    hand_l: { aim: [-0.2, -0.45, 1], palm: [0.1, -1, 0] }, hand_r: { aim: [0.2, -0.45, 1], palm: [-0.1, -1, 0] }, curl_l: 26, curl_r: 26,
  },
  // elbows on the knees, looking at the floor
  sitLean: { base: cmu('22_03', 3.0), hip: onSeat(), plant: true },
  // leaning forward, hands loosely together
  sitHands: { base: cmu('18_12', 5.8), hip: onSeat(), plant: true },
  // upright, the right knee over the left (built on a captured upright sit), hands together on the top thigh
  sitCross: {
    base: cmu('13_05', 20), hip: onSeat(), plant: true,
    leg_l: { to: [0.06, 0, 0.44] }, leg_r: { rel: [0.12, -0.36, 0.47], pole: [0.45, 0.3, 1] }, foot_r: { aim: [0.15, -0.7, 0.7] },
    arm_l: { rel: [0.03, 0.13, 0.3] }, arm_r: { rel: [-0.08, 0.14, 0.27] }, ...palmsDown(0.4, 0.2), curl_l: 24, curl_r: 30,
  },
  // at a desk (top at 0.74 m), typing
  desk: {
    base: cmu('18_12', 4.6), hip: onSeat(0.47, 0), plant: true, neck: { rot: [-6, 0, 0] }, head: { rot: [-4, 0, 0] },
    arm_l: { to: [0.16, 0.79, 0.47] }, arm_r: { to: [-0.14, 0.79, 0.45] }, ...palmsDown(0.25, 0.15), curl_l: 30, curl_r: 36,
  },
  // at a dining table (top at 0.75 m), forearms on the edge
  table: {
    base: cmu('22_03', 2.3), hip: onSeat(0.46, 0), plant: true, flat: true, ...underTable,
    arm_l: { to: [0.2, 0.795, 0.4] }, arm_r: { to: [-0.18, 0.795, 0.43] }, ...palmsDown(0.6, 0.05), curl_l: 26, curl_r: 32,
  },
  // the same, the left hand round a glass on the table (thumb on top, like a handshake), the right lying flat on
  // the edge
  tableGlass: {
    base: cmu('22_03', 2.3), hip: onSeat(0.46, 0), plant: true, level: true, flat: true, ...underTable,
    arm_l: { to: [0.26, 0.82, 0.47], pole: [0.6, -1, -0.4] }, hand_l: { aim: [-0.25, 0.1, 1], palm: [-1, 0, 0.1] }, curl_l: 48,
    arm_r: { to: [-0.18, 0.775, 0.43] }, hand_r: { aim: [0.5, -0.08, 1], palm: [0, -1, 0] }, curl_r: 10,
  },
  // at a meeting table with the chair turned towards the front: one forearm on the table, the other hand in
  // the lap (meetR: the table is on the right; meetL: on the left)
  meetR: {
    base: cmu('13_05', 20), hip: onSeat(0.46, 0), plant: true, leg_l: { to: [0.13, 0, 0.45] }, leg_r: { to: [-0.11, 0, 0.48] },
    arm_r: { to: [-0.14, 0.785, 0.4] }, arm_l: { rel: [0.05, 0.13, 0.28] }, ...palmsDown(0.4, 0.15), curl_l: 26, curl_r: 30,
  },
  meetL: {
    base: cmu('13_05', 20), hip: onSeat(0.46, 0), plant: true, leg_l: { to: [0.11, 0, 0.48] }, leg_r: { to: [-0.13, 0, 0.45] },
    arm_l: { to: [0.14, 0.785, 0.4] }, arm_r: { rel: [-0.05, 0.13, 0.28] }, ...palmsDown(0.4, 0.15), curl_l: 30, curl_r: 26,
  },
  // sitting up at a dining table, leaning in a little: the left forearm on it, the hand by the plate, the right hand
  // on the thigh
  dineL: {
    base: cmu('13_05', 20), hip: onSeat(0.46, 0), plant: true, level: true, flat: true, ...underTable,
    spine_01: { rot: [7, 0, 0] }, spine_02: { rot: [6, 0, 0] }, leg_l: { to: [0.06, 0, 0.6], pole: [0.02, 0, 1] },
    arm_l: { to: [0.2, 0.8, 0.34] }, hand_l: { aim: [-0.15, -0.2, 1], palm: [0, -1, 0] }, curl_l: 14,
    arm_r: { rel: [-0.14, 0.16, 0.18] }, hand_r: { aim: [0.3, -0.4, 1], palm: [-0.1, -1, 0] }, curl_r: 26,
  },
  // sitting up at a dining table, both forearms on it and the hands resting together near its edge
  dineHands: {
    base: cmu('13_05', 20), hip: onSeat(0.46, 0), plant: true, level: true, flat: true, ...underTable,
    arm_l: { to: [0.05, 0.81, 0.3] }, arm_r: { to: [-0.08, 0.795, 0.29] }, curl_l: 20, curl_r: 28,
    hand_l: { aim: [-0.8, -0.1, 1], palm: [0, -1, 0] }, hand_r: { aim: [0.8, -0.05, 1], palm: [0, -1, 0] },
  },
  // sitting up at a dining table, the right hand round a glass on it, the left hand on the thigh
  dineGlass: {
    base: cmu('13_05', 20), hip: onSeat(0.46, 0), plant: true, level: true, flat: true, ...underTable,
    arm_r: { to: [-0.22, 0.82, 0.36], pole: [-0.6, -1, -0.4] }, hand_r: { aim: [0.25, 0.1, 1], palm: [1, 0, 0.1] }, curl_r: 48,
    arm_l: { rel: [0.1, 0.06, 0.2] }, hand_l: { aim: [-0.3, -0.4, 1], palm: [0.1, -1, 0] }, curl_l: 26,
  },
  // sitting, phone in both hands low over the knees, head down to it
  sitPhone: {
    base: cmu('18_12', 5.8), hip: onSeat(), plant: true, level: true, neck: { rot: [10, 0, 0] }, head: { rot: [12, 0, 0] },
    arm_l: { rel: [0.04, 0.29, 0.33] }, arm_r: { rel: [-0.04, 0.29, 0.33] },
    // the palms cupped and turned up under the phone, fingers forward, not raised up in front of the chest
    hand_l: { aim: [-0.12, 0.35, 0.93], palm: [-0.15, 0.92, -0.35] }, hand_r: { aim: [0.12, 0.35, 0.93], palm: [0.15, 0.92, -0.35] }, curl_l: 15, curl_r: 15,
  },
  // sitting bent over a phone in the right hand, the thumb on the screen; the left hand rests on the thigh
  sitPhoneOne: {
    base: cmu('18_12', 5.8), hip: onSeat(), plant: true, level: true, neck: { rot: [12, 0, 0] }, head: { rot: [12, 0, 0] },
    arm_r: { rel: [-0.07, 0.25, 0.34], pole: [-0.8, -1, -0.2] }, hand_r: { aim: [0.35, 0.3, 1], palm: [0.15, 0.85, -0.45] }, curl_r: 30,
    arm_l: { rel: [0.15, 0.1, 0.3], pole: [0.6, -0.4, -1] }, hand_l: { aim: [-0.2, -0.45, 1], palm: [0.1, -1, 0] }, curl_l: 26,
  },
  // bent over on a chair, elbows on the knees, face in the hands
  sitFace: {
    base: cmu('22_03', 3.0), hip: onSeat(), plant: true, neck: { rot: [10, 0, 0] },
    arm_l: { at: ['head', [0.07, 0.0, 0.1]] }, arm_r: { at: ['head', [-0.07, 0.0, 0.1]] },
    hand_l: { aim: [-0.3, 1, 0.1], palm: [-0.2, 0, -1] }, hand_r: { aim: [0.3, 1, 0.1], palm: [0.2, 0, -1] }, curl_l: 15, curl_r: 15,
  },
  // on the floor (or a low step), knees up, head down, one hand on the forehead and the elbow on the knee
  hug: {
    base: cmu('82_05', 7.4), hip: { pos: [0, 0.1, 0] }, plant: true, spine_02: { rot: [6, 0, 0] }, neck: { rot: [16, 0, 0] }, head: { rot: [12, 0, 0] },
    arm_r: { at: ['head', [-0.03, 0.06, 0.11]], pole: [-0.3, -1, 0.4] }, hand_r: { aim: [0.5, 0.6, 0.2], palm: [0.3, -0.2, -1] }, curl_r: 30,
  },
  // lying on the back (head towards -z), knees up under the covers, just awake, a hand on his heart; the neck and
  // upper back curl up so the head rests on a pillow instead of lying flat on the mattress
  lieBack: {
    base: cmu('140_08', 0.34), frame: 'pelvis', hip: { pos: [0, 0.12, 0] },
    spine_02: { rot: [5, 0, 0] }, spine_03: { rot: [8, 0, 0] }, neck: { rot: [16, 0, 0] }, head: { rot: [6, -16, 0] },
    // the right forearm across his chest, its elbow against his side, the hand on the left of his chest (on his
    // heart), in line with the forearm, its fingers bent over the curve of the chest (from the knuckles, the tips
    // resting on it); the left arm lies loose along his side on the mattress, palm down
    arm_r: { rel: [0.04, 0.28, 0.245], pole: [-0.67, -0.74, 0] }, hand_r: { aim: [0.93, 0.36, -0.08], palm: [-0.128, 0.226, -0.966] }, curl_r: 26, grip_r: [1.0, 0.9, 0.6],
    arm_l: { rel: [0.24, 0.04, -0.05], pole: [1, 0, -0.3] }, hand_l: { aim: [0.1, -0.98, -0.19], palm: [0, 0.19, -0.98] }, curl_l: 25,
  },
  // lying on the right side (head towards -z, facing -x), knees bent, phone in the left hand in front of the face; the spine bends
  // up off the mattress towards the shoulders and the head rests on the pillow
  lieSide: {
    frame: 'body', hip: { pos: [0, 0.165, 0], rot: [-90, 0, 90, 'ZYX'] }, spine_01: { rot: [10, 0, -2] }, spine_02: { rot: [9, 0, -3] }, spine_03: { rot: [4, 0, -2] }, neck: { rot: [12, 0, 6] }, head: { rot: [10, 0, 9] },
    leg_l: { rel: [0.1, -0.46, 0.5], pole: [0.1, 0, 1] }, leg_r: { rel: [-0.05, -0.66, 0.26], pole: [0, 0, 1] },
    foot_l: { aim: [0.1, -0.9, 0.5] }, foot_r: { aim: [0, -0.9, 0.7] },
    // the lower (right) arm is folded up under his head on the pillow; the upper (left) forearm comes up in front of
    // his chest and that hand holds the phone low in front of his face, palm and screen turned to him (the hand turned
    // a little up about the forearm, so the phone shows over his fingers and not hidden behind the back of the hand)
    arm_l: { rel: [0.08, 0.48, 0.5], pole: [-1, -0.8, 0.2] }, hand_l: { aim: [0.1, 0.66, 0.74], palm: [0.29, 0.696, -0.66] }, curl_l: 40,
    arm_r: { rel: [-0.1, 0.78, 0.06], pole: [0, 0.2, 1] }, hand_r: { aim: [0.03, -0.1, -1], palm: [1, 0, 0] }, curl_r: 20,
  },
};

// Standing. The men stand on captured idles; Sophia's capture (`idle`) stays for the women.
const MAN = cmu('77_02', 1.0);

// Standing at ease, the way people stand when nobody is looking: the weight on one leg (`on`), that hip pushed
// out over its foot and higher than the other; the free knee loose and a little forward, its foot stepped out
// and turned out; the chest tilting back against the hips and the shoulders soft. Kept small: a big hip drop
// with the chest leaning back against it reads as a crooked body in a still frame.
// Character space: +x is the character's left. The standing poses below add their arms to it.
export function atEase(on = 'r', { base = MAN, shift = 0.03, drop = 2.5, turn = 4, step = 0.1, out = 0.16, toe = 18, tilt = 0, look = 0 } = {}) {
  const s = on === 'r' ? -1 : 1, free = on === 'r' ? 'l' : 'r';
  const foot = a => [Math.sin(a * D2R) * 0.9, -0.44, Math.cos(a * D2R) * 0.9];
  return {
    base,
    hip: { pos: [s * shift, 0.925, 0.03], rot: [2, s * turn, s * drop] },
    ['leg_' + on]: { to: [s * 0.09, 0, 0], pole: [s * 0.15, 0, 1] },
    ['leg_' + free]: { to: [-s * out, 0, step], pole: [-s * 0.3, 0, 1] },
    ['foot_' + on]: { aim: foot(s * 8) },
    ['foot_' + free]: { aim: foot(-s * toe) },
    spine_01: { rot: [-2, 0, -s * 1.2] }, spine_02: { rot: [0, 0, -s * 1.5] }, spine_03: { rot: [3, -s * 2, -s * 1] },
    neck: { rot: [5, 0, 0] }, head: { rot: [3, -s * look, s * tilt] },
  };
}
// an arm hanging loose at the side, the hand just off the thigh, palm in, fingers soft
export const hang = s => {
  const k = s === 'l' ? 1 : -1;
  return { ['arm_' + s]: { rel: [k * 0.215, -0.11, 0.05], pole: [k * 0.3, 0, -1] }, ['hand_' + s]: { aim: [-k * 0.08, -1, 0.12], palm: [-k, 0, 0.15] }, ['curl_' + s]: 24 };
};
// both arms hanging loose a little out from the hips, the hands turned out and back so the curled fingertips stay
// off the trousers: the men's captured idles had their hands in their pockets, and the scans have no real pockets,
// so those hands sank into the jeans
export const loose = (x = 0.25) => ({
  arm_l: { rel: [x, -0.07, 0.05], pole: [0.3, 0, -1] }, hand_l: { aim: [0.06, -1, 0.05], palm: [-1, 0, -0.25] }, curl_l: 18,
  arm_r: { rel: [-x, -0.07, 0.05], pole: [-0.3, 0, -1] }, hand_r: { aim: [-0.06, -1, 0.05], palm: [1, 0, -0.25] }, curl_r: 18,
});
export const STANDING = {
  // looking down at a phone held at chest height in the right hand
  phone: {
    ...atEase('l'), neck: { rot: [14, 0, 0] }, head: { rot: [12, 0, 0] },
    arm_r: { rel: [-0.08, 0.32, 0.28] }, hand_r: { aim: [0.25, 0.7, 1], palm: [0.2, 0.9, -0.3] }, curl_r: 40,
    arm_l: { rel: [0.04, 0.3, 0.3] }, hand_l: { aim: [-0.5, 0.4, 1], palm: [-0.3, 0.8, 0] }, curl_l: 30,
  },
  // looking down at a phone in the right hand at chest height, the thumb on the screen; the left arm hangs
  phoneOne: {
    ...atEase('l'), level: true, neck: { rot: [14, 0, 0] }, head: { rot: [12, 0, 0] },
    arm_r: { rel: [-0.1, 0.3, 0.26], pole: [-0.8, -1, -0.3] }, hand_r: { aim: [0.35, 0.3, 1], palm: [0.15, 0.85, -0.45] }, curl_r: 30,
    ...hang('l'),
  },
  // the right hand high on a pole at her right front, like a handshake (the forearm up), the left arm hanging
  poleUp: {
    ...atEase('l', { base: cmu('77_02', 2.7) }), level: true, neck: { rot: [6, 0, 0] }, head: { rot: [4, 0, 0] },
    arm_r: { to: [-0.3, 1.45, 0.24], pole: [-0.6, -1, -0.3] }, hand_r: { aim: [0.1, 0.8, 0.6], palm: [1, 0, 0.1] }, curl_r: 58,
    ...hang('l'),
  },
  // a mug in the right hand in front of the chest, held round its body like a glass, eyes down on it; the left
  // arm hangs as the capture has it
  mugOne: {
    ...atEase('r'), level: true, neck: { rot: [12, 0, 0] }, head: { rot: [12, 0, 0] },
    arm_r: { rel: [-0.07, 0.34, 0.29], pole: [-0.8, -1, -0.4] }, hand_r: { aim: [0.12, 0.08, 1], palm: [1, 0, 0.12] }, curl_r: 46,
    ...hang('l'),
  },
  // holding a mug with both hands
  mug: {
    ...atEase('r'), neck: { rot: [9, 0, 0] }, head: { rot: [8, 0, 0] },
    arm_r: { rel: [-0.095, 0.3, 0.27], pole: [-0.6, -1, -0.3] }, hand_r: { aim: [1, 0.2, 0.4], palm: [0.6, 0, 0.8] }, curl_r: 50,
    arm_l: { rel: [0.095, 0.3, 0.27], pole: [0.6, -1, -0.3] }, hand_l: { aim: [-1, 0.2, 0.4], palm: [-0.6, 0, 0.8] }, curl_l: 50,
  },
  // one hand up on a pole or a strap, the other in a pocket
  pole: {
    base: cmu('77_02', 2.7), neck: { rot: [8, 0, 0] }, head: { rot: [10, 0, 0] },
    arm_l: { rel: [0.2, 0.72, 0.12] }, hand_l: { aim: [0, 1, 0.1], palm: [-1, 0, 0] }, curl_l: 70,
    arm_r: { rel: [-0.16, -0.06, 0.07] }, hand_r: { aim: [0.2, -1, 0.3], palm: [-1, 0, 0] }, curl_r: 30,
  },
  // the left hand round a pole that stands at [0.18, y, 0.3] in his own space, held like a handshake at chest
  // height (forearm up and forward, thumb on top), the right hand in his pocket, the weight on the leg away from it;
  // the free left foot stays in under him, not out against the pole's foot
  poleHold: {
    ...atEase('r', { base: cmu('77_02', 2.7), out: 0.12, step: -0.02, toe: 6 }), level: true, neck: { rot: [12, 0, 0] }, head: { rot: [12, 6, 0] },
    arm_l: { to: [0.2, 1.36, 0.25], pole: [0.4, -1, -0.4] }, hand_l: { aim: [-0.1, 0.55, 1], palm: [-1, 0, 0.1] }, curl_l: 58,
    arm_r: { rel: [-0.17, -0.07, 0.08] }, hand_r: { aim: [0.25, -1, 0.35], palm: [1, 0, 0] }, curl_r: 34,
  },
  // presenting: the left arm opens towards the screen at his side, elbow soft, the open palm turned up and
  // towards the people at the table ("here, look"); the right arm hangs
  present: {
    ...atEase('r', { base: cmu('82_08', 3.0), look: 0 }), level: true, head: { rot: [0, 16, 0] },
    arm_l: { rel: [0.42, 0.24, 0.24], pole: [0.3, -1, -0.5] }, hand_l: { aim: [0.6, -0.4, 0.7], palm: [-0.7, 0.2, 0.6] }, open_l: true, curl_l: 12,
    ...hang('r'),
  },
  // breathing slowly: right hand on the heart, left hand on the belly, chin a little up; a quieter stance
  breathe: {
    ...atEase('r', { shift: 0.04, drop: 3.5, step: 0.08, out: 0.15, toe: 16 }), neck: { rot: [-5, 0, 0] }, head: { rot: [-7, 0, 0] },
    arm_r: { rel: [0.05, 0.43, 0.17], pole: [-0.5, -1, 0] }, hand_r: { aim: [1, 0.55, 0], palm: [0, 0, -1] }, open_r: true, curl_r: 14,
    // the belly hand: the forearm runs across the front with the wrist straight, palm on the body
    arm_l: { rel: [0.05, 0.26, 0.19], pole: [1, -0.8, -0.1] }, hand_l: { aim: [-0.93, 0, 0.33], palm: [0.33, 0, -1] }, open_l: true, curl_l: 16,
  },
  // standing straight and square, head level, both arms hanging loose with the hands just off the thighs (the
  // scans have no real pockets: hands put in them sank into the jeans).
  // No `level` here: on this capture it rolls the chest 6 degrees aside; the spine is left upright and the
  // collarbones and chest are squared instead (measured: spine, shoulder line and pelvis within 3 degrees)
  armsDown: {
    ...atEase('r', { base: cmu('113_21', 3.0), shift: 0.012, drop: 0, turn: 0, step: 0.04, out: 0.12, toe: 10 }),
    // legs nearly straight under him, the feet a hip's width apart (bent knees looked like a half squat from behind)
    hip: { pos: [-0.012, 0.95, 0.015], rot: [2, 0, 0] }, leg_r: { to: [-0.095, 0, 0], pole: [-0.1, 0, 1] }, leg_l: { to: [0.105, 0, 0.03], pole: [0.1, 0, 1] },
    spine_01: { rot: [-2, 0, 0] }, spine_02: { rot: [0, -8, 0] }, spine_03: { rot: [2, -8, 0] }, look: [0, 1.5, 4],
    shoulder_l: { rot: [0, 0, -10] }, shoulder_r: { rot: [0, 0, -10] },
    // the elbows a little bent, the right more than the left, so the arms hang easy and not at attention; the hands
    // turned in a touch, a few cm clear of the jeans
    arm_l: { rel: [0.235, 0.06, 0.12], pole: [0.3, 0, -1] }, hand_l: { aim: [0.06, -1, 0.45], palm: [-1, 0, -0.05] }, curl_l: 24,
    arm_r: { rel: [-0.24, 0.05, 0.09], pole: [-0.3, 0, -1] }, hand_r: { aim: [-0.06, -1, 0.3], palm: [1, 0, -0.15] }, curl_r: 18,
  },
  // arms crossed, from the capture itself
  crossed: { base: { clip: 'idle', t: 11.5 } },
  relaxed: { base: { clip: 'idle', t: 7 } },
  // the men's idles, for crowds: captured upper bodies on an easy stance, the arms loose (built with fit(), which
  // moves a hand that still touches a hip or a thigh clear of it)
  stand: { ...atEase('r'), ...loose() },
  standB: { ...atEase('l', { base: cmu('77_02', 2.7), step: 0.06, out: 0.2, toe: 15, tilt: -2 }), ...loose() },
  standC: { ...atEase('r', { base: cmu('82_08', 3.0), step: 0.15, out: 0.15 }), ...loose() },
  // the hips pushed well out on this one: the arms hang wider so the hands clear a loose shirt's hem (manuel's)
  standD: { ...atEase('l', { base: cmu('113_21', 6.0), shift: 0.045 }), ...loose(0.33) },
  // hands on the hips, from the capture; the right one moved out a little so its fingers rest on a loose shirt
  // instead of sinking into it
  waiting: { base: cmu('40_10', 11.9), arm_r: { rel: [-0.255, 0.12, 0.0], pole: [-0.2, 0.3, -1] } },
};
