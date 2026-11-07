// Owner: Felix
// The screen. It only talks to "Remy" through events (see docs/CONTRACT.md),
// so pretend Remy (remy/mock.js) and real Remy (remy/live.js) are interchangeable.

import { createTimers } from "./timers.js";
import { unlockSound, beep } from "./sound.js";
import { createMockRemy } from "./remy/mock.js";
import { createLiveRemy } from "./remy/live.js";

const $ = (id) => document.getElementById(id);
const state = { recipe: null, mode: "honest", remy: null, stream: null, cooking: false };

const MODE_NAMES = { gentle: "😇 Gentle", honest: "😏 Honest", savage: "🤬 Savage" };

// ---------- start screen ----------

// Savage needs an 18+ "yes" first. If they say no, go back to Honest.
document.querySelectorAll('input[name="mode"]').forEach((el) =>
  el.addEventListener("change", () => {
    if (el.value === "savage" && el.checked) $("age-dialog").classList.remove("hidden");
  })
);
$("age-yes").addEventListener("click", () => $("age-dialog").classList.add("hidden"));
$("age-no").addEventListener("click", () => {
  document.querySelector('input[value="honest"]').checked = true;
  $("age-dialog").classList.add("hidden");
});

$("start-btn").addEventListener("click", async () => {
  // This tap is important: iPhones only allow sound and mic after a tap.
  // Unlock sound FIRST, before any waiting, or the iPhone forgets the tap.
  unlockSound();
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  state.recipe = null; // no recipe yet: Remy asks what you're cooking
  state.cooking = true;

  $("start-screen").classList.add("hidden");
  $("cook-screen").classList.remove("hidden");
  $("mode-badge").textContent = MODE_NAMES[state.mode];
  showRecipe(null);
  setStatus({ status: "connecting", message: "connecting…" });

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: true,
    });
    $("camera").srcObject = state.stream;
  } catch (e) {
    showBubble({ text: "I can't see anything! Allow camera and microphone access, then try again.", severity: "urgent" });
    setStatus({ status: "error", message: "No camera" });
    return;
  }

  const useMock = $("use-mock").checked;
  const factory = useMock ? createMockRemy : createLiveRemy;
  state.remy = factory({
    recipe: null,
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
  if (!state.cooking) return; // Remy's "stopped" status can call this too; only run once
  state.cooking = false;
  state.remy?.stop();
  state.remy = null;
  state.stream?.getTracks().forEach((t) => t.stop());
  timers.clearAll();
  clearTimeout(showBubble.t);
  hideAlert();
  pendingRoast = null;
  $("bubble").className = "bubble hidden";
  $("cook-screen").classList.add("hidden");
  $("start-screen").classList.remove("hidden");
}

// ---------- events from Remy ----------

const timers = createTimers($("timers"), (type, data) => state.remy?.send(type, data), beep);

function wireRemy(remy) {
  remy.on("status", setStatus);
  remy.on("recipe", (d) => showRecipe(d));
  remy.on("tip", (d) => showBubble(d));
  remy.on("roast", (d) => showRoast(d));
  remy.on("alert", (d) => showAlert(d.text));
  remy.on("step", (d) => {
    renderSteps(d.current_step, d.step_complete);
    if (d.next_instruction) showBubble({ text: d.next_instruction, severity: "info" });
  });
  remy.on("timer_start", (d) => timers.start({ ...d, estimate: isEstimate(d.label) }));
  remy.on("timer_cancel", (d) => timers.cancel(d));
}

// ---------- status pill + "Remy is speaking" ----------

function setStatus({ status, message }) {
  const pill = $("status");
  pill.className = `status ${status}`;
  $("status-text").textContent = status === "remy-speaking" ? "Remy is speaking" : (message || status);
  if (status === "stopped") stopCooking();
}

// ---------- tip + roast bubble ----------

// How long each kind of bubble stays up (ms). Urgent stays longest.
const BUBBLE_MS = { info: 9000, warning: 12000, urgent: 15000, roast: 8000 };

function showBubble({ text, severity = "info", level }) {
  const b = $("bubble");
  b.className = "bubble";       // reset, then force the browser to notice,
  void b.offsetWidth;           // so the pop/shake animation replays every time
  b.className = `bubble ${severity}` + (level ? ` level-${level}` : "");
  b.textContent = text;
  clearTimeout(showBubble.t);
  showBubble.t = setTimeout(() => b.classList.add("hidden"), BUBBLE_MS[severity] || 9000);
}

// Safety beats comedy: a roast that arrives during a safety alert waits until it's gone.
let pendingRoast = null;
function showRoast({ text, level = 1 }) {
  if (alertShowing()) { pendingRoast = { text, level }; return; }
  showBubble({ text, severity: "roast", level: Math.min(Math.max(level, 1), 3) });
}

// ---------- safety alert ----------

const ALERT_MS = 7000;
function alertShowing() { return !$("alert-flash").classList.contains("hidden"); }

function showAlert(text) {
  $("alert-text").textContent = text;
  const f = $("alert-flash");
  f.classList.remove("hidden");
  // hide whatever bubble was up (e.g. a joke) so nothing competes with the alert
  $("bubble").classList.add("hidden");
  beep("alert");
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]); // Android only; iPhones ignore this
  clearTimeout(showAlert.t);
  showAlert.t = setTimeout(hideAlert, ALERT_MS);
}

function hideAlert() {
  clearTimeout(showAlert.t);
  $("alert-flash").classList.add("hidden");
  // now the held-back roast (if any) can have its moment
  if (pendingRoast && state.cooking) {
    const r = pendingRoast;
    pendingRoast = null;
    setTimeout(() => showRoast(r), 600);
  }
}
$("alert-flash").addEventListener("click", hideAlert);

// ---------- recipe + steps ----------

function showRecipe(data) {
  const recipe = data?.recipe || null;
  state.recipe = recipe;
  $("no-recipe").classList.toggle("hidden", !!recipe);
  $("recipe-panel").classList.toggle("hidden", !recipe);
  if (!recipe) return;

  $("recipe-title").textContent = recipe.title;
  // Tag: hand-checked by our team, or written by Remy's AI (or ours but not yet checked)
  const tag = $("recipe-tag");
  if (data.checked_by_human) { tag.textContent = "✓ Checked recipe"; tag.className = "tag checked"; }
  else if (data.source === "ai") { tag.textContent = "🤖 Remy's recipe"; tag.className = "tag ai"; }
  else { tag.textContent = "Unchecked recipe"; tag.className = "tag unchecked"; }

  // Safe temperatures (from the server's food-safety table, never made up by the AI)
  const safety = $("safety-list");
  safety.innerHTML = "";
  for (const s of recipe.safety || []) {
    if (!s.temp_c) continue;
    const li = document.createElement("li");
    const food = s.food.split(" (")[0];
    li.textContent = `🌡️ ${food[0].toUpperCase() + food.slice(1)}: ${s.temp_c}°C in the thickest part`;
    safety.appendChild(li);
  }

  const ing = $("ingredients-list");
  ing.innerHTML = "";
  for (const i of recipe.ingredients || []) {
    const li = document.createElement("li");
    li.textContent = i;
    ing.appendChild(li);
  }
  renderSteps(0, false);
}

// "current" = the step you're on now. If Remy says the current step is complete,
// the next one becomes the current one.
function renderSteps(current = 0, currentDone = false) {
  if (!state.recipe) return;
  const steps = state.recipe.steps;
  const now = currentDone ? current + 1 : current;
  const list = $("steps-list");
  list.innerHTML = "";
  steps.forEach((s, i) => {
    const li = document.createElement("li");
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = i < now ? "✓" : String(i + 1);
    const text = document.createElement("span");
    text.textContent = s.instruction;
    li.append(mark, text);
    if (i < now) li.classList.add("done");
    if (i === now) li.classList.add("current");
    list.appendChild(li);
  });
  $("step-summary").textContent = now >= steps.length ? "All done 🎉" : `Step ${now + 1} of ${steps.length}`;
  // keep the current step visible in the scrolling list
  list.querySelector(".current")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Is this timer's time an estimate? (The server marks AI-recipe timers it couldn't
// match to our cook-times table.) We match the timer to the recipe step by its label.
function isEstimate(label) {
  const step = state.recipe?.steps.find((s) => s.timer?.label === label);
  return !!step?.timer?.estimate;
}
