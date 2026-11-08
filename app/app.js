// Owner: Matthew (taken over from Felix). Design: docs/design/ (#52)
// The screen. It only talks to "Remy" through events (see docs/CONTRACT.md),
// so pretend Remy (remy/mock.js) and real Remy (remy/live.js) are interchangeable.

import { createTimers } from "./timers.js";
import { unlockSound, beep, wakeSound, starPops } from "./sound.js";
import { createMockRemy } from "./remy/mock.js";
import { createLiveRemy, preloadLive } from "./remy/live.js";
import { pickMainCamera } from "./camera.js";
import { createDemoRemy } from "./demo/demo-remy.js"; // ?demo=1 (Felix)
import { initModeSwitch } from "./extras/mode-switch.js"; // tap the badge mid-cook (Felix)
import { initSetupGuide } from "./extras/setup-guide.js"; // first-time setup card (Felix)
import { initExtras } from "./extras/index.js"; // all other extras (Felix)
import * as history from "./history.js"; // scores/settings, kept only on this phone
import { loadAllergens, clashes } from "./allergens.js"; // diet/allergy ⚠ in the recipe panel
import { scaleIngredients } from "./servings.js"; // "Serves 2 − +"
loadAllergens();

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
  typeGreeting(m.greeting);
  const face = $("hero-face");
  setUse(face, m.face);
  // same frame in every attitude, so Remy is the same size (Savage's steam spills past it: overflow visible)
  face.setAttribute("viewBox", "-18 -12 136 116");
  // Remy reacts to the attitude: Gentle's halo floats in, Honest smirks (Savage keeps the plain pop)
  face.classList.remove("react-gentle", "react-honest", "react-savage"); void face.offsetWidth;
  face.classList.add(`react-${mode}`);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", m.page);
  // the page behind everything (seen under the home bar / during bounce) matches too: see style.css
  document.documentElement.dataset.mode = mode;
  fitStart();
}
const checkedMode = () => document.querySelector('input[name="mode"]:checked').value;

// ---------- start screen comes alive ----------
// Pretend Remy (scripted, no AI) is for testing only now: add ?pretend=1 to the page address
function usePretend() { return new URLSearchParams(location.search).has("pretend"); }
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// The greeting types itself out (instantly when the phone asks for less motion)
function typeGreeting(text) {
  const g = $("greeting");
  clearInterval(typeGreeting.t);
  if (calm()) { g.textContent = text; return; }
  let i = 0; g.textContent = "";
  g.classList.remove("typing"); void g.offsetWidth; g.classList.add("typing");
  typeGreeting.t = setInterval(() => {
    g.textContent = text.slice(0, ++i);
    if (i >= text.length) { clearInterval(typeGreeting.t); g.classList.remove("typing"); }
  }, 28);
}
// Remy blinks now and then (faces with open eyes; Savage gets an angry blink)
(function blinkLoop() {
  setTimeout(() => {
    const face = $("hero-face");
    const id = face.querySelector("use").getAttribute("href");
    const lids = id === "#f-savage" ? "#blink-fury" : "#blink-eyes";
    if (!calm() && !$("start-screen").classList.contains("hidden") && (id === "#f-sus" || id === "#f-watch" || id === "#f-savage")) {
      face.querySelector(".blinker").setAttribute("href", lids);
      face.classList.add("blink"); setTimeout(() => face.classList.remove("blink"), 140);
    }
    blinkLoop();
  }, 2500 + Math.random() * 2500);
})();

// Savage needs an 18+ "yes" first. If they say no, go back to Honest.
document.querySelectorAll('input[name="mode"]').forEach((el) =>
  el.addEventListener("change", () => {
    if (!el.checked) return;
    applyMode(el.value);
    if (el.value === "savage" && !calm()) { wakeSound(); beep("sizzle"); }
    history.saveSettings({ mode: el.value });                       // remembered for next time
    // 18+ asked once per phone: after a "yes" it doesn't ask again
    if (el.value === "savage" && !history.settings().ageOk) $("age-dialog").classList.remove("hidden");
  })
);
$("age-yes").addEventListener("click", () => { history.saveSettings({ ageOk: true }); $("age-dialog").classList.add("hidden"); });
$("age-no").addEventListener("click", () => {
  document.querySelector('input[value="honest"]').checked = true;
  applyMode("honest");
  history.saveSettings({ mode: "honest" });
  $("age-dialog").classList.add("hidden");
});
$("safety-link").addEventListener("click", () => $("safety-dialog").classList.remove("hidden"));
$("safety-ok").addEventListener("click", () => $("safety-dialog").classList.add("hidden"));
// Start on the attitude used last time (Savage only if the 18+ "yes" was given on this phone)
(function restoreMode() {
  const st = history.settings();
  const m = MODE_NAMES[st.mode] && (st.mode !== "savage" || st.ageOk) ? st.mode : null;
  if (m) { const input = document.querySelector(`input[name="mode"][value="${m}"]`); if (input) input.checked = true; }
})();
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
  showGettingReady();
  setStatus({ status: "connecting", message: "connecting…" });

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: true,
    });
    state.cameraInfo = await pickMainCamera(state.stream);   // the 1x back camera, not the 0.5x ultra-wide (camera.js)
    $("camera").srcObject = state.stream;
    fitCamera();
  } catch (e) {
    showBubble({ text: "I can't see anything! Allow camera and microphone access, then try again.", severity: "urgent" });
    setStatus({ status: "error", message: "No camera" });
    hideGettingReady();
    return;
  }

  quietRemy(); // Remy on screen from the start, with this attitude's face
  const useDemo = new URLSearchParams(location.search).get("demo") === "1"; // scripted demo (docs/DEMO.md)
  const useMock = usePretend();   // Pretend Remy only with ?pretend=1 on the page address (testing)
  state.live = !useMock && !useDemo; // real Remy speaks timer reminders himself (see the timers' sound below)
  const factory = useDemo ? createDemoRemy : useMock ? createMockRemy : createLiveRemy;   // live = Gemini backup voice unless ?full=1 / ?eleven=1 (saves ElevenLabs credits)
  state.voice = useMock || useDemo ? "pretend" : null;   // real Remy reports live/backup itself
  // A recipe picked before Start (extras): load it so Remy starts on it
  let preRecipe = null;
  if (preRecipeId) {
    try { preRecipe = await (await fetch(`/api/recipes/${encodeURIComponent(preRecipeId)}`)).json(); } catch { preRecipe = null; }
    if (preRecipe?.steps) {
      showRecipe({ recipe: preRecipe, source: "remy", checked_by_human: preRecipe.checked_by_human });
      stats.recipe = preRecipe.title; if (preRecipe.lesson) stats.lesson = preRecipe.id;
    }
    else preRecipe = null;
  }
  const settings = history.settings();
  state.remy = factory({
    recipe: preRecipe,
    profile: { diet: settings.diet || [], allergies: settings.allergies || [] },  // ⚙️ Settings: one short line for Remy
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
  const bye = goodbyeFor();
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
  pendingRoast = null; // first, so hiding the alert doesn't show a held-back roast after Stop
  hideAlert();
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
// Savage with 5 stars: he can't believe it (shocked face, grudging line)
const SAVAGE_FIVE = { face: "f-shock", text: "Fine. FINE. That was actually decent. Don't tell anyone." };
const goodbyeFor = () => state.mode === "savage" && recapStars() === 5 ? SAVAGE_FIVE : (GOODBYES[state.mode] || GOODBYES.honest);
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
  const g = goodbyeFor();
  $("goodbye-text").textContent = g.text;
  renderRecap();
  const summary = statsSummary();
  if (summary.dish || summary.timers || summary.roasts || summary.alerts) {
    history.addCook({ dish: summary.dish, mode: state.mode, stars: summary.stars, timers: summary.timers,
      alerts: summary.alerts, roasts: summary.roasts, highlights: summary.highlights.slice(0, 10), ...(summary.lesson ? { lesson: summary.lesson } : {}) });
  }
  fire("goodbye", { stats: summary });
  const face = $("goodbye-face");
  setUse(face, g.face);
  face.setAttribute("viewBox", g.face === "f-savage" || g.face === "f-shock" ? "-28 -12 156 116" : "-18 -12 136 116");
  face.classList.toggle("shocked", g.face === "f-shock");
  $("goodbye").classList.remove("hidden");
  if (!calm()) starPops(summary.stars);
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
  fitStart();
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
  if (type === "timer_check" || type === "timer_done") state.remy?.send(type, data);
}, timerSound);

// ---------- session recap (shown on the goodbye screen) ----------
let stats;
function resetStats() { stats = { timers: new Set(), timersDone: 0, alerts: 0, roasts: 0, stepsDone: 0, recipe: null, highlights: [], lesson: null, lessonScore: null, lessonComment: "" }; }
// Best moments of the session (roasts, safety saves, timers) for the highlights reel. Text only.
function highlight(kind, text) { if (text && stats.highlights.length < 30) stats.highlights.push({ kind, text: String(text).slice(0, 160) }); }
resetStats();
// Remy's stars, 1 to 5: one for turning up, one for the first half of the recipe, one for the second
// half (the last step actually done), then, only once it's finished, one for 2 roasts or fewer and
// one for no safety alerts. Not finished = 2 stars at most; no recipe at all = 2 at most.
// Cooking school: Remy's technique score (1-10) becomes stars.
function recapStars() {
  if (stats.lesson && stats.lessonScore) return Math.max(1, Math.min(5, Math.round(stats.lessonScore / 2)));
  const steps = state.recipe?.steps?.length || 0;
  if (!steps) return 1 + (stats.timersDone > 0 ? 1 : 0);   // no recipe on screen: a finished timer earns one
  const half = stats.stepsDone >= Math.ceil(steps / 2), finished = stats.stepsDone >= steps;
  return 1 + (half ? 1 : 0) + (finished ? 1 : 0)
    + (finished && stats.roasts <= 2 ? 1 : 0) + (finished && stats.alerts === 0 ? 1 : 0);
}
const SCORE_LINES = {
  gentle: (n) => n >= 4 ? "Proud of you, chef!" : "Every cook starts somewhere!",
  honest: (n) => n >= 5 ? "Suspiciously competent." : n >= 3 ? "Edible. Probably." : "We'll call it practice.",
  savage: (n) => n >= 5 ? "I'm speechless. Don't get used to it." : n >= 3 ? "My nan cooks better, and she's an app too." : "A fish could cook better than you.",
};
function statsSummary() {
  return { dish: stats.recipe, timers: stats.timers.size, timersDone: stats.timersDone, alerts: stats.alerts,
    roasts: stats.roasts, stepsDone: stats.stepsDone, stars: recapStars(), highlights: [...stats.highlights], lesson: stats.lesson };
}
// Score card: dish, 1-5 stars, Remy's line, one small icon row
function renderRecap() {
  const stars = recapStars();
  const line = (SCORE_LINES[state.mode] || SCORE_LINES.honest)(stars);
  $("recap-dish").textContent = stats.lesson ? `Lesson: ${stats.recipe || "technique"}` : (stats.recipe || "Freestyle cook");
  // five stars that pop in one by one (filled ones first)
  $("recap-num").replaceChildren(...[1, 2, 3, 4, 5].map((i) => {
    const s = Object.assign(document.createElement("span"), { className: `star${i <= stars ? " on" : ""}`, textContent: i <= stars ? "★" : "☆" });
    s.style.animationDelay = `${0.15 + i * 0.12}s`;
    return s;
  }));
  $("recap-num").setAttribute("aria-label", `${stars} out of 5 stars`);
  $("recap-line").textContent = stats.lesson && stats.lessonComment ? stats.lessonComment : line;
  $("recap-score").textContent = `${history.starText(stars)} ${line}`;
  const items = [["i-timer", stats.timers.size, "timers"], ["i-buoy", stats.alerts, "safety saves"], ["i-flame", stats.roasts, "roasts"]];
  $("recap").replaceChildren(...items.map(([icon, n, label]) => {
    const s = Object.assign(document.createElement("span"), { className: "recap-item" });
    s.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#${icon}"/></svg><b>${n}</b>`;   // sticker icon + count
    s.title = `${n} ${label}`; s.setAttribute("aria-label", `${n} ${label}`);
    return s;
  }));
}

function wireRemy(remy) {
  for (const type of ["status", "recipe", "recipe_clear", "timer_adjust", "command", "lesson_score", "tip", "roast", "alert", "step", "timer_start", "timer_cancel"]) remy.on(type, (d) => fire(type, d));
  remy.on("status", setStatus);
  remy.on("voice", (d) => setVoice(d.kind));   // live.js: ElevenLabs or the backup voice
  remy.on("recipe", (d) => { showRecipe(d); stats.recipe = d.recipe?.title || stats.recipe; if (d.recipe?.lesson) stats.lesson = d.recipe.id; });
  // Cooking school: Remy's technique score becomes the session score
  remy.on("lesson_score", (d) => { stats.lessonScore = d.score; stats.lessonComment = d.comment; showBubble({ text: `${history.starText(Math.max(1, Math.min(5, Math.round(d.score / 2))))} ${d.comment}`, severity: "info" }); });
  // "Clear the recipe": take it off the screen (timers keep running)
  remy.on("recipe_clear", () => { state.recipe = null; showRecipe(null); });
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
  // Hands-free commands (actions.js): "add a minute to the pasta", "how long left?", "repeat that"
  // +/- time, or { to } = set what's left (e.g. "make the pasta timer 8 minutes")
  remy.on("timer_adjust", (d) => timers.adjust(d.id, d.to != null ? d.to - (timers.remaining(d.id)?.left ?? 0) : d.seconds));
  remy.on("command", (d) => {
    if (d.name === "repeat" && d.text) showBubble({ text: d.text, severity: "info" });
    if (d.name === "time_left") {
      const r = timers.remaining(d.id);
      const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      showBubble({ text: r ? `⏱ ${r.label}: ${r.left > 0 ? `${mmss(r.left)} left` : "done!"}` : "⏱ No timers running.", severity: "info" });
    }
  });
}

// ---------- status pill + "Remy is speaking" ----------

// Which voice is running, shown after the status: live (ElevenLabs), backup (phone + Gemini), pretend
const VOICE_LABEL = { live: "live voice", backup: "backup voice", pretend: "pretend" };
function setVoice(kind) { state.voice = kind; setStatus(state.lastStatus || { status: "connecting" }); }
function setStatus({ status, message }) {
  state.lastStatus = { status, message };
  if (status !== "connecting") hideGettingReady();   // Remy's ready (or gave up): show the kitchen
  const pill = $("status");
  pill.className = `chip status ${status}`;  // keep the chip look
  let text = status === "remy-speaking" ? "Remy is speaking" : (message || status);
  text = text.replace(/\s*\((backup voice|pretend Remy)\)/i, "");   // said once, below
  const v = VOICE_LABEL[state.voice];
  $("status-text").textContent = v && status !== "error" && status !== "stopped" ? `${text} · ${v}` : text;
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
  hideGettingReady();
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
  if (alertShowing()) { pendingRoast = { text, level }; return; }  // counted when it's actually shown
  stats.roasts++;
  highlight("roast", text);
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
  if (recipe.lesson) { tag.textContent = "Lesson"; tag.className = "tag checked"; }
  else if (data.checked_by_human) { tag.textContent = "✓ Checked recipe"; tag.className = "tag checked"; }
  else if (data.source === "ai") { tag.textContent = "Remy's recipe"; tag.className = "tag ai"; }
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

  // Serves: start from the recipe's own number; − / + scale the amounts on screen
  state.baseServes = Number(recipe.serves) || 0;
  state.serves = state.baseServes;
  $("servings").classList.toggle("hidden", !state.baseServes);
  renderIngredients();
  renderSteps(0, false);
}

function renderIngredients() {
  const recipe = state.recipe;
  if (!recipe) return;
  $("serves-n").textContent = state.serves || "";
  $("serves-minus").disabled = state.serves <= 1;
  const list = state.baseServes ? scaleIngredients(recipe.ingredients || [], state.baseServes, state.serves) : (recipe.ingredients || []);
  // Diet / allergies from ⚙️ Settings: flag matching ingredients (a helper only: check labels)
  const { flagged, reasons } = clashes(recipe.ingredients || [], history.settings());
  const warn = $("diet-warning");
  warn.classList.toggle("hidden", !reasons.length);
  warn.textContent = reasons.length ? `⚠ May contain: ${reasons.join(", ")}. Remy can't detect allergens: check every label.` : "";
  const ing = $("ingredients-list");
  ing.innerHTML = "";
  list.forEach((i, n) => {
    const li = document.createElement("li");
    li.textContent = flagged.has(n) ? `⚠ ${i}` : i;
    if (flagged.has(n)) li.classList.add("flagged");
    ing.appendChild(li);
  });
  if (reasons.length) {   // allergy/diet clash: open the panel so the warning is seen
    document.querySelector("#recipe-panel .ingredients")?.setAttribute("open", "");
    $("recipe-panel").setAttribute("open", "");
  }
}

// "Serves 2 − +": amounts on screen change, cooking times don't. Remy gets one short note.
function changeServes(delta) {
  if (!state.recipe || !state.baseServes) return;
  state.serves = Math.max(1, Math.min(12, state.serves + delta));
  renderIngredients();
  document.querySelector("#recipe-panel .ingredients")?.setAttribute("open", "");
  clearTimeout(changeServes.t);
  changeServes.t = setTimeout(() => state.remy?.send("servings", { serves: state.serves }), 1200); // once they stop tapping
}
$("serves-minus").addEventListener("click", (e) => { e.preventDefault(); changeServes(-1); });
$("serves-plus").addEventListener("click", (e) => { e.preventDefault(); changeServes(1); });

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
  // collapsed panel: just the step you're on (tap the panel to see everything)
  $("current-step-text").textContent = now < steps.length ? steps[now].instruction : "Plate it up!";
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
      `camera   ${state.cameraInfo ? `${state.cameraInfo.label} ${state.cameraInfo.width}x${state.cameraInfo.height} zoom ${state.cameraInfo.zoom}${state.cameraInfo.to ? ` (was ${state.cameraInfo.from})` : ""}${state.cameraInfo.zoomed ? " zoomed to 1x" : ""}` : "not started"}`,
      `version  v125`,
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
  // Show a Remy bubble; with { voice: true } he also says it (real Remy in his own voice, else the phone's)
  say(text, { voice = false } = {}) {
    showBubble({ text, severity: "info" });
    if (!state.live) sayLocally(text);
    else if (voice) state.remy?.send("say", { text });
  },
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
  keepGoodbye() { clearTimeout(showGoodbye.t); },   // stop the goodbye screen returning to start by itself (e.g. while sharing)
  backToStart: () => backToStart(),
  history,
  get mode() { return state.mode; },
  get cooking() { return state.cooking; },
};
window.remyApp = remyApp; // handy for testing extras from the browser console
try { initExtras(remyApp); } catch (e) { console.error("[extras] failed to start", e); }

// ---------- faster start: warm up real Remy while the start screen is open ----------
function warmUpRemy() {
  if (usePretend() || new URLSearchParams(location.search).get("demo") === "1") return;
  const st = history.settings();
  preloadLive({ mode: checkedMode(), profile: { diet: st.diet || [], allergies: st.allergies || [] } });
}
setTimeout(warmUpRemy, 1200);
document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener("change", () => setTimeout(warmUpRemy, 300)));

// Savage start screen: little embers drifting up behind everything (CSS animates them)
(function makeEmbers() {
  const box = $("embers");
  if (!box) return;
  for (let i = 0; i < 16; i++) {
    const e = document.createElement("i");
    e.style.left = `${Math.random() * 100}%`;
    e.style.setProperty("--size", `${3 + Math.random() * 4}px`);
    e.style.setProperty("--drift", `${(Math.random() - 0.5) * 60}px`);
    e.style.animationDuration = `${5 + Math.random() * 5}s`;
    e.style.animationDelay = `${-Math.random() * 10}s`;
    box.append(e);
  }
})();

// Cooking screen: Remy blinks now and then while he's quiet (same as the start screen)
(function cookBlink() {
  setTimeout(() => {
    const face = $("cook-face");
    const id = face.querySelector("use").getAttribute("href");
    if (state.cooking && !matchMedia("(prefers-reduced-motion: reduce)").matches && (id === "#f-watch" || id === "#f-sus")) {
      face.classList.add("blink"); setTimeout(() => face.classList.remove("blink"), 140);
    }
    cookBlink();
  }, 2500 + Math.random() * 2500);
})();

// "Remy is getting ready": covers the wait while his voice connects (hidden once he's live,
// talks, or gives up; 20 s at most)
const READY_LINES = {
  gentle: "Washing my hands, chef…",
  honest: "Finding my good spatula…",
  savage: "Sharpening my knives. Don't touch anything.",
};
const READY_FACE = { gentle: "f-gentle", honest: "f-sus", savage: "f-savage" };
function showGettingReady() {
  const box = $("getting-ready");
  $("gr-line").textContent = READY_LINES[state.mode] || READY_LINES.honest;
  setUse($("gr-face"), READY_FACE[state.mode] || "f-sus");
  $("gr-face").setAttribute("viewBox", state.mode === "savage" ? "-32 -14 164 120" : "-18 -12 136 116");
  box.className = `getting-ready mode-${state.mode}`;
  clearTimeout(showGettingReady.t);
  showGettingReady.t = setTimeout(hideGettingReady, 20000);
}
function hideGettingReady() {
  clearTimeout(showGettingReady.t);
  const box = $("getting-ready");
  if (!box || box.classList.contains("hidden") || box.classList.contains("leaving")) return;
  box.classList.add("leaving");
  setTimeout(() => box.classList.add("hidden"), 350);
}

// The start screen never scrolls, so if a phone's fonts make it a little too tall, Remy's picture
// shrinks (in 6px steps) until the footer fits. Same in every attitude: nothing shifts when you switch.
function fitStart() {
  const s = document.getElementById("start-screen");
  if (!s || s.classList.contains("hidden")) return;
  let q = 0;
  s.style.setProperty("--squeeze", "0px");
  while (s.scrollHeight > s.clientHeight + 1 && q < 48) { q += 6; s.style.setProperty("--squeeze", `${q}px`); }
  s.scrollTop = 0;
}
// Tapping an attitude focuses it, and the browser would nudge the screen up to show it: keep it still
$("start-screen").addEventListener("scroll", (e) => { if (e.target.scrollTop) e.target.scrollTop = 0; });
addEventListener("resize", fitStart);
document.fonts?.ready.then(fitStart);
setTimeout(fitStart, 600);
