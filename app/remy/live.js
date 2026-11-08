// Owner: Ahmed (backup switch: Matthew). The camera screen imports createLiveRemy unchanged.
//
// Real Remy = ElevenLabs voice. If ElevenLabs fails (can't connect, out of credits, keeps
// dropping), this switches to the backup Remy by itself: the phone's own speech recognition and
// voice, with Gemini writing his replies (gemini-backup.js). Timers, recipe and steps stay.
// Saving ElevenLabs credits for the pitch: the backup (Gemini) voice is the default. ElevenLabs only
// runs with ?full=1 (the pitch) or ?eleven=1 on the page address; ?backup=1 always forces the backup.
import { createElevenLabsRemy } from './elevenlabs.js';
import { createGeminiRemy } from './gemini-backup.js';

export { createElevenLabsRemy };
import { preloadSDK, prefetchBrain } from './elevenlabs.js';

// Faster start: warm up real Remy while the start screen is open (best effort; skipped for ?backup=1)
const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
// true = start on the Gemini backup voice (everything except ?full=1 / ?eleven=1)
export const useBackupVoice = () => typeof location !== 'undefined'
  && (params().has('backup') || !(params().has('full') || params().has('eleven')));

export function preloadLive({ mode, profile } = {}) {
  if (useBackupVoice()) return;   // not using ElevenLabs: don't warm it up (no credits spent)
  preloadSDK().catch(() => {});
  prefetchBrain({ mode, profile });
}

const EVENTS = ['status', 'voice', 'heard', 'recipe', 'recipe_clear', 'tip', 'roast', 'alert', 'step', 'timer_start', 'timer_cancel', 'timer_adjust', 'command', 'lesson_score'];

export function createLiveRemy(options, { primary = createElevenLabsRemy, backup = createGeminiRemy,
  forceBackup = useBackupVoice() } = {}) {
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
    // say WHY, so a screenshot tells us what to fix (credits, network, mic...)
    const why = String(reason || '').match(/\(([^)]*)\)/)?.[1] || String(reason || '').slice(0, 90);
    emit('tip', { text: `Remy's main voice is down${why ? ` (${why})` : ''}, so he's using his backup voice.`, severity: 'info' });
    current = backup({ ...options, mode });
    attach(current, false);
    emit('voice', { kind: 'backup' });
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
      if (forceBackup) { onBackup = true; current = backup(options); attach(current, false); emit('voice', { kind: 'backup' }); return current.start(); }
      // ElevenLabs stops the tracks it was given when it gives up, so it gets a copy:
      // the camera keeps running for the backup.
      current = primary({ ...options, stream: options.stream?.clone?.() || options.stream });
      attach(current, true);
      emit('voice', { kind: 'live' });
      return current.start();
    },
    stop() { stopped = true; return current?.stop(); },
  };
}
