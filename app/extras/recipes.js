// Recipe browser (#120): 📖 corner button -> all our recipes, ⭐ favourites, "Surprise me".
// Picking one starts cooking with it already loaded.
import { loadAllergens, clashes } from "../allergens.js";
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// Cooking school: short technique lessons; Remy watches and scores you out of 10
async function lessonsList(app) {
  const box = el("div");
  box.append(el("p", "x-note", "Short technique practice. Remy watches you and scores your technique out of 10."));
  let lessons = [];
  try { lessons = await (await fetch("/api/lessons")).json(); } catch { box.append(el("p", "x-empty", "Couldn't load lessons.")); return box; }
  const best = (id) => app.history.cooks().filter((c) => c.lesson === id).reduce((m, c) => Math.max(m, c.score || 0), 0);
  const list = el("ul", "x-list");
  for (const l of lessons) {
    const li = el("li", "x-row x-recipe");
    const main = el("button", "x-row-main x-recipe-open");
    const b = best(l.id);
    main.append(el("b", "", l.title), el("small", "", `${l.steps} steps · ${l.summary}`));
    main.addEventListener("click", () => { app.closeSheet(); app.startCooking({ recipeId: l.id }); });
    li.append(main);
    if (b) li.append(el("span", "x-score x-lesson-best", `${b}/10`));   // best score, only once you have one
    list.append(li);
  }
  box.append(list);
  return box;
}

async function browserSheet(app) {
  const wrap = el("div", "x-sheet");
  wrap.append(el("h2", "x-title", "📖 Recipes"));
  // Two tabs: recipes to cook, and short cooking-school lessons (no extra button on the start screen)
  const tabs = el("div", "x-tabs");
  const tRecipes = el("button", "x-tab on", "Recipes"), tLessons = el("button", "x-tab", "🎓 Lessons");
  tabs.append(tRecipes, tLessons); wrap.append(tabs);
  const recipesPane = el("div"), lessonsPane = el("div", "hidden");
  tRecipes.addEventListener("click", () => { tRecipes.classList.add("on"); tLessons.classList.remove("on"); recipesPane.classList.remove("hidden"); lessonsPane.classList.add("hidden"); });
  tLessons.addEventListener("click", async () => { tLessons.classList.add("on"); tRecipes.classList.remove("on"); lessonsPane.classList.remove("hidden"); recipesPane.classList.add("hidden"); if (!lessonsPane.childElementCount) lessonsPane.append(await lessonsList(app)); });
  wrap.append(recipesPane, lessonsPane);
  let recipes = [];
  try { recipes = await (await fetch("/api/recipes")).json(); } catch { wrap.append(el("p", "x-empty", "Couldn't load recipes. Check your internet.")); return wrap; }

  const favs = () => app.history.get("favourites", []);
  await loadAllergens();
  const settings = app.history.settings();
  const cook = (id) => { app.closeSheet(); app.startCooking({ recipeId: id }); };

  const surprise = el("button", "x-surprise", "🎲 Surprise me");
  surprise.addEventListener("click", () => cook(recipes[Math.floor(Math.random() * recipes.length)].id));
  recipesPane.append(surprise, el("p", "x-note", "Or just tap Start and tell Remy anything: he'll find or write a recipe."));

  const list = el("ul", "x-list");
  const render = () => {
    const f = favs();
    list.replaceChildren();
    const sorted = [...recipes].sort((a, b) => (f.includes(b.id) - f.includes(a.id)) || a.title.localeCompare(b.title));
    for (const r of sorted) {
      const li = el("li", "x-row x-recipe");
      const main = el("button", "x-row-main x-recipe-open");
      const warn = clashes(r.ingredients || [], settings).reasons;
      main.append(el("b", "", r.title), el("small", "", `${r.checked_by_human ? "✓ Checked · " : ""}${r.steps} steps${r.summary ? ` · ${r.summary}` : ""}`));
      if (warn.length) main.append(el("small", "x-warn", `⚠ May contain: ${warn.join(", ")}`));
      main.addEventListener("click", () => cook(r.id));
      const star = el("button", "x-star" + (f.includes(r.id) ? " on" : ""), f.includes(r.id) ? "★" : "☆");
      star.setAttribute("aria-label", "Favourite");
      star.addEventListener("click", () => {
        const now = favs(); const i = now.indexOf(r.id);
        if (i >= 0) now.splice(i, 1); else now.push(r.id);
        app.history.set("favourites", now); render();
      });
      li.append(main, star); list.append(li);
    }
  };
  render();
  recipesPane.append(list);
  return wrap;
}

export function initRecipeBrowser(app, menu) {
  menu.add("#i-book", "Recipes", async () => app.openSheet(await browserSheet(app)));
}
