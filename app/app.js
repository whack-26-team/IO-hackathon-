// Owner: Matthew (taken over from Felix). Design: docs/design/ (#52)
// The screen. It only talks to "Remy" through events (see docs/CONTRACT.md),
// so pretend Remy (remy/mock.js) and real Remy (remy/live.js) are interchangeable.

import { createTimers } from "./timers.js";
import { unlockSound, beep } from "./sound.js";
import { createMockRemy } from "./remy/mock.js";
import { createLiveRemy } from "./remy/live.js";
import { createDemoRemy } from "./demo/demo-remy.js"; // ?demo=1 (Felix)
import { initModeSwitch } from "./extras/mode-switch.js"; // tap the badge mid-cook (Felix)
import { initSetupGuide } from "./extras/setup-guide.js"; // first-time setup card (Felix)
import { initExtras } from "./extras/index.js"; // all other extras (Felix)
import * as history from "./history.js"; // scores/settings, kept only on this phone

const $ = (id) => document.getElementById(id);
const state = { recipe: null, mode: "honest", remy: null, stream: null, cooking: false, live: false, preRecipeId: null };

// ---------- events for extras (app/extras/, Felix) ----------
const bus = {};
function fire(event, data) {
  for (const fn of bus[event] || []) { try { fn(data); } catch (e) { console.error("[extras]", event, e); } }
}

// ---------- no zooming ----------
// Safari on iPhone ignores "user-scalable=no" in index.html, so we also block the
// pinch gesture here. Zooming by accident mid-cook makes everything hard to read.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

const MODE_NAMES = { gentle: "Gentle", honest: "Honest", savage: "Savage" };

// Each attitude has its own Remy, greeting and page colour (docs/design/start.html)
const MODES = {
  gentle: { greeting: "Take your time, chef. I've got you.", face: "f-gentle", page: "#eaf3fb" },
  honest: { greeting: "Evening, chef. What are we making tonight?", face: "f-sus", page: "#fff4e0" },
  savage: { greeting: "Go on then. Impress me.", face: "f-savage", page: "#2a1714" },
};
const setUse = (svg, id) => svg.querySelector("use").setAttribute("href", `#${id}`);

// ---------- start screen ----------

function applyMode(mode) {
  const m = MODES[mode];
  const screen = $("start-screen");
  screen.className = `screen mode-${mode}`;
  $("greeting").textContent = m.greeting;
  const face = $("hero-face");
  setUse(face, m.face);
  face.style.animation = "none"; void face.offsetWidth; face.style.animation = ""; // replay the pop
  document.querySelector('meta[name="theme-color"]').setAttribute("content", m.page);
  // the page behind everything (seen under the home bar / during bounce) matches too: see style.css
  document.documentElement.dataset.mode = mode;
}
const checkedMode = () => document.querySelector('input[name="mode"]:checked').value;

// Savage needs an 18+ "yes" first. If they say no, go back to Honest.
document.querySelectorAll('input[name="mode"]').forEach((el) =>
  el.addEventListener("change", () => {
    if (!el.checked) return;
    applyMode(el.value);
    if (el.value === "savage") $("age-dialog").classList.remove("hidden");
  })
);
$("age-yes").addEventListener("click", () => $("age-dialog").classList.add("hidden"));
$("age-no").addEventListener("click", () => {
  document.querySelector('input[value="honest"]').checked = true;
  applyMode("honest");
  $("age-dialog").classList.add("hidden");
});
$("safety-link").addEventListener("click", () => $("safety-dialog").classList.remove("hidden"));
$("safety-ok").addEventListener("click", () => $("safety-dialog").classList.add("hidden"));
applyMode(checkedMode()); // the browser may remember the last choice after a reload
initSetupGuide();

// Switch attitude while cooking (Felix builds the picker in extras/mode-switch.js)
function setMode(mode) {
  if (!MODE_NAMES[mode] || mode === state.mode) return;
  state.mode = mode;
  $("mode-badge").textContent = MODE_NAMES[mode];
  state.remy?.send("mode_changed", { mode });
  if ($("speech").classList.contains("quiet")) quietRemy(); // his resting face follows the attitude
}
initModeSwitch({ badge: $("mode-badge"), getMode: () => state.mode, setMode });

$("start-btn").addEventListener("click", async () => {
  // This tap is important: iPhones only allow sound and mic after a tap.
  // Unlock sound FIRST, before any waiting, or the iPhone forgets the tap.
  unlockSound();
  state.mode = checkedMode();
  state.recipe = null; // no recipe yet: Remy asks what you're cooking
  const preRecipeId = state.preRecipeId; state.preRecipeId = null; // chosen beforehand (recipe browser, challenge)
  resetStats();
  state.cooking = true;

  $("start-screen").classList.add("hidden");
  $("cook-screen").classList.remove("hidden");
  document.documentElement.dataset.mode = "cooking";
  $("mode-badge").textContent = MODE_NAMES[state.mode];
  showRecipe(null);
  setStatus({ status: "connecting", message: "connecting…" });

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: true,
    });
    $("camera").srcObject = state.stream;
    fitCamera();
  } catch (e) {
    showBubble({ text: "I can't see anything! Allow camera and microphone access, then try again.", severity: "urgent" });
    setStatus({ status: "error", message: "No camera" });
    return;
  }

  quietRemy(); // Remy on screen from the start, with this attitude's face
  const useDemo = new URLSearchParams(location.search).get("demo") === "1"; // scripted demo (docs/DEMO.md)
  const useMock = $("use-mock").checked;
  state.live = !useMock && !useDemo; // real Remy speaks timer reminders himself (see the timers' sound below)
  const factory = useDemo ? createDemoRemy : useMock ? createMockRemy : createLiveRemy;
  // A recipe picked before Start (extras): load it so Remy starts on it
  let preRecipe = null;
  if (preRecipeId) {
    try { preRecipe = await (await fetch(`/api/recipes/${encodeURIComponent(preRecipeId)}`)).json(); } catch { preRecipe = null; }
    if (preRecipe?.steps) showRecipe({ recipe: preRecipe, source: "remy", checked_by_human: preRecipe.checked_by_human });
    else preRecipe = null;
  }
  state.remy = factory({
    recipe: preRecipe,
    mode: state.mode,
    stream: state.stream,
    video: $("camera"),
    canvas: $("frame-canvas"),
  });
  wireRemy(state.remy);
  state.remy.start();
  fire("start", { mode: state.mode, recipe: preRecipe });
});

$("stop-btn").addEventListener("click", stopCooking);

function stopCooking() {
  if (!state.cooking) return; // Remy's "stopped" status can call this too; only run once
  state.cooking = false;
  const remy = state.remy, wasLive = state.live;
  state.remy = null;
  // Remy says goodbye out loud in his attitude. Real Remy speaks it himself, so his voice
  // stays connected until the goodbye screen ends; Pretend Remy uses the phone's own voice.
  const bye = GOODBYES[state.mode] || GOODBYES.honest;
  // send() returns false if real Remy isn't connected (e.g. he never connected): then the phone says it
  if (wasLive && remy && remy.send("goodbye", { text: bye.text }) === true) {
    pendingStop = remy;
    state.stream?.getVideoTracks().forEach((t) => t.stop()); // camera off now, mic until he's done
  } else {
    remy?.stop();
    state.stream?.getTracks().forEach((t) => t.stop());
    sayLocally(bye.text);
  }
  timers.clearAll();
  clearTimeout(showBubble.t);
  hideAlert();
  pendingRoast = null;
  quietRemy();
  $("cook-screen").classList.add("hidden");
  document.documentElement.dataset.mode = state.mode; // the attitude's page colour behind the goodbye
  showGoodbye();
  fire("stop", {});
}

// Remy signs off in his attitude's voice, then the start screen comes back by itself.
const GOODBYES = {
  gentle: { face: "f-gentle", text: "Lovely cooking, chef. Enjoy every bite!" },
  honest: { face: "f-proud", text: "Plate it. Take the credit. I'm an app." },
  savage: { face: "f-savage", text: "Bloody hell, we survived. Plate it and get out of my kitchen." },
};
const GOODBYE_MS = 8000; // long enough for Remy to say it and to read the recap
let pendingStop = null;   // real Remy, kept on until he's said goodbye

// Pretend Remy has no voice of his own, so the phone reads the goodbye (Stop was a tap, so iOS allows it)
function sayLocally(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    // a British male voice if the phone has one (iPhone: Daniel / Arthur), closest to Remy
    const voices = speechSynthesis.getVoices?.() || [];
    u.voice = voices.find((v) => /daniel|arthur|oliver|uk english male|george|harry/i.test(v.name) && /en.GB/i.test(v.lang))
      || voices.find((v) => /en.GB/i.test(v.lang)) || null; u.rate = state.mode === "savage" ? 1.1 : state.mode === "gentle" ? 0.95 : 1;
    speechSynthesis.speak(u);
  } catch { /* no voice available: the goodbye is still on screen */ }
}
function showGoodbye() {
  const g = GOODBYES[state.mode] || GOODBYES.honest;
  $("goodbye-text").textContent = g.text;
  renderRecap();
  const summary = statsSummary();
  if (summary.dish || summary.timers || summary.roasts || summary.alerts) {
    history.addCook({ dish: summary.dish, mode: state.mode, score: summary.score, timers: summary.timers,
      alerts: summary.alerts, roasts: summary.roasts, highlights: summary.highlights.slice(0, 10) });
  }
  fire("goodbye", { stats: summary });
  const face = $("goodbye-face");
  setUse(face, g.face);
  face.setAttribute("viewBox", g.face === "f-savage" ? "-28 -12 156 116" : "-18 -12 136 116");
  $("goodbye").classList.remove("hidden");
  clearTimeout(showGoodbye.t);
  showGoodbye.t = setTimeout(backToStart, GOODBYE_MS);
}
function backToStart() {
  clearTimeout(showGoodbye.t);
  pendingStop?.stop(); pendingStop = null;
  state.stream?.getTracks().forEach((t) => t.stop());
  $("goodbye").classList.add("hidden");
  $("start-screen").classList.remove("hidden");
  // back to the top-left at 100%, in case the iPhone shifted the view while the camera was up
  window.scrollTo(0, 0); $("start-screen").scrollTop = 0;
}
$("goodbye").addEventListener("click", backToStart);

// ---------- events from Remy ----------

// Timer sounds: with real Remy, he says the reminder out loud ("taste one now"), so the
// "check" and "done" beeps are skipped (Ahmed's request on #10). Pretend Remy keeps the beeps.
// The cards still turn yellow/red, and the safety-alert sound always plays.
const timerSound = (kind) => { if (state.live && (kind === "check" || kind === "done")) return; beep(kind); };
const timers = createTimers($("timers"), (type, data) => {
  if (type === "timer_done") stats.timersDone++;
  fire(type, data);
  state.remy?.send(type, data);
}, timerSound);

// ---------- session recap (shown on the goodbye screen) ----------
let stats;
function resetStats() { stats = { timers: new Set(), timersDone: 0, alerts: 0, roasts: 0, stepsDone: 0, recipe: null, highlights: [] }; }
// Best moments of the session (roasts, safety saves, timers) for the highlights reel. Text only.
function highlight(kind, text) { if (text && stats.highlights.length < 30) stats.highlights.push({ kind, text: String(text).slice(0, 160) }); }
resetStats();
// Remy's score out of 10: starts at 7, timers finished and steps done help, roasts and safety
// alerts cost points. Just for fun.
function recapScore() {
  const steps = state.recipe?.steps?.length || 0;
  let score = 7 + (stats.timersDone > 0 ? 1 : 0) + (steps && stats.stepsDone >= steps / 2 ? 1 : 0)
    - Math.min(stats.roasts, 3) - Math.min(stats.alerts, 2) * 1.5;
  return Math.max(1, Math.min(10, Math.round(score)));
}
const SCORE_LINES = {
  gentle: (n) => n >= 7 ? `${n}/10. Proud of you, chef!` : `${n}/10. Every cook starts somewhere!`,
  honest: (n) => n >= 8 ? `${n}/10. Suspiciously competent.` : n >= 5 ? `${n}/10. Edible. Probably.` : `${n}/10. We'll call it practice.`,
  savage: (n) => n >= 8 ? `${n}/10. Don't let it go to your head.` : n >= 5 ? `${n}/10. My nan cooks better, and she's an app too.` : `${n}/10. A fish could cook better than you.`,
};
function statsSummary() {
  return { dish: stats.recipe, timers: stats.timers.size, timersDone: stats.timersDone, alerts: stats.alerts,
    roasts: stats.roasts, stepsDone: stats.stepsDone, score: recapScore(), highlights: [...stats.highlights] };
}
function renderRecap() {
  const chips = [
    stats.recipe && `🍽 ${stats.recipe}`,
    `⏱ ${stats.timers.size} timer${stats.timers.size === 1 ? "" : "s"}`,
    stats.alerts && `🛟 ${stats.alerts} safety save${stats.alerts === 1 ? "" : "s"}`,
    `🔥 ${stats.roasts} roast${stats.roasts === 1 ? "" : "s"}`,
  ].filter(Boolean);
  const box = $("recap");
  box.replaceChildren(...chips.map((t) => Object.assign(document.createElement("span"), { className: "recap-chip", textContent: t })));
  $("recap-score").textContent = (SCORE_LINES[state.mode] || SCORE_LINES.honest)(recapScore());
}

function wireRemy(remy) {
  for (const type of ["status", "recipe", "tip", "roast", "alert", "step", "timer_start", "timer_cancel"]) remy.on(type, (d) => fire(type, d));
  remy.on("status", setStatus);
  remy.on("recipe", (d) => { showRecipe(d); stats.recipe = d.recipe?.title || stats.recipe; });
  remy.on("tip", (d) => showBubble(d));
  remy.on("roast", (d) => showRoast(d));
  remy.on("alert", (d) => showAlert(d.text));
  remy.on("step", (d) => {
    if (d.step_complete) stats.stepsDone = Math.max(stats.stepsDone, (d.current_step ?? 0) + 1);
    renderSteps(d.current_step, d.step_complete);
    if (d.next_instruction) showBubble({ text: d.next_instruction, severity: "info" });
  });
  remy.on("timer_start", (d) => {
    stats.timers.add(d.id);
    highlight("timer", timerPhrase(d.label, d.seconds / 60, state.recipe));
    timers.start({ ...d, estimate: isEstimate(d.label) });
    // Say on screen what the timer is for ("⏱ 11-minute timer for the rigatoni pasta"),
    // unless a safety alert is up (that always wins)
    if (!alertShowing()) showBubble({ text: `⏱ ${timerPhrase(d.label, d.seconds / 60, state.recipe)}`, severity: "info" });
  });
  remy.on("timer_cancel", (d) => timers.cancel(d));
}

// ---------- status pill + "Remy is speaking" ----------

function setStatus({ status, message }) {
  const pill = $("status");
  pill.className = `chip status ${status}`;  // keep the chip look
  $("status-text").textContent = status === "remy-speaking" ? "Remy is speaking" : (message || status);
  if (status === "stopped") stopCooking();
}

// ---------- tip + roast bubble ----------

// How long each kind of bubble stays up (ms). Urgent stays longest.
const BUBBLE_MS = { info: 9000, warning: 12000, urgent: 15000, roast: 8000 };

// Remy's face while he talks: his everyday face for the attitude, a raised eyebrow
// for warnings, and fury (with steam in Savage) for roasts.
function faceFor(severity) {
  if (severity === "roast") return state.mode === "savage" ? "f-savage" : "f-fury";
  if (severity === "warning" || severity === "urgent") return "f-sus";
  return state.mode === "gentle" ? "f-gentle" : "f-watch";
}

// Remy stays on screen when he isn't talking: bubble hidden, his everyday face showing.
function quietRemy() {
  clearTimeout(showBubble.t);
  $("speech").className = "speech quiet";
  setFace(faceFor("info"));
}

function setFace(id) {
  const face = $("cook-face");
  setUse(face, id);
  face.setAttribute("viewBox", id === "f-savage" ? "-28 -12 156 116" : "-18 -12 136 116"); // room for the steam
}

function showBubble({ text, severity = "info", level }) {
  const sp = $("speech");
  sp.className = "speech";      // reset, then force the browser to notice,
  void sp.offsetWidth;          // so the pop/shake animation replays every time
  sp.className = `speech ${severity}` + (level ? ` level-${level}` : "");
  $("bubble-text").textContent = text;
  setFace(faceFor(severity));
  clearTimeout(showBubble.t);
  showBubble.t = setTimeout(quietRemy, BUBBLE_MS[severity] || 9000);
}

// Safety beats comedy: a roast that arrives during a safety alert waits until it's gone.
let pendingRoast = null;
function showRoast({ text, level = 1 }) {
  stats.roasts++;
  highlight("roast", text);
  if (alertShowing()) { pendingRoast = { text, level }; return; }
  showBubble({ text, severity: "roast", level: Math.min(Math.max(level, 1), 3) });
}

// "11-minute timer for the rigatoni pasta". Pasta shapes get "pasta" added so it's obvious.
function timerPhrase(label, minutes, recipe) {
  const m = Math.round(minutes * 10) / 10;
  const length = m >= 1 ? `${m}-minute` : `${Math.round(m * 60)}-second`;
  const food = label.toLowerCase();
  const pastaRecipe = /pasta|rigatoni|penne|spaghetti|fusilli|noodle/i.test(`${recipe?.id} ${recipe?.title}`) ||
    recipe?.steps?.some((st) => st.timer_by_shape);
  const isPastaShape = recipe?.steps?.some((st) => st.timer?.label === label && /pasta/i.test(st.timer?.from || "")) ||
    recipe?.steps?.some((st) => Object.values(st.timer_by_shape || {}).some((t) => t.label === label));
  const suffix = pastaRecipe && isPastaShape && !/pasta|noodle/.test(food) ? " pasta" : "";
  return `${length} timer for the ${food}${suffix}`;
}

// ---------- safety alert ----------

const ALERT_MS = 7000;
function alertShowing() { return !$("alert-flash").classList.contains("hidden"); }

function showAlert(text) {
  stats.alerts++;
  highlight("alert", text);
  $("alert-text").textContent = text;
  const f = $("alert-flash");
  f.classList.remove("hidden");
  // hide whatever Remy was saying (e.g. a joke) so nothing competes with the alert
  quietRemy();
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

// ---------- camera always fills the screen ----------
// iPhone Safari doesn't always apply "object-fit: cover" to a live camera video, which
// leaves a black border. So we do the maths ourselves: make the video big enough to cover
// the whole screen (cropping the edges, like a phone's camera app) and centre it.
function fitCamera() {
  const video = $("camera");
  const box = $("cook-screen");
  const sw = box.clientWidth, sh = box.clientHeight;      // screen size
  const vw = video.videoWidth, vh = video.videoHeight;    // camera picture size
  if (!sw || !sh || !vw || !vh) return;                    // not ready yet; we'll be called again
  const scale = Math.max(sw / vw, sh / vh);                // "cover": the bigger of the two
  const w = Math.ceil(vw * scale), h = Math.ceil(vh * scale);
  const key = `${sw}x${sh}:${vw}x${vh}`;
  if (video.dataset.fit === key) return; // already the right size
  video.dataset.fit = key;
  Object.assign(video.style, {
    width: `${w}px`, height: `${h}px`,
    left: `${Math.floor((sw - w) / 2)}px`, top: `${Math.floor((sh - h) / 2)}px`,
  });
}
// When the phone rotates, the iPhone reports it late and in pieces (screen first, camera
// picture a moment later). So after anything changes we re-check on EVERY screen refresh
// for 2 seconds, which catches each size change the moment it happens.
function fitCameraForAWhile() {
  fitCamera();
  const until = performance.now() + 2000;
  if (fitCameraForAWhile.running) { fitCameraForAWhile.until = until; return; }
  fitCameraForAWhile.running = true;
  fitCameraForAWhile.until = until;
  (function loop() {
    fitCamera();
    if (performance.now() < fitCameraForAWhile.until) requestAnimationFrame(loop);
    else fitCameraForAWhile.running = false;
  })();
}

// Re-check whenever anything could change the sizes:
const camera = $("camera");
camera.addEventListener("loadedmetadata", fitCameraForAWhile); // camera told us its size
camera.addEventListener("resize", fitCameraForAWhile);         // camera picture changed shape (rotation)
window.addEventListener("resize", fitCameraForAWhile);         // screen size changed
window.addEventListener("orientationchange", fitCameraForAWhile);
document.addEventListener("visibilitychange", () => { if (!document.hidden) fitCameraForAWhile(); }); // back from another app
// Watches the cooking screen's own size directly, which doesn't wait for the late events above
new ResizeObserver(fitCameraForAWhile).observe($("cook-screen"));

// ---------- ?debug=1: show what the phone reports (for screen-size problems) ----------
if (new URLSearchParams(location.search).has("debug")) {
  const probe = Object.assign(document.createElement("div"), { id: "safe-probe" });
  const box = Object.assign(document.createElement("div"), { id: "debug" });
  document.body.append(probe, box);
  const show = () => {
    const p = getComputedStyle(probe);
    const bd = document.getElementById("backdrop").getBoundingClientRect();
    box.textContent = [
      `window   ${innerWidth} x ${innerHeight}`,
      `screen   ${screen.width} x ${screen.height}`,
      `visual   ${Math.round(visualViewport?.width ?? 0)} x ${Math.round(visualViewport?.height ?? 0)}`,
      `web app  standalone=${navigator.standalone} display-mode=${matchMedia("(display-mode: standalone)").matches}`,
      `safe     top ${p.paddingTop} bottom ${p.paddingBottom} left ${p.paddingLeft} right ${p.paddingRight}`,
      `backdrop top ${Math.round(bd.top)} bottom ${Math.round(bd.bottom)}`,
      `version  v89`,
    ].join("\n");
  };
  show(); addEventListener("resize", show); setInterval(show, 1000);
}

// ---------- the app object extras use (app/extras/index.js, Felix) ----------
// See the comment at the top of app/extras/index.js for what each part does.
const remyApp = {
  on(event, fn) { (bus[event] ||= []).push(fn); },
  stats: () => statsSummary(),
  startCooking({ recipeId = null, mode = null } = {}) {
    if (state.cooking) return false;
    if (mode && MODE_NAMES[mode]) {
      const input = document.querySelector(`input[name="mode"][value="${mode}"]`);
      if (input && mode !== "savage") { input.checked = true; applyMode(mode); }
    }
    state.preRecipeId = recipeId;
    $("start-btn").click();
    return true;
  },
  setMode,
  say(text) { showBubble({ text, severity: "info" }); if (!state.live) sayLocally(text); },
  openSheet(el) {
    const host = $("slot-sheets");
    const backdrop = Object.assign(document.createElement("div"), { className: "sheet-backdrop" });
    const sheet = Object.assign(document.createElement("div"), { className: "sheet" });
    sheet.append(el); backdrop.append(sheet);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) remyApp.closeSheet(); });
    host.replaceChildren(backdrop);
    return sheet;
  },
  closeSheet() { $("slot-sheets").replaceChildren(); },
  history,
  get mode() { return state.mode; },
  get cooking() { return state.cooking; },
};
window.remyApp = remyApp; // handy for testing extras from the browser console
try { initExtras(remyApp); } catch (e) { console.error("[extras] failed to start", e); }
