// Achievements (#114): badges earned from your cooks (stored on this phone only).
import { starsOf } from "../history.js";
const PASTA = /pasta|rigatoni|penne|spaghetti|fusilli|linguine|macaroni|noodle/i;

function streakOf(cooks) {
  const days = new Set(cooks.map((c) => new Date(c.at).toDateString()));
  let n = 0; const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// test(cooks, latest) -> true when earned. cooks = newest first.
export const ACHIEVEMENTS = [
  { id: "first-cook", icon: "👨‍🍳", name: "First cook", how: "Finish your first cook", test: (c) => c.length >= 1 },
  { id: "first-pasta", icon: "🍝", name: "Pasta person", how: "Cook any pasta", test: (c) => c.some((x) => PASTA.test(x.dish || "")) },
  { id: "no-burns", icon: "🧯", name: "No burns", how: "A whole cook without a roast", test: (c) => c.some((x) => x.dish && !x.roasts) },
  { id: "safety-save", icon: "🛟", name: "Saved by Remy", how: "Get a safety alert (and listen)", test: (c) => c.some((x) => x.alerts > 0) },
  { id: "survived-savage", icon: "🤬", name: "Survived Savage", how: "Finish a cook in Savage mode", test: (c) => c.some((x) => x.mode === "savage") },
  { id: "fish-level", icon: "🐟", name: "Fish-level cook", how: "Get 1 star", test: (c) => c.some((x) => x.dish && starsOf(x) === 1) },
  { id: "top-marks", icon: "🌟", name: "Top marks", how: "Get 5 stars", test: (c) => c.some((x) => starsOf(x) === 5) },
  { id: "three-dishes", icon: "📚", name: "Range", how: "Cook 3 different dishes", test: (c) => new Set(c.map((x) => x.dish).filter(Boolean)).size >= 3 },
  { id: "streak-3", icon: "🔥", name: "On a roll", how: "Cook 3 days in a row", test: (c) => streakOf(c) >= 3 },
  { id: "streak-5", icon: "🏅", name: "Five-day streak", how: "Cook 5 days in a row", test: (c) => streakOf(c) >= 5 },
  { id: "claw-master", icon: "🦀", name: "Claw master", how: "Pass the knife lesson in Cooking school", test: (c) => c.some((x) => x.lesson === "lesson-claw-grip" && starsOf(x) >= 4) },
];

export function earned(app) { return app.history.get("badges", {}); }

// Call after a cook is saved: returns badges earned just now (and stores them)
export function checkNewBadges(app) {
  const cooks = app.history.cooks();
  const got = earned(app);
  const fresh = ACHIEVEMENTS.filter((a) => !got[a.id] && a.test(cooks));
  if (fresh.length) {
    for (const a of fresh) got[a.id] = Date.now();
    app.history.set("badges", got);
  }
  return fresh;
}
