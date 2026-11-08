// ⚙️ Settings (#4): diet and allergies, saved only on this phone. Remy gets one short line about
// them, and matching ingredients are flagged ⚠ in the recipe panel and the recipe browser.
import { pushToggle } from "./push.js";
const DIETS = [["vegetarian", "🥕 Vegetarian"], ["vegan", "🌱 Vegan"]];
const ALLERGIES = [["nuts", "🌰 Nuts"], ["peanuts", "🥜 Peanuts"], ["gluten", "🌾 Gluten"], ["dairy", "🥛 Dairy"],
  ["egg", "🥚 Egg"], ["fish", "🐟 Fish"], ["shellfish", "🦐 Shellfish"], ["sesame", "⚪ Sesame"], ["soy", "🫘 Soy"]];

function toggles(app, key, options) {
  const box = document.createElement("div"); box.className = "x-toggles";
  const chosen = new Set(app.history.settings()[key] || []);
  for (const [id, label] of options) {
    const b = document.createElement("button");
    b.className = "x-toggle" + (chosen.has(id) ? " on" : ""); b.textContent = label;
    b.setAttribute("aria-pressed", String(chosen.has(id)));
    b.addEventListener("click", () => {
      chosen.has(id) ? chosen.delete(id) : chosen.add(id);
      app.history.saveSettings({ [key]: [...chosen] });
      b.classList.toggle("on", chosen.has(id)); b.setAttribute("aria-pressed", String(chosen.has(id)));
    });
    box.append(b);
  }
  return box;
}

export function initSettings(app, menu, openSetup) {
  menu.add("#i-whisk", "Settings", () => {
    const wrap = document.createElement("div"); wrap.className = "x-sheet";
    const h = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text });
    wrap.append(h("h2", "x-title", "⚙️ Settings"),
      h("h3", "x-sub", "Diet"), toggles(app, "diet", DIETS),
      h("h3", "x-sub", "Allergies"), toggles(app, "allergies", ALLERGIES),
      h("p", "x-note", "Remy steers away from these and flags them ⚠ in recipes. He can't detect allergens: always check every label. Saved only on this phone."),
      h("h3", "x-sub", "Timers"), pushToggle(app));
    const setup = h("button", "x-clear x-setup-link", "❓ How to set up your phone");
    setup.addEventListener("click", () => openSetup());
    wrap.append(setup);
    app.openSheet(wrap);
  });
}
