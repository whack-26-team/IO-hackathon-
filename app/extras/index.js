// Owner: Felix. Entry point for every "extra" feature (score log, achievements, weekly challenge,
// share card, judge mode, watch my pan, look & feel, recipe browser, cooking school, cook-off).
//
// app.js calls initExtras(app) once when the page loads. Build each feature in its own file in
// app/extras/ and start it from here. You never need to edit app.js, index.html or style.css:
//
// SLOTS (empty containers in index.html, fill them with your own elements):
//   #slot-start-chip   start screen, just above "Start cooking" (e.g. weekly challenge)
//   #slot-start-menu   start screen, just below "Start cooking" (menu row: 📖 🎓 🏆 ⚙️)
//   #slot-cook-tools   cooking screen, small buttons above the recipe panel (e.g. 👀, 📸)
//   #slot-goodbye      goodbye screen, under the recap (e.g. new badges, Share button)
//   The start screen must NEVER scroll: keep slots slim and check small phones (375×553).
//
// THE APP OBJECT:
//   app.on(event, fn)   events: "start" {mode, recipe}, "stop", "goodbye" {stats},
//                       "recipe", "tip", "roast", "alert", "step", "timer_start",
//                       "timer_check", "timer_done", "status" (same data as docs/CONTRACT.md)
//   app.stats()         {dish, timers, timersDone, alerts, roasts, stepsDone, score, highlights[]}
//   app.startCooking({ recipeId, mode })   start a cook with a recipe already chosen
//   app.setMode(mode)   switch attitude mid-cook (Savage: ask 18+ first)
//   app.say(text)       show a Remy bubble (and speak it with Pretend Remy)
//   app.openSheet(el) / app.closeSheet()   a bottom sheet over the screen (scrolls inside)
//   app.history         on-phone store: get/set, cooks(), addCook(), settings(), clearAll()
//   app.mode, app.cooking
//
// Styles go in app/extras/extras.css (loaded after style.css).
// Every finished cook is already saved with app.history.addCook() by app.js, so the score log
// just reads app.history.cooks().

export function initExtras(app) {
  void app; // nothing yet: Felix adds features here
}
