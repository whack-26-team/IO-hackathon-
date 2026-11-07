// Owner: Ahmed (backup switch: Matthew). The camera screen imports createLiveRemy unchanged.
//
// Real Remy = ElevenLabs voice. If ElevenLabs fails (can't connect, out of credits, keeps
// dropping), this switches to the backup Remy by itself: the phone's own speech recognition and
// voice, with Gemini writing his replies (gemini-backup.js). Timers, recipe and steps stay.
// ?backup=1 on the page address = use the backup straight away (saves ElevenLabs credits).
import { createElevenLabsRemy } from './elevenlabs.js';
import { createGeminiRemy } from './gemini-backup.js';

export { createElevenLabsRemy };

const EVENTS = ['status', 'recipe', 'tip', 'roast', 'alert', 'step', 'timer_start', 'timer_cancel'];

export function createLiveRemy(options, { primary = createElevenLabsRemy, backup = createGeminiRemy,
  forceBackup = typeof location !== 'undefined' && new URLSearchParams(location.search).has('backup') } = {}) {
  const handlers = {};
  const emit = (type, data) => (handlers[type] || []).forEach(h => h(data));
  let current = null, onBackup = false, stopped = false, mode = options.mode;

  function attach(remy, isPrimary) {
    for (const type of EVENTS) {
      remy.on(type, data => {
        if (remy !== current) return;
        // ElevenLabs gave up: switch to the backup instead of showing the error
        if (isPrimary && type === 'status' && data?.status === 'error' && !stopped) { switchToBackup(data.message); return; }
        emit(type, data);
      });
    }
  }
  function switchToBackup(reason) {
    if (onBackup) return;
    onBackup = true;
    const old = current;
    try { old?.stop(); } catch { /* already stopped */ }
    console.warn('[Remy] switching to backup voice:', reason);
    emit('tip', { text: "Remy's main voice is down, so he's using his backup voice.", severity: 'info' });
    current = backup({ ...options, mode });
    attach(current, false);
    current.start();
  }

  return {
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    send(type, data = {}) {
      if (type === 'mode_changed' && data?.mode) mode = data.mode;
      return current ? current.send(type, data) : false;
    },
    start() {
      stopped = false;
      if (forceBackup) { onBackup = true; current = backup(options); attach(current, false); return current.start(); }
      // ElevenLabs stops the tracks it was given when it gives up, so it gets a copy:
      // the camera keeps running for the backup.
      current = primary({ ...options, stream: options.stream?.clone?.() || options.stream });
      attach(current, true);
      return current.start();
    },
    stop() { stopped = true; return current?.stop(); },
  };
}
