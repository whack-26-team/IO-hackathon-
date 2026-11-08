// Score log (#113), achievements (#114) and the start-screen menu. Everything is stored only on
// this phone (app.history).
import { sticker, withSticker } from "./sticker.js";
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

const MODE_ICON = { gentle: "f-gentle", honest: "f-sus", savage: "f-savage" };   // little Remy faces

function cooksSheet(app) {
  const cooks = app.history.cooks();
  const wrap = el("div", "x-sheet");
  wrap.append(el("h2", "x-title", "Your cooks"));

  const best = cooks.reduce((m, c) => Math.max(m, app.history.starsOf(c)), 0);
  const stats = el("div", "x-stats");
  for (const [n, label] of [[cooks.length, "cooks"], [best ? `${best}★` : "–", "best"], [streak(cooks), "day streak"]]) {
    const s = el("div", "x-stat"); s.append(el("b", "", String(n)), el("small", "", label)); stats.append(s);
  }
  wrap.append(stats);

  // badges
  wrap.append(el("h3", "x-sub", "Badges"));
  const got = earned(app);
  const grid = el("div", "x-badges");
  for (const a of ACHIEVEMENTS) {
    const b = el("div", "x-badge" + (got[a.id] ? " got" : ""));
    // earned: a tilted sticker (it slaps on if you got it in the last few minutes); locked: grey outline
    const fresh = got[a.id] && Date.now() - got[a.id] < 5 * 60 * 1000;
    if (fresh) b.classList.add("x-slap");
    b.style.setProperty("--tilt", `${((a.id.length * 7) % 9) - 4}deg`);
    b.append(sticker(a.icon, { cls: "x-badge-icon", fill: a.icon === "i-star" ? "#ffd166" : undefined }), el("b", "", a.name), el("small", "", a.how));
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
    left.append(withSticker("b", "x-row-title", MODE_ICON[c.mode] || "f-sus", c.dish || "Freestyle cook"),
      el("small", "", `${new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${c.timers || 0} timers · ${c.roasts || 0} roasts${c.alerts ? ` · ${c.alerts} safety` : ""}`));
    const best = (c.highlights || []).find((h) => h.kind === "alert") || (c.highlights || []).find((h) => h.kind === "roast");
    if (best) left.append(withSticker("small", "x-row-moment", best.kind === "alert" ? "i-buoy" : "i-flame", `“${best.text}”`));
    li.append(left, el("span", "x-score x-stars", app.history.starsOf(c) ? app.history.starText(app.history.starsOf(c)) : "–"));
    list.append(li);
  }
  wrap.append(list);

  const clear = el("button", "x-clear", "Clear history");
  clear.addEventListener("click", () => {
    if (!confirm("Delete all your scores, badges and settings from this phone?")) return;
    app.history.clearAll(); app.closeSheet();
  });
  wrap.append(withSticker("p", "x-note", "i-lock", "Saved only on this phone, never uploaded."), clear);
  return wrap;
}

export function initCooks(app, menu) {
  menu.add("#i-trophy", "Your cooks", () => app.openSheet(cooksSheet(app)));

  // New badges: one small pill on the goodbye screen; tapping it opens Your cooks
  app.on("goodbye", () => {
    const slot = document.getElementById("slot-goodbye");
    slot.querySelector(".x-badges-pill")?.remove();
    const fresh = checkNewBadges(app);
    if (!fresh.length) return;
    const pill = withSticker("button", "x-badges-pill", fresh.length === 1 ? fresh[0].icon : "i-medal",
      fresh.length === 1 ? `New badge: ${fresh[0].name}` : `${fresh.length} new badges`, { fill: fresh.length === 1 && fresh[0].icon === "i-star" ? "#ffd166" : undefined });
    pill.addEventListener("click", (e) => { e.stopPropagation(); app.keepGoodbye(); app.openSheet(cooksSheet(app)); });
    slot.prepend(pill);
  });
}
