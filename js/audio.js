// Audio engine — plays a track and exposes live frequency levels so the visuals
// can react to the music. Browsers block audio until a user gesture, so we only
// build the AudioContext when the user clicks "sound on".

let ctx, analyser, data, audioEl, started = false;
const levels = { level: 0, bass: 0, mid: 0, treble: 0 };

export function initAudio(url) {
  audioEl = new Audio(url);
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.crossOrigin = "anonymous";
  return audioEl;
}

// Must be called from a user-gesture handler (click). Resolves once playing.
export async function startAudio() {
  if (started) { await audioEl.play(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaElementSource(audioEl);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.82;
  data = new Uint8Array(analyser.frequencyBinCount);
  src.connect(analyser);
  analyser.connect(ctx.destination);
  await ctx.resume();
  await audioEl.play(); // throws if the file is missing → caller handles
  started = true;
}

export function toggle() {
  if (!audioEl) return false;
  if (audioEl.paused) audioEl.play(); else audioEl.pause();
  return !audioEl.paused;
}

export function isPlaying() {
  return started && audioEl && !audioEl.paused;
}

// Read the spectrum once per frame. Returns smoothed 0..1 band energies.
export function updateLevels() {
  if (!started) return levels;
  analyser.getByteFrequencyData(data);
  const n = data.length;
  const bEnd = Math.max(1, Math.floor(n * 0.08));
  const mEnd = Math.floor(n * 0.4);
  let bass = 0, mid = 0, treble = 0, all = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i] / 255;
    all += v;
    if (i < bEnd) bass += v;
    else if (i < mEnd) mid += v;
    else treble += v;
  }
  // ease toward the new values so reactions feel musical, not jittery
  const k = 0.35;
  levels.bass += (bass / bEnd - levels.bass) * k;
  levels.mid += (mid / (mEnd - bEnd) - levels.mid) * k;
  levels.treble += (treble / (n - mEnd) - levels.treble) * k;
  levels.level += (all / n - levels.level) * k;
  return levels;
}
