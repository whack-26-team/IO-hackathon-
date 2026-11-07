// Owner: Felix
// The screen. It only talks to "Remy" through events (see docs/CONTRACT.md),
// so pretend Remy (remy/mock.js) and real Remy (remy/live.js) are interchangeable.

import { createTimers } from "./timers.js";
import { unlockSound } from "./sound.js";
import { createMockRemy } from "./remy/mock.js";
import { createLiveRemy } from "./remy/live.js";

const $ = (id) => document.getElementById(id);
const state = { recipe: null, mode: "honest", remy: null, stream: null };

// ---------- start screen ----------

async function loadRecipes() {
  const picker = $("recipe-picker");
  try {
    const recipes = await (await fetch("/api/recipes")).json();
    for (const r of recipes) {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.title + (r.checked_by_human ? "" : " (unchecked)");
      picker.appendChild(opt);
    }
  } catch (e) {
    picker.innerHTML = `<option>Could not load recipes. Is the server running?</option>`;
  }
}

document.querySelectorAll('input[name="mode"]').forEach((el) =>
  el.addEventListener("change", () => {
    if (el.value === "savage" && el.checked &&
        !confirm("Savage mode swears at you and roasts your cooking. Are you 18+ and OK with that?")) {
      document.querySelector('input[value="honest"]').checked = true;
    }
  })
);

$("start-btn").addEventListener("click", async () => {
  // This tap is important: iPhones only allow sound and mic after a tap.
  // Unlock sound FIRST, before any waiting, or the iPhone forgets the tap.
  unlockSound();
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  state.recipe = await (await fetch(`/api/recipes/${$("recipe-picker").value}`)).json();

  $("start-screen").classList.add("hidden");
  $("cook-screen").classList.remove("hidden");
  $("mode-badge").textContent = { gentle: "😇 Gentle", honest: "😏 Honest", savage: "🤬 Savage" }[state.mode];
  renderSteps(0);

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: true,
    });
    $("camera").srcObject = state.stream;
  } catch (e) {
    showBubble({ text: "I can't see anything! Allow camera and microphone access, then try again.", severity: "urgent" });
    return;
  }

  const useMock = $("use-mock").checked;
  const factory = useMock ? createMockRemy : createLiveRemy;
  state.remy = factory({
    recipe: state.recipe,
    mode: state.mode,
    stream: state.stream,
    video: $("camera"),
    canvas: $("frame-canvas"),
  });
  wireRemy(state.remy);
  state.remy.start();
});

$("stop-btn").addEventListener("click", stopCooking);

function stopCooking() {
  state.remy?.stop();
  state.stream?.getTracks().forEach((t) => t.stop());
  timers.clearAll();
  $("cook-screen").classList.add("hidden");
  $("start-screen").classList.remove("hidden");
}

// ---------- events from Remy ----------

const timers = createTimers($("timers"), (type, data) => state.remy?.send(type, data));

function wireRemy(remy) {
  remy.on("status", ({ status, message }) => {
    $("status").textContent = message || status;
    if (status === "stopped") stopCooking();
  });
  remy.on("tip", (d) => showBubble(d));
  remy.on("roast", (d) => showBubble({ ...d, severity: "roast" }));
  remy.on("alert", (d) => flashAlert(d.text));
  remy.on("step", (d) => {
    renderSteps(d.current_step, d.step_complete);
    if (d.next_instruction) showBubble({ text: d.next_instruction, severity: "info" });
  });
  remy.on("timer_start", (d) => timers.start(d));
  remy.on("timer_cancel", (d) => timers.cancel(d));
}

function showBubble({ text, severity = "info" }) {
  const b = $("bubble");
  b.className = `bubble ${severity}`;
  b.textContent = text;
  // restart the animation for repeated roasts
  void b.offsetWidth;
}

function flashAlert(text) {
  const f = $("alert-flash");
  f.textContent = "⚠️ " + text;
  f.classList.remove("hidden");
  clearTimeout(flashAlert.t);
  flashAlert.t = setTimeout(() => f.classList.add("hidden"), 4000);
}

function renderSteps(current = 0, currentDone = false) {
  const list = $("steps-list");
  list.innerHTML = "";
  state.recipe.steps.forEach((s, i) => {
    const li = document.createElement("li");
    li.textContent = s.instruction;
    if (i < current || (i === current && currentDone)) li.classList.add("done");
    if (i === current) li.classList.add("current");
    list.appendChild(li);
  });
  $("step-summary").textContent = `Step ${current + 1} of ${state.recipe.steps.length}`;
}

loadRecipes();
