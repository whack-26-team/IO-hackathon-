// Weekly challenge (#115): one checked recipe a week, shown as a chip above Start cooking.
const ROTATION = ["scrambled-eggs", "boiled-pasta", "steak", "rigatoni", "toast", "instant-noodles",
  "fruit-salad", "cheese-sandwich", "overnight-oats", "cereal"];

export function weekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export async function initChallenge(app) {
  const slot = document.getElementById("slot-start-chip");
  let recipes = [];
  try { recipes = await (await fetch("/api/recipes")).json(); } catch { return; }
  const available = ROTATION.filter((id) => recipes.some((r) => r.id === id));
  if (!available.length) return;
  const id = available[weekNumber() % available.length];
  const recipe = recipes.find((r) => r.id === id);

  const chip = document.createElement("button");
  chip.className = "x-challenge";
  const render = () => {
    const best = app.history.cooks().filter((c) => c.dish === recipe.title).reduce((m, c) => Math.max(m, c.score || 0), 0);
    chip.textContent = `🎯 This week: ${recipe.title.replace(/ \(.*\)$/, "")}${best ? ` · best ${best}/10` : ""}`;
  };
  render();
  chip.addEventListener("click", () => app.startCooking({ recipeId: id }));
  app.on("goodbye", render);
  slot.replaceChildren(chip);
}
