// Recipe browser (#120): 📖 corner button -> all our recipes, ⭐ favourites, "Surprise me".
// Picking one starts cooking with it already loaded.
import { loadAllergens, clashes } from "../allergens.js";
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
// cartoon sticker icon from the app's SVG pieces (index.html), then optional text
const sticker = (id, cls = "x-ico", fill) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 100 100"); s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true"); s.innerHTML = `<use href="#${id}"${fill ? ` fill="${fill}"` : ""}/>`; return s; };
const withIcon = (tag, cls, id, text) => { const e = el(tag, cls); e.append(sticker(id), el("span", "", text)); return e; };

// Cooking school: short technique lessons; Remy watches and gives you 1-5 stars
async function lessonsList(app) {
  const box = el("div");
  box.append(el("p", "x-note", "Short technique practice. Remy watches you and gives you up to 5 stars."));
  let lessons = [];
  try { lessons = await (await fetch("/api/lessons")).json(); } catch { box.append(el("p", "x-empty", "Couldn't load lessons.")); return box; }
  const best = (id) => app.history.cooks().filter((c) => c.lesson === id).reduce((m, c) => Math.max(m, app.history.starsOf(c)), 0);
  const list = el("ul", "x-list");
  for (const l of lessons) {
    const li = el("li", "x-row x-recipe");
    const main = el("button", "x-row-main x-recipe-open");
    const b = best(l.id);
    main.append(el("b", "", l.title), el("small", "", `${l.steps} steps · ${l.summary}`));
    main.addEventListener("click", () => { app.closeSheet(); app.startCooking({ recipeId: l.id }); });
    li.append(main);
    if (b) li.append(el("span", "x-score x-stars x-lesson-best", app.history.starText(b)));   // best score, only once you have one
    list.append(li);
  }
  box.append(list);
  return box;
}

async function browserSheet(app) {
  const wrap = el("div", "x-sheet");
  wrap.classList.add("x-recipes-sheet");
  wrap.append(el("h2", "x-title", "Recipes"));
  // Two tabs: recipes to cook, and short cooking-school lessons (no extra button on the start screen)
  const tabs = el("div", "x-tabs");
  const tRecipes = withIcon("button", "x-tab on", "i-book", "Recipes"), tLessons = withIcon("button", "x-tab", "i-cap", "Lessons");
  tabs.append(tRecipes, tLessons); wrap.append(tabs);
  const recipesPane = el("div", "x-pane"), lessonsPane = el("div", "x-pane hidden");
  // lessons load straight away in the background, so the first switch is instant (no empty flash)
  lessonsList(app).then((box) => lessonsPane.append(box));
  const show = (tab, pane, otherTab, otherPane) => {
    if (tab.classList.contains("on")) return;
    tab.classList.add("on"); otherTab.classList.remove("on");
    otherPane.classList.add("hidden"); pane.classList.remove("hidden");
    pane.classList.remove("x-pane-in"); void pane.offsetWidth; pane.classList.add("x-pane-in");   // gentle fade-in
    wrap.parentElement?.scrollTo?.({ top: 0 });
  };
  tRecipes.addEventListener("click", () => show(tRecipes, recipesPane, tLessons, lessonsPane));
  tLessons.addEventListener("click", () => show(tLessons, lessonsPane, tRecipes, recipesPane));
  wrap.append(recipesPane, lessonsPane);
  let recipes = [];
  try { recipes = await (await fetch("/api/recipes")).json(); } catch { wrap.append(el("p", "x-empty", "Couldn't load recipes. Check your internet.")); return wrap; }

  const favs = () => app.history.get("favourites", []);
  await loadAllergens();
  const settings = app.history.settings();
  const cook = (id) => { app.closeSheet(); app.startCooking({ recipeId: id }); };

  const surprise = withIcon("button", "x-surprise", "i-dice", "Surprise me");
  surprise.addEventListener("click", () => cook(recipes[Math.floor(Math.random() * recipes.length)].id));
  recipesPane.append(surprise, el("p", "x-note", "Or just tap Start and tell Remy anything: he'll find or write a recipe."));

  const list = el("ul", "x-list");
  const render = () => {
    const f = favs();
    list.replaceChildren();
    // Remy's special always first, then favourites, then A–Z
    const sorted = [...recipes].sort((a, b) => (!!b.special - !!a.special) || (f.includes(b.id) - f.includes(a.id)) || a.title.localeCompare(b.title));
    for (const r of sorted) {
      const li = el("li", "x-row x-recipe" + (r.special ? " x-special" : ""));
      const main = el("button", "x-row-main x-recipe-open");
      if (r.special) main.append(withIcon("span", "x-special-badge", "i-star", "Remy's special"));
      const warn = clashes(r.ingredients || [], settings).reasons;
      main.append(el("b", "", r.title), el("small", "", `${r.checked_by_human ? "✓ Checked · " : ""}${r.steps} steps${r.summary ? ` · ${r.summary}` : ""}`));
      if (warn.length) main.append(el("small", "x-warn", `⚠ May contain: ${warn.join(", ")}`));
      main.addEventListener("click", () => cook(r.id));
      const star = el("button", "x-star" + (f.includes(r.id) ? " on" : ""));
      star.append(sticker("i-star", "x-fav", f.includes(r.id) ? "#ffd166" : "#fff"));
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
