// Owner: Ahmed. Validate tool calls before they can change the cooking screen.
export function validate(schema, value) {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if ((schema.required || []).some(k => !Object.hasOwn(value, k))) return false;
    return Object.entries(value).every(([k, v]) => schema.properties?.[k] && validate(schema.properties[k], v));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length <= 100 && value.every(v => validate(schema.items, v));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'integer') return Number.isInteger(value);
  if (schema.type === 'number') return Number.isFinite(value);
  if (schema.type === 'string') return typeof value === 'string' && value.length <= 4000;
  return typeof value === schema.type;
}

export function createActions({ emit, request, alive, now = Date.now }) {
  let recipe = null, step = 0, schemas = new Map(), suppliedTiming = null;
  const timers = new Map();
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
  let heard = ''; // recent things the cook said, to know which pasta shape they meant
  // "Pasta's in", "it's in", "I've put the penne in", "they're in the pot"...
  const SAID_IN = /\b(it'?s|it is|they'?re|they are|pasta'?s|pasta is|noodles are|that'?s|all|now) in\b|\bput (the |it |them )?(\w+ )?in\b|\b(in|into) the (pot|pan|water)\b|\b(gone|going) in\b/i;
  // When the cook says the food is in, start the next recipe timer straight away, even if
  // Remy hasn't called start_timer yet. Returns the timer so the voice route can tell Remy.
  function autoStart(text) {
    if (!recipe || !SAID_IN.test(text)) return null;
    for (const index of [step, step + 1, step + 2]) {
      const s = recipe.steps[index];
      if (!s) continue;
      let timer = s.timer;
      if (!timer && s.timer_by_shape) {  // pick the shape the cook named (penne, fusilli...)
        const said = heard.toLowerCase();
        timer = Object.entries(s.timer_by_shape).find(([key, t]) =>
          [key.split(/[ _(]/)[0], ...(t.label || '').toLowerCase().split(/[^a-z]+/)].some(w => w.length > 3 && said.includes(w)))?.[1];
        if (!timer) return null;  // shape unknown: Remy asks which pasta it is
      }
      if (!timer) continue;
      // A plain "it's in" only counts for the CURRENT step ("salt's in the water" must not start
      // the pasta timer). Naming the food ("pasta's in", "penne's in") also reaches the next steps.
      const food = [...(timer.label || '').toLowerCase().split(/[^a-z]+/), 'pasta', 'noodle'].filter(w => w.length > 3);
      if (index !== step && !food.some(w => text.toLowerCase().includes(w))) continue;
      const seconds = Math.round(timer.minutes * 60);
      if ([...timers.values()].some(t => !t.done && t.label === timer.label && t.seconds === seconds)) return null;
      const started = { id: timer.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: timer.label, seconds,
        ...(timer.check_at ? { check_at: Math.round(timer.check_at * 60) } : {}) };
      step = index;
      emit('timer_start', started);
      timers.set(started.id, { ...started, done: false, step, instruction: s.instruction, next_instruction: recipe.steps[step + 1]?.instruction });
      return { ...started, announce: announce(timer.label, timer.minutes) };
    }
    return null;
  }
  // "Clear the recipe", "scrap the recipe", "get rid of the recipe" -> take it off the screen
  const CLEAR = /\b(clear|remove|cancel|scrap|delete|forget|close|get rid of|ditch|stop)\b[^.?!]*\brecipe\b/i;
  function clearRecipe() {
    recipe = null; step = 0;
    emit('recipe_clear', {});
    return { ok: true, cleared: true, message: 'Recipe removed from the screen. Ask what they want to cook next.' };
  }
  // Hands-free commands the app handles itself (saves Remy a reply). They start with his name:
  // "Remy, next step" / "back" / "repeat that" / "how long on the pasta?" / "cancel the garlic timer"
  // / "add a minute to the pasta" / "take a minute off the sauce".
  const NAME = /^\W*(?:hey\s+|ok\s+|okay\s+)?(?:remy|rémy|remi|remmy|ramy)\b[\s,.!?:-]*/i;
  const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
  function findTimer(text) {
    const live = [...timers.values()].filter(t => !t.done || text.includes(t.label.toLowerCase()));
    const t = text.toLowerCase();
    return live.find(x => x.label.toLowerCase().split(/[^a-z]+/).some(w => w.length > 2 && t.includes(w)))
      || (live.length === 1 ? live[0] : null);
  }
  function goToStep(index) {
    step = Math.max(0, Math.min(recipe.steps.length - 1, index));
    // same shape as Remy's update_step: "step k-1 complete" moves the screen to step k
    emit('step', step === 0 ? { current_step: 0, step_complete: false, next_instruction: recipe.steps[0].instruction }
      : { current_step: step - 1, step_complete: true, next_instruction: recipe.steps[step].instruction });
  }
  function command(text) {
    const m = text.match(NAME);
    if (!m) return null;
    const rest = text.slice(m[0].length).toLowerCase().trim();
    if (!rest) return null;
    const done = (name, note) => ({ command: name, note });
    if (/\btimer\b/.test(rest) && /\b(cancel|stop|kill|scrap|delete)\b/.test(rest)) {
      const t = findTimer(rest);
      if (!t) return null;
      emit('timer_cancel', { id: t.id }); timers.delete(t.id);
      return done('cancel timer', `${t.label} timer cancelled.`);
    }
    const more = rest.match(/\b(add|another|plus|extra|give (?:it|me))\b\D*?\b(a|an|one|two|three|four|five|\d+)?\s*(?:more\s+)?minutes?\b/);
    const less = rest.match(/\b(take|knock|minus|less)\b\D*?\b(a|an|one|two|three|four|five|\d+)?\s*minutes?\b/);
    if (more || less) {
      const t = findTimer(rest);
      if (!t) return null;
      const n = Number(NUM[(more || less)[2]] ?? (more || less)[2] ?? 1) || 1;
      const seconds = (less && !more ? -1 : 1) * n * 60;
      emit('timer_adjust', { id: t.id, seconds });
      t.seconds = Math.max(0, t.seconds + seconds);
      return done('adjust timer', `${t.label} timer ${seconds > 0 ? '+' : '−'}${n} min.`);
    }
    if (/\bhow long\b|\btime left\b|\bhow much time\b/.test(rest)) {
      const t = findTimer(rest);
      emit('command', { name: 'time_left', id: t?.id || null, label: t?.label || null });
      return done('time left', 'Time left shown on screen.');
    }
    if (!recipe) return null;
    if (/\b(next( step)?|what'?s next|go on|done with this)\b/.test(rest)) { goToStep(step + 1); return done('next step', `Now on step ${step + 1}.`); }
    if (/\b(back|previous( step)?|last step|go back)\b/.test(rest)) { goToStep(step - 1); return done('previous step', `Back to step ${step + 1}.`); }
    if (/\b(repeat|say that again|again|what('?s| is) (the|this) step|what do i do)\b/.test(rest)) {
      emit('command', { name: 'repeat', text: recipe.steps[step].instruction });
      return done('repeat step', 'Current step shown on screen.');
    }
    return null;
  }
  function hear(text) {
    heard = (heard + ' ' + text).slice(-600);
    const cmd = command(text);
    if (cmd) return cmd;
    if (recipe && CLEAR.test(text)) return clearRecipe();
    const started = autoStart(text);
    if (started) return started;
    // Complex durations deliberately require the cook to repeat them as a number.
    if (!/\b(timer|remind|packet|minutes?|seconds?|hours?)\b/i.test(text)) return null;
    const converted = text.toLowerCase().replace(new RegExp(`\\b(${words.join('|')})\\b`, 'g'), word => words.indexOf(word));
    suppliedTiming = null;
    // Never turn "twenty five" into 5 or "one minute thirty seconds" into 1.
    if (/\d\s*[- ]\s*\d|\b(half|quarter|and a|hundred|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/.test(converted)) return;
    const matches = [...converted.matchAll(/\b(\d+(?:\.\d+)?)\s*[- ]?\s*(seconds?|minutes?|hours?)\b/g)];
    if (matches.length !== 1) return;
    const match = matches[0];
    if (match) suppliedTiming = { minutes: Number(match[1]) * (match[2].startsWith('hour') ? 60 : match[2].startsWith('second') ? 1 / 60 : 1), at: now() };
  }
  // Timers the loaded recipe allows: each step's timer and every timer_by_shape option,
  // searched from the current step forwards first, then earlier steps.
  function findRecipeTimer(minutes, check) {
    if (!recipe) return null;
    const order = [...recipe.steps.keys()].sort((a, b) => ((a < step) - (b < step)) || a - b);
    for (const index of order) {
      const s = recipe.steps[index];
      const options = [s.timer, ...Object.values(s.timer_by_shape || {})].filter(Boolean);
      const timer = options.find(t => t.minutes === minutes && (check === undefined || t.check_at === check));
      if (timer) return { timer, index };
    }
    return null;
  }
  // What Remy says when a timer starts: "11-minute timer for the rigatoni pasta."
  function announce(label, minutes) {
    const m = Math.round(minutes * 10) / 10;
    const length = m >= 1 ? `${m}-minute` : `${Math.round(m * 60)}-second`;
    const pasta = recipe?.steps?.some(s => (s.timer?.label === label && /pasta/i.test(s.timer?.from || '')) ||
      Object.values(s.timer_by_shape || {}).some(t => t.label === label));
    return `${length} timer for the ${label.toLowerCase()}${pasta && !/pasta|noodle/i.test(label) ? ' pasta' : ''}.`;
  }
  function setRecipe(data) {
    if (!data.recipe || !Array.isArray(data.recipe.steps) || !data.recipe.steps.length) throw new Error('Recipe has no usable steps.');
    recipe = data.recipe; step = 0;
    emit('recipe', { recipe, source: data.source || 'remy', checked_by_human: !!data.checked_by_human });
  }
  async function call(name, args) {
    if (!alive()) return { ok: false, message: 'Session ended; action not applied.' };
    const schema = schemas.get(name);
    if (!schema || !validate(schema, args)) return { ok: false, message: 'Unknown action or invalid arguments. Use the supplied action schema.' };
    try {
      switch (name) {
        case 'find_recipe': {
          const data = await request(`/api/recipes/find?q=${encodeURIComponent(args.dish)}`);
          if (!alive()) return { ok: false, message: 'Session ended.' };
          if (data.found) setRecipe(data);
          return { ...data, ok: true };
        }
        case 'create_recipe': {
          const data = await request('/api/recipes/ai', { recipe: args });
          if (!alive()) return { ok: false, message: 'Session ended.' };
          if (data.ok) setRecipe({ ...data, source: 'ai' });
          return data;
        }
        case 'start_timer': {
          const { id, label, minutes, check_at_minutes: check } = args;
          if (!id.trim() || !label.trim() || minutes <= 0 || minutes > 240 || (check !== undefined && (check <= 0 || check >= minutes))) throw new Error('Timer duration must be positive and at most 240 minutes; check time must be before the end.');
          const explicit = suppliedTiming && now() - suppliedTiming.at < 90000 && Math.abs(suppliedTiming.minutes - minutes) < 0.00001;
          // The timer can come from ANY step of the loaded recipe, not only the current one: the cook
          // often says "pasta's in" before Remy has moved the step on. Shape-dependent steps
          // (timer_by_shape, e.g. boiled pasta) count too. If it matches, that step becomes current.
          const found = findRecipeTimer(minutes, check);
          const source = found?.timer;
          if (!explicit && !source) throw new Error('Ask the cook for an exact duration, or use a timer from the loaded recipe. Do not guess.');
          if (found && !explicit) step = found.index;
          if (explicit && check !== undefined && source?.check_at !== check) throw new Error('No source for that check time. Omit it.');
          const old = timers.get(id);
          const seconds = Math.round(minutes * 60);
          const twin = [...timers.values()].find(t => !t.done && t.id !== id && t.label === label && t.seconds === seconds);
          if (twin) return { ok: true, already_running: true, message: `The app already started this timer when the cook said it was in. Announce it once if you haven't: "${announce(label, minutes)}"` };
          if (old && old.seconds === seconds && old.label === label && !old.done) return { ok: true, already_running: true, message: 'Timer already running; not restarted.' };
          if (old && !old.done && !explicit) throw new Error('Ask the cook to confirm a changed duration before replacing a timer.');
          const timer = { id, label, seconds, ...(check !== undefined ? { check_at: Math.round(check * 60) } : {}) };
          emit('timer_start', timer);
          timers.set(id, { ...timer, done: false, step, instruction: recipe?.steps[step]?.instruction, next_instruction: recipe?.steps[step + 1]?.instruction });
          return { ok: true, ...timer, message: `Countdown started on the cooking screen. Announce it once, out loud, saying what it's for: "${announce(label, minutes)}"` };
        }
        case 'clear_recipe': return clearRecipe();
        case 'cancel_timer': emit('timer_cancel', { id: args.id }); timers.delete(args.id); break;
        case 'update_step':
          if (!recipe || args.current_step < 0 || args.current_step >= recipe.steps.length) throw new Error('Choose a valid step from the loaded recipe.');
          step = args.current_step + (args.step_complete ? 1 : 0);
          emit('step', args); break;
        case 'show_tip': emit('tip', args); break;
        case 'roast': emit('roast', args); break;
        case 'safety_alert': emit('alert', args); break;
      }
      return { ok: true };
    } catch (error) { return { ok: false, message: error.message }; }
  }
  return {
    call, hear,
    configure(brain) { schemas = new Map(brain.tools.map(t => [t.name, t.parameters])); if (brain.recipe) setRecipe({ recipe: brain.recipe, checked_by_human: brain.recipe.checked_by_human }); },
    snapshot() { return { recipe, current_step: step, timers: [...timers.values()] }; },
    currentStep() { return recipe?.steps[step] || null; },
    timerEvent(type, data) {
      const timer = timers.get(data.id);
      if (timer && type === 'timer_done') timer.done = true;
      return { ...data, timer, next_instruction: timer?.next_instruction, reminder: 'The phone reported this event. Give the relevant next instruction; elapsed time is not proof of doneness or safety.' };
    },
  };
}
