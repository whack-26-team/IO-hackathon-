// Owner: Ahmed (Felix may tweak the script of fake events)
// PRETEND REMY: no AI, no internet. Fires fake events on a script so the screen
// can be built and tested before the real live connection is ready.
// It has exactly the same interface as live.js: { on, send, start, stop }.

export function createMockRemy({ recipe, mode }) {
  const handlers = {};
  const timeouts = [];
  const emit = (type, data) => (handlers[type] || []).forEach((h) => h(data));

  const lines = {
    gentle: { roast: "Oops, that's caught a little. No stress, turn the heat down a touch." },
    honest: { roast: "Well, that's officially charcoal. Bin it, chef." },
    savage: { roast: "WHAT is that?! You've cremated it! Bin it and start again, you absolute muppet!" },
  }[mode];

  // [seconds from start, event type, data]
  const script = [
    [1, "status", { status: "live", message: "🟢 Remy (pretend) is watching" }],
    [2, "tip", { text: `Right, ${recipe.title}. Show me your station.`, severity: "info" }],
    [6, "step", { current_step: 0, step_complete: true, next_instruction: recipe.steps[1]?.instruction }],
    [8, "timer_start", { id: "demo", label: "Demo timer", seconds: 20, check_at: 15 }],
    [10, "tip", { text: "Heat looks a bit high. Bring it down a notch.", severity: "warning" }],
    [14, "roast", { text: lines.roast, level: 1 }],
    [18, "alert", { text: "Pan is smoking! Take it off the heat." }],
    [22, "step", { current_step: 1, step_complete: true, next_instruction: recipe.steps[2]?.instruction }],
  ];

  return {
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    send(type, data) {
      console.log("[pretend Remy] got", type, data);
      if (type === "timer_check") emit("tip", { text: `${data.label}: check it now, taste one!`, severity: "warning" });
      if (type === "timer_done") emit("tip", { text: `${data.label} is done. Off the heat!`, severity: "urgent" });
    },
    start() {
      emit("status", { status: "connecting", message: "connecting…" });
      for (const [sec, type, data] of script) timeouts.push(setTimeout(() => emit(type, data), sec * 1000));
    },
    stop() { timeouts.forEach(clearTimeout); },
  };
}
