import * as THREE from 'three';

// Resamples a window of a clip into a new clip at a fixed rate, so it can loop on its own.
export function sampleClip(clip, name, start, end, fps = 24) {
  const n = Math.max(2, Math.round((end - start) * fps) + 1);
  const tracks = clip.tracks.map(track => {
    const interp = track.createInterpolant();
    const size = track.getValueSize();
    const times = new Float32Array(n);
    const values = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      const t = start + ((end - start) * i) / (n - 1);
      times[i] = t - start;
      values.set(interp.evaluate(t), i * size);
    }
    return new track.constructor(track.name, times, values);
  });
  return new THREE.AnimationClip(name, end - start, tracks);
}

// Same clip, but with the hip translation scaled to another person's leg length.
// All rotation tracks are shared between the copies.
export function withHipScale(clip, factor) {
  const tracks = clip.tracks.map(track => {
    if (track.name !== 'hip.position') return track;
    const t = track.clone();
    for (let i = 0; i < t.values.length; i++) t.values[i] *= factor;
    return t;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// The idle capture drifts about 40 cm sideways between its sections, which would leave people
// standing off their own spot. Recentre the hip's horizontal motion of a window on the bind pose.
export function centerHip(clip, bind) {
  const track = clip.tracks.find(t => t.name === 'hip.position');
  if (!track) return clip;
  const v = track.values, n = v.length / 3;
  let mx = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += v[i * 3]; mz += v[i * 3 + 2]; }
  mx = mx / n - bind.x; mz = mz / n - bind.z;
  for (let i = 0; i < n; i++) { v[i * 3] -= mx; v[i * 3 + 2] -= mz; }
  return clip;
}
