// Owner: Matthew. BACKUP REMY: used when ElevenLabs can't connect (e.g. out of credits).
// The phone listens (its own speech recognition), Gemini writes Remy's reply on our server
// (POST /api/chat), and the phone speaks it (its own voice). Actions (recipes, timers, tips,
// roasts, safety alerts) go through the same checked code as ElevenLabs (actions.js), and the
// camera uses the same vision module. Same interface as every Remy: { on, send, start, stop }.
// Open the app with ?backup=1 to use it straight away.
import { createActions } from './actions.js';
import { createVision } from './vision.js';
import { isWakeCall } from './wake.js';

export function createGeminiRemy({ recipe = null, mode = 'honest', profile = null, video, canvas,
  fetcher = fetch, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  const handlers = {};
  const emit = (type, data) => (handlers[type] || []).forEach(h => h(data));
  let active = false, busy = false, speakingNow = false, ending = false, vision = null, recognizer = null, restartTimer;
  const history = [];              // [{role:'user'|'remy', text}]
  let notes = [];                  // app notes waiting for the next reply (camera, timers, results)
  let queued = null;               // a turn waiting while Gemini is busy

  async function request(path, body, timeout = 20000) {
    const ctrl = new AbortController(); const t = schedule(() => ctrl.abort(), timeout);
    try {
      const r = await fetcher(path, body === undefined ? { signal: ctrl.signal } : {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
      return data;
    } finally { cancel(t); }
  }
  const actions = createActions({ emit, request, alive: () => active, now });
  const status = (s, message) => emit('status', { status: s, message });

  // ---------- speaking (phone voice) ----------
  function pickVoice() {
    const voices = globalThis.speechSynthesis?.getVoices?.() || [];
    return voices.find(v => /daniel|arthur|oliver|uk english male|george|harry/i.test(v.name) && /en.GB/i.test(v.lang))
      || voices.find(v => /en.GB/i.test(v.lang)) || null;
  }
  function say(text) {
    return new Promise(resolve => {
      const synth = globalThis.speechSynthesis;
      if (!text || !synth) { listen(); return resolve(); }   // nothing to say: keep listening
      try {
        stopListening();
        speakingNow = true;
        status('remy-speaking', 'Remy is speaking');
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-GB'; u.voice = pickVoice();
        u.rate = mode === 'savage' ? 1.12 : mode === 'gentle' ? 0.95 : 1.02;
        u.pitch = mode === 'savage' ? 0.9 : 1;
        let finished = false;
        const done = () => { if (finished) return; finished = true; clearTimeout(watchdog); speakingNow = false; if (active) { status('live', blockedTries > 0 ? 'Can’t hear you: turn on Dictation' : 'Listening (backup voice)'); listen(); } resolve(); };
        u.onend = done; u.onerror = done;
        // if the phone blocks the line it never says "finished": don't wait forever, go back to listening
        const watchdog = setTimeout(done, 4000 + text.length * 90);
        // iPhones sometimes stall the voice (the line never starts): unstick it and try the line once more
        let started = false;
        u.onstart = () => { started = true; };
        try { if (synth.speaking || synth.pending) synth.cancel(); synth.resume?.(); } catch { /* fine */ }
        synth.speak(u);
        setTimeout(() => {
          if (started || finished) return;
          u.onend = u.onerror = null;
          try { synth.cancel(); synth.resume?.(); } catch { /* fine */ }
          const again = new SpeechSynthesisUtterance(text);
          again.lang = u.lang; again.voice = u.voice; again.rate = u.rate; again.pitch = u.pitch;
          again.onend = done; again.onerror = done;
          synth.speak(again);
        }, 2500);
      } catch { speakingNow = false; resolve(); }
    });
  }

  // ---------- listening (phone speech recognition) ----------
  let lastHearError = null, blockedTries = 0, toldBlocked = false, toldOther = false;
  function listen() {
    if (!active || speakingNow || recognizer) return;
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = 'en-GB'; r.continuous = true; r.interimResults = false;
      r.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) { blockedTries = 0; heard(e.results[i][0].transcript); }
        }
      };
      // keep listening; if the phone keeps refusing, retry slowly instead of 3 times a second
      r.onend = () => { recognizer = null; if (active && !speakingNow) restartTimer = schedule(listen, blockedTries > 2 ? 5000 : 300); };
      // The phone's speech recognition failed. Most often on iPhone: Dictation is off, or Safari isn't
      // allowed Speech Recognition. Say so (once) instead of silently never hearing the cook.
      r.onerror = (e) => {
        const code = e?.error || 'unknown';
        lastHearError = code;
        if (code === 'no-speech' || code === 'aborted') return;   // normal: quiet room, or we stopped it
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          blockedTries++;
          if (!toldBlocked) {
            toldBlocked = true;
            emit('tip', { text: "I can't hear you! On iPhone: Settings › General › Keyboard › turn on Enable Dictation, and allow Speech Recognition for Safari. Then tap Stop and Start again.", severity: 'urgent' });
            status('live', 'Can’t hear you: turn on Dictation');
          }
        } else if (!toldOther) {
          toldOther = true;
          emit('tip', { text: `Trouble hearing you (${code}). Tap Stop and Start again.`, severity: 'warning' });
        }
      };
      recognizer = r;
      r.start();
    } catch { recognizer = null; }
  }
  function stopListening() {
    cancel(restartTimer);
    const r = recognizer; recognizer = null;
    try { r?.abort(); } catch { /* already stopped */ }
  }

  function heard(text) {
    text = (text || '').trim();
    if (!text || !active || ending) return;
    emit('heard', { text });   // the cook spoke (the app's idle hang-up listens for this)
    if (isWakeCall(text) && !busy && !speakingNow) { void say('Yes, chef?'); return; }
    const started = actions.hear(text); // "pasta's in" starts the timer straight away
    if (started?.command) notes.push(`[APP HANDLED: ${started.command}] ${started.note} Acknowledge in five words or fewer; don't repeat it.`);
    if (started?.cleared) notes.push('[RECIPE CLEARED BY APP] The cook asked to clear the recipe; it is gone from the screen. Confirm briefly and ask what they want to cook next.');
    if (started?.seconds) notes.push(`[TIMER STARTED BY APP] ${started.label}, ${started.seconds / 60} minutes. Announce it once: "${started.announce}" Do not call start_timer for it.`);
    if (started) { turn(text); return; }
    // the cook named one of our dishes? load it before Remy answers
    actions.autoRecipe(text).then((auto) => { if (auto?.note) notes.push(auto.note); turn(text); });
  }

  // ---------- one Remy reply ----------
  async function turn(userText, extraNote = '', depth = 0) {
    if (!active) return;
    if (busy) { queued = { userText: [queued?.userText, userText].filter(Boolean).join(' '), extraNote: [queued?.extraNote, extraNote].filter(Boolean).join('\n') }; return; }
    busy = true;
    try {
      if (userText) history.push({ role: 'user', text: userText });
      const snap = actions.snapshot();
      const note = [...notes, extraNote, `[APP STATE] ${JSON.stringify({ current_step: snap.current_step, recipe: snap.recipe?.title || null, timers: snap.timers.map(t => ({ id: t.id, label: t.label, seconds: t.seconds, done: t.done })) })}`].filter(Boolean).join('\n');
      notes = [];
      const r = snap.recipe;
      const data = await request('/api/chat', {
        mode, history: history.slice(-16), note, ...(profile ? { profile } : {}),
        ...(r?.id && !String(r.id).startsWith('ai-') ? { recipe_id: r.id } : r ? { recipe: r } : {}),
      });
      if (!active || ending) return;
      if (data.say) history.push({ role: 'remy', text: data.say });
      const results = [];
      for (const a of data.actions || []) results.push({ action: a.name, result: await actions.call(a.name, a.args || {}) });
      // The camera caught a mistake and Remy only talked: show his words as a roast anyway (Gentle: a tip)
      const unhandled = /\[CAMERA EVENT\]/.test(extraNote) && !results.some(x => ['roast', 'show_tip', 'safety_alert'].includes(x.action)) ? actions.takeUnhandledCamera() : null;
      if (/\[HECKLE\]/.test(extraNote) && data.say && !results.some(x => x.action === 'roast')) emit('roast', { text: data.say, level: 1, heckle: true });
      if (unhandled && data.say) emit(mode === 'gentle' || mode === 'lesson' ? 'tip' : 'roast',
        mode === 'gentle' || mode === 'lesson' ? { text: data.say, severity: 'warning' } : { text: data.say, level: 1, mistake: unhandled.type });
      await say(data.say);
      // Recipe lookups / refused actions: let Remy react to the result (max two follow-ups)
      const needsFollowUp = results.some(x => ['find_recipe', 'create_recipe'].includes(x.action) || x.result?.ok === false);
      if (needsFollowUp && depth < 2 && active) {
        const summary = results.map(x => ({ action: x.action, ok: x.result?.ok, message: x.result?.message,
          found: x.result?.found, recipe: x.result?.recipe?.title, base: x.result?.base?.title, reference: x.result?.reference?.title }));
        busy = false;
        return turn('', `[ACTION RESULTS] ${JSON.stringify(summary)}`, depth + 1);
      }
    } catch (error) {
      if (active) emit('tip', { text: `Backup Remy didn't catch that (${String(error?.message || error).slice(0, 60)}). Say it again?`, severity: 'warning' });
    } finally {
      busy = false;
      if (queued && active) { const q = queued; queued = null; turn(q.userText, q.extraNote); }
    }
  }

  return {
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    send(type, data = {}) {
      if (!active) return false;
      if (type === 'ending') { ending = true; vision?.stop(); queued = null; notes = []; return true; }
      if (ending && type !== 'goodbye') return false;
      if (type === 'mode_changed' && ['gentle', 'honest', 'savage', 'lesson'].includes(data.mode)) { mode = data.mode; return true; }
      if (type === 'goodbye' && typeof data.text === 'string') { say(data.text); return true; }
      if (type === 'say' && typeof data.text === 'string') { say(data.text); return true; }
      if (type === 'heckle') { if (!busy) turn('', "[HECKLE] No mistake right now. Throw ONE short original Savage jab (max 15 words) at the cook's pace, technique, the dish or the kitchen; swearing and a playful nickname are fine. Don't claim a mistake, don't call roast, then carry on."); return true; }
      if (type === 'servings' && Number.isFinite(data.serves)) { notes.push(`[SERVINGS] Now cooking for ${data.serves}; amounts on screen are scaled. Cooking times stay the same.`); return true; }
      if (['timer_check', 'timer_done'].includes(type) && typeof data.id === 'string') {
        const event = actions.timerEvent(type, data);
        turn('', `[${type === 'timer_done' ? 'TIMER DONE' : 'TIMER CHECK'}] ${JSON.stringify(event)}`);
        return true;
      }
      return false;
    },
    async start() {
      active = true;
      status('connecting', 'Starting Remy’s backup voice…');
      try {
        const brain = await request('/api/brain', { mode, lite: true, ...(recipe?.id ? { recipe_id: recipe.id } : {}), ...(profile ? { profile } : {}) });
        actions.configure(brain);
      } catch (error) {
        status('error', `Backup Remy couldn't start (${String(error?.message || error).slice(0, 80)}).`);
        active = false; return;
      }
      if (!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition)) {
        emit('tip', { text: "This browser can't listen for speech, so backup Remy can only watch and talk. Try Safari or Chrome.", severity: 'warning' });
      }
      vision = createVision({ video, canvas, request, actions, emit, now, schedule, cancel, alive: () => active,
        context: text => { notes.push(text); notes = notes.slice(-4); },
        speak: (text, urgent) => turn('', text) });
      vision.start();
      status('live', 'Listening (backup voice)');
      listen();
      turn('', mode === 'savage'
        ? '[APP] The cook just started. Sound unmistakably Savage: greet them with one short, rude food jab, then ask what they are cooking. Do not claim you saw a mistake. Keep the whole reply under 25 words.'
        : '[APP] The cook just started. Greet them in one short line and ask what they are cooking.');
    },
    async stop() {
      active = false;
      stopListening();
      vision?.stop();
      try { globalThis.speechSynthesis?.cancel(); } catch { /* nothing to cancel */ }
    },
  };
}
