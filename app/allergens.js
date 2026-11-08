// Owner: Matthew. Which ingredients clash with the diet / allergies set in ⚙️ Settings.
// Only a helper: Remy can't detect allergens, so the screen always says to check every label.
let table = null;
export async function loadAllergens() {
  if (table) return table;
  try { table = await (await fetch("/api/allergens")).json(); } catch { table = { labels: {}, words: {} }; }
  return table;
}

// settings: { diet: ["vegetarian"], allergies: ["nuts"] } -> keys to check
export const activeKeys = (settings = {}) => [...(settings.diet || []), ...(settings.allergies || [])];

// -> { flagged: Set(index of ingredient), reasons: ["nuts", ...] }
export function clashes(ingredients = [], settings = {}, t = table) {
  const keys = activeKeys(settings); const flagged = new Set(); const reasons = new Set();
  if (!t || !keys.length) return { flagged, reasons: [] };
  ingredients.forEach((ing, i) => {
    const text = ` ${String(ing).toLowerCase()} `;
    for (const k of keys) {
      if ((t.words[k] || []).some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(e?s)?\\b`).test(text))) {
        flagged.add(i); reasons.add(t.labels[k] || k);
      }
    }
  });
  return { flagged, reasons: [...reasons] };
}
