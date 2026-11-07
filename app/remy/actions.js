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
  function hear(text) {
    // Complex durations deliberately require the cook to repeat them as a number.
    if (!/\b(timer|remind|packet|minutes?|seconds?|hours?)\b/i.test(text)) return;
    const converted = text.toLowerCase().replace(new RegExp(`\\b(${words.join('|')})\\b`, 'g'), word => words.indexOf(word));
    suppliedTiming = null;
    // Never turn "twenty five" into 5 or "one minute thirty seconds" into 1.
    if (/\d\s*[- ]\s*\d|\b(half|quarter|and a|hundred|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/.test(converted)) return;
    const matches = [...converted.matchAll(/\b(\d+(?:\.\d+)?)\s*[- ]?\s*(seconds?|minutes?|hours?)\b/g)];
    if (matches.length !== 1) return;
    const match = matches[0];
    if (match) suppliedTiming = { minutes: Number(match[1]) * (match[2].startsWith('hour') ? 60 : match[2].startsWith('second') ? 1 / 60 : 1), at: now() };
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
          const source = recipe?.steps[step]?.timer;
          const explicit = suppliedTiming && now() - suppliedTiming.at < 90000 && Math.abs(suppliedTiming.minutes - minutes) < 0.00001;
          if (!explicit && (!source || source.minutes !== minutes || (check !== undefined && source.check_at !== check))) throw new Error('Ask the cook for an exact duration, or use the current recipe step timer. Do not guess.');
          if (explicit && check !== undefined && source?.check_at !== check) throw new Error('No source for that check time. Omit it.');
          const old = timers.get(id);
          const seconds = Math.round(minutes * 60);
          if (old && old.seconds === seconds && old.label === label && !old.done) return { ok: true, already_running: true, message: 'Timer already running; not restarted.' };
          if (old && !old.done && !explicit) throw new Error('Ask the cook to confirm a changed duration before replacing a timer.');
          const timer = { id, label, seconds, ...(check !== undefined ? { check_at: Math.round(check * 60) } : {}) };
          emit('timer_start', timer);
          timers.set(id, { ...timer, done: false, step, instruction: recipe?.steps[step]?.instruction, next_instruction: recipe?.steps[step + 1]?.instruction });
          return { ok: true, ...timer, message: 'Countdown started on the cooking screen. Confirm the label and duration once.' };
        }
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
