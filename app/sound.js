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
  if (kind === "alert") { for (let i = 0; i < 4; i++) { tone(440, i * 0.3, 0.14, 0.4); tone(880, i * 0.3 + 0.15, 0.14, 0.4); } }
}
