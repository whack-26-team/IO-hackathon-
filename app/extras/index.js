// Owner: Felix (built by Matthew while Felix is busy). Entry point for every "extra" feature.
//
// app.js calls initExtras(app) once when the page loads. Build each feature in its own file in
// app/extras/ and start it from here. You never need to edit app.js, index.html or style.css:
//
// SLOTS (empty containers in index.html, fill them with your own elements):
//   #slot-start-chip   start screen, just above "Start cooking" (weekly challenge)
//   #slot-start-menu   start screen menu (icon buttons in the top corners, see menu.js)
//   #slot-cook-tools   cooking screen, small buttons above the recipe panel (e.g. 👀, 📸)
//   #slot-goodbye      goodbye screen, under the recap (new badges, Share button)
//   The start screen must NEVER scroll: keep slots slim and check small phones (375×553).
//
// THE APP OBJECT:
//   app.on(event, fn)   events: "start" {mode, recipe}, "stop", "goodbye" {stats},
//                       "recipe", "recipe_clear", "tip", "roast", "alert", "step", "timer_start",
//                       "timer_check", "timer_done", "status" (same data as docs/CONTRACT.md)
//   app.stats()         {dish, timers, timersDone, alerts, roasts, stepsDone, score, highlights[]}
//   app.startCooking({ recipeId, mode })   start a cook with a recipe already chosen
//   app.setMode(mode)   switch attitude mid-cook (Savage: ask 18+ first)
//   app.say(text)       show a Remy bubble (and speak it with Pretend Remy)
//   app.openSheet(el) / app.closeSheet()   a bottom sheet over the screen (scrolls inside)
//   app.keepGoodbye() / app.backToStart()  hold the goodbye screen / leave it now
//   app.history         on-phone store: get/set, cooks(), addCook(), settings(), clearAll()
//   app.mode, app.cooking
//
// Styles go in app/extras/extras.css (loaded after style.css).
import { createMenu } from "./menu.js";
import { initWakeLock } from "./wake.js";
import { initCooks } from "./cooks.js";
import { initChallenge } from "./challenge.js";
import { initShare } from "./share.js";
import { initJudgeMode, initHighlights } from "./judge.js";
import { initWatchMyPan } from "./watch.js";
import { initFeel } from "./feel.js";
import { initRecipeBrowser } from "./recipes.js";

// The start screen must never scroll: if an extra makes it overflow on this phone, hide the
// optional bits (the challenge chip) instead.
function keepStartOnOneScreen() {
  const screen = document.getElementById("start-screen");
  const chip = document.getElementById("slot-start-chip");
  const fit = () => {
    chip.style.display = "";
    if (screen.scrollHeight > screen.clientHeight + 1) chip.style.display = "none";
  };
  fit();
  addEventListener("resize", fit);
  return fit;
}

export function initExtras(app) {
  const start = (name, fn) => { try { return fn(); } catch (e) { console.error(`[extras] ${name}`, e); } };
  const menu = createMenu();
  start("wake lock", () => initWakeLock(app));
  start("your cooks", () => initCooks(app, menu));
  start("recipes", () => initRecipeBrowser(app, menu));
  start("highlights", () => initHighlights(app));   // before share, so highlights sit above the Share button
  start("share", () => initShare(app));
  start("judge mode", () => initJudgeMode());
  start("watch my pan", () => initWatchMyPan(app));
  start("look & feel", () => initFeel(app));
  start("challenge", async () => { await initChallenge(app); keepStartOnOneScreen(); });
}
