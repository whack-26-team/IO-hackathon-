// Score log (#113), achievements (#114) and the start-screen menu. Everything is stored only on
// this phone (app.history).
import { ACHIEVEMENTS, earned, checkNewBadges } from "./achievements.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// Days in a row with at least one cook, counting back from today (or yesterday)
export function streak(cooks) {
  const days = new Set(cooks.map((c) => new Date(c.at).toDateString()));
  let n = 0; const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const MODE_ICON = { gentle: "😇", honest: "😏", savage: "🤬" };

function cooksSheet(app) {
  const cooks = app.history.cooks();
  const wrap = el("div", "x-sheet");
  wrap.append(el("h2", "x-title", "🏆 Your cooks"));

  const best = cooks.reduce((m, c) => Math.max(m, c.score || 0), 0);
  const stats = el("div", "x-stats");
  for (const [n, label] of [[cooks.length, "cooks"], [best ? `${best}/10` : "–", "best score"], [streak(cooks), "day streak"]]) {
    const s = el("div", "x-stat"); s.append(el("b", "", String(n)), el("small", "", label)); stats.append(s);
  }
  wrap.append(stats);

  // badges
  wrap.append(el("h3", "x-sub", "Badges"));
  const got = earned(app);
  const grid = el("div", "x-badges");
  for (const a of ACHIEVEMENTS) {
    const b = el("div", "x-badge" + (got[a.id] ? " got" : ""));
    b.append(el("span", "x-badge-icon", got[a.id] ? a.icon : "🔒"), el("b", "", a.name), el("small", "", a.how));
    grid.append(b);
  }
  wrap.append(grid);

  // history
  wrap.append(el("h3", "x-sub", "History"));
  if (!cooks.length) wrap.append(el("p", "x-empty", "No cooks yet. Tap Start cooking and Remy will keep score here."));
  const list = el("ul", "x-list");
  for (const c of cooks.slice(0, 50)) {
    const li = el("li", "x-row");
    const left = el("div", "x-row-main");
    left.append(el("b", "", `${MODE_ICON[c.mode] || ""} ${c.dish || "Freestyle cook"}`),
      el("small", "", `${new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${c.timers || 0} timers · ${c.roasts || 0} roasts${c.alerts ? ` · ${c.alerts} safety` : ""}`));
    li.append(left, el("span", "x-score", `${c.score ?? "–"}/10`));
    list.append(li);
  }
  wrap.append(list);

  const clear = el("button", "x-clear", "Clear history");
  clear.addEventListener("click", () => {
    if (!confirm("Delete all your scores, badges and settings from this phone?")) return;
    app.history.clearAll(); app.closeSheet();
  });
  wrap.append(el("p", "x-note", "🔒 Saved only on this phone, never uploaded."), clear);
  return wrap;
}

export function initCooks(app, menu) {
  menu.add("🏆", "Your cooks", () => app.openSheet(cooksSheet(app)));

  // New badges pop up on the goodbye screen
  app.on("goodbye", () => {
    const slot = document.getElementById("slot-goodbye");
    slot.querySelector(".x-new-badges")?.remove();
    const fresh = checkNewBadges(app);
    if (!fresh.length) return;
    const box = el("div", "x-new-badges");
    box.append(el("span", "x-new-badges-title", fresh.length === 1 ? "New badge!" : `${fresh.length} new badges!`));
    for (const a of fresh) box.append(el("span", "x-new-badge", `${a.icon} ${a.name}`));
    slot.prepend(box);
  });
}
