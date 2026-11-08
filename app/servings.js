// Owner: Matthew. Scale a recipe's ingredient amounts for a different number of people.
// Only the main amounts change (the part before any brackets): "200g" -> "400g", "2 tbsp",
// leading counts like "3 eggs". Notes in brackets, sizes like "2.5cm" and times stay as they are.
const UNIT = "(?:kg|g|ml|l|litres?|liters?|tbsp|tsp|cups?)";
const NUM = "(\\d+(?:\\.\\d+)?|½|¼|¾)";
const FRAC = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
const toNum = (s) => FRAC[s] ?? Number(s);

function fmt(n, unit) {
  const u = (unit || "").toLowerCase();
  if (/^(g|ml)$/.test(u)) n = n >= 50 ? Math.round(n / 10) * 10 : n >= 10 ? Math.round(n / 5) * 5 : Math.round(n);
  else if (/^(kg|l|litres?|liters?)$/.test(u)) n = Math.round(n * 10) / 10;
  else if (/^(tbsp|tsp|cups?)$/.test(u)) n = Math.round(n * 2) / 2;
  else n = Math.max(1, Math.round(n));                      // counts: whole things (eggs, slices)
  const whole = Math.floor(n), rest = Math.round((n - whole) * 100) / 100;
  const half = rest === 0.5 ? "½" : rest === 0.25 ? "¼" : rest === 0.75 ? "¾" : "";
  if (half) return whole ? `${whole}${half}` : half;
  return String(Math.round(n * 10) / 10);
}

export function scaleIngredient(text, factor) {
  if (!factor || factor === 1) return text;
  const cut = text.indexOf("(");
  let main = cut >= 0 ? text.slice(0, cut) : text;
  const rest = cut >= 0 ? text.slice(cut) : "";
  // amounts with a unit, anywhere in the main part: "200g", "2 litres", "+ 20g", "2 tbsp"
  main = main.replace(new RegExp(`${NUM}\\s?(${UNIT})\\b`, "gi"), (m, n, unit) => `${fmt(toNum(n) * factor, unit)}${m.includes(" ") ? " " : ""}${unit}`);
  // a plain count at the start ("3 eggs", "About 2 slices"), unless it's already been scaled with a unit
  main = main.replace(new RegExp(`^(\\s*(?:about\\s+)?)${NUM}(?!\\s?${UNIT}\\b|\\.\\d|\\d|cm|mm)\\b`, "i"), (m, pre, n) => `${pre}${fmt(toNum(n) * factor, "")}`);
  return main + rest;
}

export const scaleIngredients = (list = [], from = 1, to = 1) => list.map((i) => scaleIngredient(String(i), to / (from || 1)));
