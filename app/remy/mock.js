// Owner: Ahmed (Felix may tweak the script of fake events)
// PRETEND REMY: no AI, no internet. Fires fake events on a script so the screen
// can be built and tested before the real live connection is ready.
// It has exactly the same interface as live.js: { on, send, start, stop }.
//
// Like real Remy, it starts with NO recipe: it "asks" what you're cooking, then
// sends a `recipe` event (docs/CONTRACT.md). By default that's our rigatoni recipe.
// Add ?mock=ai to the page address to get a pretend AI-written recipe instead
// (shows the "Remy's recipe" tag, safe temperatures and an estimated timer).

// A pretend AI-written recipe, shaped like what POST /api/recipes/ai returns
const AI_RECIPE = {
  id: "ai-chicken-stir-fry",
  title: "Chicken stir fry",
  source: "ai",
  checked_by_human: false,
  ingredients: ["2 chicken breasts, sliced", "1 red pepper", "2 tbsp soy sauce", "1 tbsp oil"],
  steps: [
    { instruction: "Slice the chicken into thin strips." },
    { instruction: "Heat the oil in a wok until shimmering." },
    { instruction: "Stir fry the chicken until cooked through.", timer: { label: "Chicken", minutes: 6, estimate: true } },
    { instruction: "Add the pepper and soy sauce, toss for 2 minutes." },
  ],
  safety: [{ food: "poultry (chicken, turkey, duck), whole or minced", temp_c: 74,
    note: "Steaming hot all the way through, no pink." }],
};

export function createMockRemy({ mode }) {
  const handlers = {};
  const timeouts = [];
  const emit = (type, data) => (handlers[type] || []).forEach((h) => h(data));
  const useAiRecipe = new URLSearchParams(location.search).get("mock") === "ai";
  let recipe = null;

  // Roasts get worse with level. Pranav writes the real ones; these are just for testing.
  const lines = {
    gentle: ["Oops, that's caught a little. No stress, turn the heat down a touch.",
             "Hmm, that's a bit dark. Let's rescue what we can.",
             "Okay, that one's gone. Totally fine, we'll do a fresh batch."],
    honest: ["Well, that's officially charcoal. Bin it, chef.",
             "Did you want it cooked or cremated? Because you chose cremated.",
             "That's not food anymore. That's evidence."],
    savage: ["WHAT is that?! You've cremated it, you absolute muppet!",
             "I have seen better cooking come out of a HOUSE FIRE!",
             "BIN IT! Bin it, bin the pan, and have a long hard look at yourself!"],
  }[mode];

  // Pretend Remy "speaks" for a moment around each thing it says
  const say = (type, data, seconds = 2) => {
    emit("status", { status: "remy-speaking", message: "Remy is speaking" });
    emit(type, data);
    clearTimeout(say.quiet); // a new line restarts the "finished speaking" countdown
    say.quiet = setTimeout(() => emit("status", { status: "live", message: "Listening" }), seconds * 1000);
    timeouts.push(say.quiet);
  };

  async function loadRecipe() {
    if (useAiRecipe) return { recipe: AI_RECIPE, source: "ai", checked_by_human: false };
    const r = await (await fetch("/api/recipes/rigatoni")).json();
    return { recipe: r, source: "remy", checked_by_human: r.checked_by_human };
  }

  // [seconds from start, what to do]
  const script = [
    [1, () => emit("status", { status: "live", message: "Listening (pretend Remy)" })],
    [2, () => say("tip", { text: "Evening, chef. What are we cooking today?", severity: "info" })],
    [5, async () => {
      const r = await loadRecipe();
      recipe = r.recipe;
      emit("recipe", r);
      say("tip", { text: `${recipe.title}, lovely. Show me your station.`, severity: "info" });
    }],
    [8, () => emit("step", { current_step: 0, step_complete: true, next_instruction: recipe.steps[1]?.instruction })],
    [10, () => say("timer_start", { id: "pasta", label: useAiRecipe ? "Chicken" : "Rigatoni", seconds: 30, check_at: 22 })],
    [12, () => say("tip", { text: "Heat looks a bit high. Bring it down a notch.", severity: "warning" })],
    [14, () => emit("timer_start", { id: "garlic", label: "Garlic", seconds: 45, check_at: 30 })],
    [16, () => say("roast", { text: lines[0], level: 1 })],
    [20, () => say("roast", { text: lines[1], level: 2 })],
    // "Remy, make it 8 minutes": real Remy re-sends timer_start with the SAME id and new time
    [23, () => say("timer_start", { id: "garlic", label: "Garlic", seconds: 60, check_at: 40 })],
    [25, () => say("alert", { text: "Fingers! Tuck them into a claw grip." }, 3)],
    // a roast arriving during the alert: the screen must hold it until the alert is gone
    [26, () => emit("roast", { text: lines[2], level: 3 })],
    [34, () => emit("step", { current_step: 1, step_complete: true, next_instruction: recipe.steps[2]?.instruction })],
    [36, () => say("tip", { text: "Garlic's going too fast. Pull it off now!", severity: "urgent" })],
  ];

  return {
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    send(type, data) {
      console.log("[pretend Remy] got", type, data);
      if (type === "timer_check") say("tip", { text: `${data.label}: check it now, taste one!`, severity: "warning" });
      if (type === "timer_done") say("tip", { text: `${data.label} is done. Off the heat!`, severity: "urgent" });
    },
    start() {
      emit("status", { status: "connecting", message: "connecting…" });
      for (const [sec, fn] of script) timeouts.push(setTimeout(fn, sec * 1000));
    },
    stop() { timeouts.forEach(clearTimeout); },
  };
}
