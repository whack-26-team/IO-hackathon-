// First-time setup card (#14 / #83): shown once, the first time REMY opens on this phone, and
// again from the ❓ corner button. No tokens: it's just a card.
const STEPS = [
  ["📱", "Prop your phone up", "Lean it against something so the camera sees your hob or chopping board."],
  ["💡", "Good light", "Remy judges by what he sees. A bright kitchen means better advice."],
  ["🔊", "Volume up", "Silent switch off, so you can hear Remy (and the timers)."],
  ["🗣", "Just talk", "Untick 🧪 Pretend Remy, tap Start, then say \"Remy, I'm making…\"."],
];

// app.js calls this before the extras start; the real work is in initSetupCard below.
export function initSetupGuide() {}

function card(app) {
  const wrap = document.createElement("div");
  wrap.className = "x-sheet x-setup";
  const h = document.createElement("h2"); h.className = "x-title"; h.textContent = "Before you cook";
  wrap.append(h);
  for (const [icon, title, text] of STEPS) {
    const row = document.createElement("div"); row.className = "x-setup-row";
    const i = document.createElement("span"); i.className = "x-setup-icon"; i.textContent = icon;
    const t = document.createElement("div");
    const b = document.createElement("b"); b.textContent = title;
    const s = document.createElement("small"); s.textContent = text;
    t.append(b, s); row.append(i, t); wrap.append(row);
  }
  const ok = document.createElement("button"); ok.className = "x-surprise"; ok.textContent = "Got it, chef";
  ok.addEventListener("click", () => app.closeSheet());
  wrap.append(ok);
  return wrap;
}

// Opens from ⚙️ Settings ("How to set up your phone"); shows itself the first time only.
export function initSetupCard(app) {
  if (!app.history.get("setupSeen", false)) {
    app.history.set("setupSeen", true);
    setTimeout(() => { if (!app.cooking) app.openSheet(card(app)); }, 400);
  }
}

export const openSetupCard = (app) => app.openSheet(card(app));
