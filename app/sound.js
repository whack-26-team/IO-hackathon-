// Owner: Felix
// Little sounds made in code (no audio files to download).
//
// Why this exists: iPhones block all sound until the user taps something, and the
// "permission" from a tap only lasts a moment. So unlockSound() must be called
// FIRST THING in the Start button's tap, before any waiting (fetch, camera, etc.).
// It also plays a short "ding" so we can check on a real iPhone that sound works.
// Note: on iPhone, the silent switch (side of the phone) mutes these sounds.

let ctx = null;

export function unlockSound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  beep("start");
}

// Make the sound engine without the Start "ding" (any tap counts on iPhone)
export function wakeSound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
}

// A burst of noise through a filter: rips and sizzles. sweep = filter pitch from -> to (Hz).
function noise(start, length, volume, type, from, to) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + length);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + length);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0); src.stop(t0 + length + 0.05);
}
// A cartoon "pop": a tone that slides up fast
function pop(start, base = 520, volume = 0.22) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(base, t0); osc.frequency.exponentialRampToValueAtTime(base * 2.4, t0 + 0.09);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
  osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + 0.2);
}

// One short tone. freq = pitch in Hz, start/length in seconds.
function tone(freq, start, length, volume = 0.25) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // fade in/out quickly so it doesn't click
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.05);
}

// Named sounds, so the rest of the app just says beep("done")
export function beep(kind) {
  if (!ctx) return;
  if (kind === "start") { tone(660, 0, 0.15); tone(990, 0.15, 0.25); }          // "ding-dong" on Start
  if (kind === "check") { tone(880, 0, 0.12); tone(880, 0.2, 0.12); }          // two quick pips
  if (kind === "done")  { for (let i = 0; i < 3; i++) tone(1046, i * 0.35, 0.25, 0.35); } // three loud beeps
  if (kind === "rip")   { noise(0.38, 0.22, 0.35, "bandpass", 3200, 900); noise(0.6, 0.12, 0.2, "bandpass", 2400, 700); } // with the "RIIIP!" pop
  if (kind === "sizzle") noise(0, 0.7, 0.12, "highpass", 5000, 3000);             // Savage picked
  if (kind === "alert") { for (let i = 0; i < 4; i++) { tone(440, i * 0.3, 0.14, 0.4); tone(880, i * 0.3 + 0.15, 0.14, 0.4); } }
}

// Goodbye card: one pop per filled star, timed with the stars popping in (higher pitch each time)
export function starPops(n) { for (let i = 1; i <= n; i++) pop(0.15 + i * 0.12, 480 + i * 70); }
