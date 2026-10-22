import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { sampleClip, withHipScale, centerHip } from './clips.js';

// Windows of the 20 s idle capture (seconds). Each one loops back and forth on its own.
export const POSES = {
  full: [1.6, 20.3],
  hip: [1.6, 4.6],
  relaxed: [6.4, 8.3],
  crossed: [9.4, 14.6],
  relaxed2: [15.7, 17.3],
  hip2: [17.7, 19.7],
};
// Ground speed of the walk clip at timeScale 1, measured from the planted foot (scripts/walk-speed.mjs).
const WALK_SPEED = 1.08;

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qd = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _axis = new THREE.Vector3();

export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));

// Rotates a bone about a world-space axis through its pivot, on top of the animated pose.
function rotateBoneWorld(bone, axis, angle) {
  if (!bone || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_qp);
  _q.setFromAxisAngle(axis, angle);
  _qd.copy(_qp).invert().multiply(_q).multiply(_qp);
  bone.quaternion.premultiply(_qd);
  bone.updateMatrixWorld(true);
}

export class PeopleKit {
  constructor(models) {
    const idle = models.sophia.animations.find(a => a.name === 'idle');
    const walk = models.nathan.animations.find(a => a.name === 'walk');
    const hipOf = scene => scene.getObjectByName('hip').position.y;
    const idleHip = hipOf(models.sophia.scene);
    const walkHip = hipOf(models.nathan.scene);
    const idleBind = models.sophia.scene.getObjectByName('hip').position;
    const loops = {};
    for (const [k, [a, b]] of Object.entries(POSES)) loops[k] = centerHip(sampleClip(idle, k, a, b), idleBind);
    this.types = {};
    for (const [name, gltf] of Object.entries(models)) {
      const hip = hipOf(gltf.scene);
      const clips = {};
      for (const k in loops) clips[k] = withHipScale(loops[k], hip / idleHip);
      clips.walk = withHipScale(walk, hip / walkHip);
      this.types[name] = { scene: gltf.scene, clips, walkSpeed: WALK_SPEED * (hip / walkHip) };
    }
  }
}

export class Agent {
  constructor(kit, type, { material, pos = [0, 0, 0], heading = 0, pose = 'full', role = 'crowd' }) {
    const T = kit.types[type];
    this.type = type;
    this.T = T;
    this.role = role;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(T.scene);
    this.root.add(this.model);
    this.bones = {};
    this.model.traverse(o => {
      if (o.isSkinnedMesh) { this.mesh = o; o.frustumCulled = false; o.material = material; }
      if (o.isBone) this.bones[o.name] = o;
    });
    this.pos = new THREE.Vector3(pos[0], 0, pos[2] ?? pos[1]);
    this.home = this.pos.clone();
    this.homeHeading = heading;
    this.heading = heading;
    this.face = heading;
    this.target = this.pos.clone();
    this.maxSpeed = 1.1;
    this.speed = 0;
    this.arrive = 0.08;
    this.pose = pose;
    this.basePose = pose;
    this.walkW = 0;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    this.w = {};
    this.lookPoint = new THREE.Vector3();
    this.hasLook = false;
    this.lookW = 0;
    this.yawOff = 0;
    this.pitchOff = 0;
    this.anx = 0;
    this.breath = 0;
    this.shake = 0;
    this.time = Math.random() * 100;
    this.root.position.copy(this.pos);
    this.root.rotation.y = heading;
    this.root.updateMatrixWorld(true);
    // head forward axis in head-bone space, read from the bind pose (person faces +Z)
    this.headFwd = new THREE.Vector3(0, 0, 1);
    if (this.bones.head) {
      this.bones.head.getWorldQuaternion(_q);
      _v.set(Math.sin(heading), 0, Math.cos(heading));
      this.headFwd.copy(_v).applyQuaternion(_q.invert());
    }
    this.action(pose).setEffectiveWeight(1);
    this.w[pose] = 1;
  }

  action(name) {
    let a = this.actions[name];
    if (!a) {
      const clip = this.T.clips[name];
      a = this.mixer.clipAction(clip);
      if (name !== 'walk') a.setLoop(THREE.LoopPingPong, Infinity);
      a.time = Math.random() * clip.duration;
      a.timeScale = name === 'walk' ? 1 : 0.85 + Math.random() * 0.25;
      a.play();
      a.setEffectiveWeight(0);
      this.actions[name] = a;
      this.w[name] = 0;
    }
    return a;
  }

  // steering toward this.target, then turning to this.face when idle.
  // avoid: a point (the camera) people keep clear of, so nobody walks through the lens.
  steer(dt, avoid = null, avoidR = 0) {
    let tx = this.target.x, tz = this.target.z;
    if (avoid) {
      const ox = tx - avoid.x, oz = tz - avoid.z, od = Math.hypot(ox, oz);
      if (od < avoidR) {
        const s = avoidR / Math.max(od, 1e-3);
        tx = avoid.x + (od > 1e-3 ? ox * s : avoidR);
        tz = avoid.z + oz * s;
      }
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const want = dist > this.arrive ? Math.min(this.maxSpeed, dist * 1.4 + 0.2) : 0;
    this.speed = damp(this.speed, want, want > this.speed ? 2.2 : 4, dt);
    let ux = dist > 1e-4 ? dx / dist : 0, uz = dist > 1e-4 ? dz / dist : 0;
    if (avoid) {
      const ax = this.pos.x - avoid.x, az = this.pos.z - avoid.z, ad = Math.hypot(ax, az);
      const reach = avoidR * 1.5;
      if (ad < reach && ad > 1e-3) {
        const k = 1 - ad / reach;
        // walk around the circle (on the side the person was already heading) and outwards
        let txn = -az / ad, tzn = ax / ad;
        if (txn * ux + tzn * uz < 0) { txn = -txn; tzn = -tzn; }
        ux += txn * k * 2 + (ax / ad) * k * 1.5;
        uz += tzn * k * 2 + (az / ad) * k * 1.5;
        const l = Math.hypot(ux, uz) || 1;
        ux /= l; uz /= l;
        if (ad < avoidR) {
          // already inside: step out
          const out = (avoidR - ad) * (1 - Math.exp(-3 * dt));
          this.pos.x += (ax / ad) * out;
          this.pos.z += (az / ad) * out;
        }
      }
    }
    if (dist > 0.02 && this.speed > 0.01) {
      const step = Math.min(dist, this.speed * dt);
      this.pos.x += ux * step;
      this.pos.z += uz * step;
      this.heading = dampAngle(this.heading, Math.atan2(ux, uz), 5, dt);
    } else {
      this.heading = dampAngle(this.heading, this.face, 2.2, dt);
    }
  }

  animate(dt) {
    // gait blend: walk weight follows ground speed, the rest goes to the current pose loop
    const walkSpeed = this.T.walkSpeed;
    const targetWalk = THREE.MathUtils.clamp(this.speed / (walkSpeed * 0.55), 0, 1);
    this.walkW = damp(this.walkW, targetWalk, 6, dt);
    const walk = this.action('walk');
    walk.timeScale = THREE.MathUtils.clamp(this.speed / walkSpeed, 0.45, 1.8);
    this.action(this.pose);
    let sum = 0;
    for (const name in this.actions) {
      const goal = name === 'walk' ? this.walkW : name === this.pose ? 1 - this.walkW : 0;
      this.w[name] = damp(this.w[name], goal, 3, dt);
      sum += this.w[name];
    }
    for (const name in this.actions) this.actions[name].setEffectiveWeight(this.w[name] / Math.max(sum, 1e-4));
    this.mixer.update(dt);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld(true);
  }

  // procedural layer: head look-at, anxious hunch, breathing, head shake
  overlay(dt, time) {
    const b = this.bones;
    const fwd = _axis.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = _v2.crossVectors(UP, fwd).normalize();
    if (this.anx > 0.001) {
      rotateBoneWorld(b.spine_02, right, 0.06 * this.anx);
      rotateBoneWorld(b.spine_03, right, 0.08 * this.anx);
      rotateBoneWorld(b.shoulder_l, fwd, 0.13 * this.anx);
      rotateBoneWorld(b.shoulder_r, fwd, -0.13 * this.anx);
      rotateBoneWorld(b.neck, right, 0.2 * this.anx);
    }
    if (this.breath > 0.001) {
      rotateBoneWorld(b.spine_03, right, -0.05 * this.breath);
      rotateBoneWorld(b.shoulder_l, fwd, 0.05 * this.breath);
      rotateBoneWorld(b.shoulder_r, fwd, -0.05 * this.breath);
    }
    // look-at
    this.lookW = damp(this.lookW, this.hasLook ? 1 : 0, 2.5, dt);
    let yaw = 0, pitch = 0;
    if (b.head && this.lookW > 0.002) {
      b.head.getWorldPosition(_v);
      b.head.getWorldQuaternion(_q);
      const hf = _v2.copy(this.headFwd).applyQuaternion(_q);
      const dir = _v.subVectors(this.lookPoint, _v).normalize();
      let rel = wrapAngle(Math.atan2(dir.x, dir.z) - this.heading);
      rel = THREE.MathUtils.clamp(rel, -1.15, 1.15);
      const wantYaw = this.heading + rel;
      yaw = wrapAngle(wantYaw - Math.atan2(hf.x, hf.z));
      pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -0.55, 0.45) - Math.asin(THREE.MathUtils.clamp(hf.y, -1, 1));
    }
    this.yawOff = damp(this.yawOff, yaw * this.lookW, 4, dt);
    this.pitchOff = damp(this.pitchOff, pitch * this.lookW, 4, dt);
    const shake = this.shake * (Math.sin(time * 2.6) * 0.16 + Math.sin(time * 5.3) * 0.05);
    const yawTotal = this.yawOff + shake;
    rotateBoneWorld(b.neck, UP, yawTotal * 0.4);
    rotateBoneWorld(b.head, UP, yawTotal * 0.6);
    if (b.head) {
      b.head.getWorldQuaternion(_q);
      const hf = _v.copy(this.headFwd).applyQuaternion(_q);
      hf.y = 0; hf.normalize();
      const hr = _v2.crossVectors(UP, hf).normalize();
      const down = 0.22 * this.anx;
      rotateBoneWorld(b.neck, hr, -this.pitchOff * 0.4 + down * 0.4);
      rotateBoneWorld(b.head, hr, -this.pitchOff * 0.6 + down * 0.6);
    }
  }

  headWorld(out) { return (this.bones.head ? this.bones.head.getWorldPosition(out) : out.copy(this.pos).setY(1.6)); }
}
