// Recipe browser (#120): 📖 corner button -> all our recipes, ⭐ favourites, "Surprise me".
// Picking one starts cooking with it already loaded.
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

async function browserSheet(app) {
  const wrap = el("div", "x-sheet");
  wrap.append(el("h2", "x-title", "📖 Recipes"));
  let recipes = [];
  try { recipes = await (await fetch("/api/recipes")).json(); } catch { wrap.append(el("p", "x-empty", "Couldn't load recipes. Check your internet.")); return wrap; }

  const favs = () => app.history.get("favourites", []);
  const cook = (id) => { app.closeSheet(); app.startCooking({ recipeId: id }); };

  const surprise = el("button", "x-surprise", "🎲 Surprise me");
  surprise.addEventListener("click", () => cook(recipes[Math.floor(Math.random() * recipes.length)].id));
  wrap.append(surprise, el("p", "x-note", "Or just tap Start and tell Remy anything: he'll find or write a recipe."));

  const list = el("ul", "x-list");
  const render = () => {
    const f = favs();
    list.replaceChildren();
    const sorted = [...recipes].sort((a, b) => (f.includes(b.id) - f.includes(a.id)) || a.title.localeCompare(b.title));
    for (const r of sorted) {
      const li = el("li", "x-row x-recipe");
      const main = el("button", "x-row-main x-recipe-open");
      main.append(el("b", "", r.title), el("small", "", `${r.checked_by_human ? "✓ Checked · " : ""}${r.steps} steps${r.summary ? ` · ${r.summary}` : ""}`));
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
  wrap.append(list);
  return wrap;
}

export function initRecipeBrowser(app, menu) {
  menu.add("📖", "Recipes", async () => app.openSheet(await browserSheet(app)));
}
