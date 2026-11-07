// Owner: Felix. DEMO MODE: open the app with ?demo=1 to use this instead of Pretend Remy.
// Goal: play the beats of docs/DEMO.md in order (noodles timer, knife safety alert,
// timer done, Savage cereal roast) so the demo works even with no Wi-Fi / no ElevenLabs,
// and so the backup video (#12) can be recorded.
//
// Same interface as remy/mock.js and remy/live.js: { on, send, start, stop }.
// Events you can emit are listed in docs/CONTRACT.md (status, recipe, tip, roast, alert,
// step, timer_start, timer_cancel). Recipes: fetch(`/api/recipes/instant-noodles`) etc.
//
// STARTER: for now it just behaves like Pretend Remy. Replace this with the demo beats.
import { createMockRemy } from "../remy/mock.js";

export function createDemoRemy(options) {
  return createMockRemy(options);
}
