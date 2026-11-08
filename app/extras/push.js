// Lock-screen timer alerts (#9): a toggle in ⚙️ Settings. When on, every timer's end time is sent to
// the server, which pushes "⏱ Rigatoni is done" even with the phone locked. iPhone: only from the
// home-screen app (iOS 16.4+), after allowing notifications.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function b64ToBytes(b64) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function initPush(app) {
  const state = () => app.history.get("push", { on: false, subscription: null });
  const ends = new Map();   // timer id -> {label, end_at}

  async function send(body) {
    const { on, subscription } = state();
    if (!on || !subscription) return;
    try { await fetch("/api/push/timer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription, ...body }) }); }
    catch { /* offline: the on-screen timer still works */ }
  }
  app.on("timer_changed", (d) => { ends.set(d.id, d); if (d.end_at > Date.now()) send({ id: d.id, label: d.label, fire_at: d.end_at }); });
  app.on("timer_removed", (d) => { ends.delete(d.id); send({ id: d.id, cancel: true }); });
  app.on("stop", () => { for (const id of ends.keys()) send({ id, cancel: true }); ends.clear(); });
}

// The row shown in ⚙️ Settings
export function pushToggle(app) {
  const row = document.createElement("div"); row.className = "x-push";
  const btn = document.createElement("button"); btn.className = "x-toggle";
  const note = document.createElement("small"); note.className = "x-note";
  row.append(btn, note);
  const render = (msg) => {
    const on = app.history.get("push", {}).on;
    btn.textContent = on ? "🔔 Lock-screen timer alerts: on" : "🔕 Lock-screen timer alerts: off";
    btn.classList.toggle("on", !!on);
    note.textContent = msg || (on ? "You'll get \u201c⏱ … is done\u201d even with the phone locked." : "Get a notification when a timer ends, even with the phone locked.");
  };
  if (!pushSupported() || (isIOS && !standalone)) {
    btn.disabled = true; render(isIOS ? "On iPhone: add REMY to your Home Screen (Share → Add to Home Screen), open it from there, then turn this on." : "This browser can't show lock-screen alerts.");
    return row;
  }
  render();
  btn.addEventListener("click", async () => {
    const s = app.history.get("push", {});
    if (s.on) { app.history.set("push", { on: false, subscription: s.subscription }); return render(); }
    try {
      const k = await (await fetch("/api/push/key")).json();
      if (!k.enabled) return render("Not set up on the server yet (it needs its alert keys).");
      if ((await Notification.requestPermission()) !== "granted") return render("Notifications are blocked. Allow them in Settings → Notifications → REMY.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) });
      app.history.set("push", { on: true, subscription: sub.toJSON() });
      render();
    } catch (e) { render(`Couldn't turn on alerts (${String(e.message || e).slice(0, 60)}).`); }
  });
  return row;
}
