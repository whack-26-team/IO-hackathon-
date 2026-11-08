// Watch my pan (#118): step away and the phone calls you back. While it's on, a safety alert,
import { sticker } from "./sticker.js";
// a warning tip or a finished timer starts a loud repeating alarm and a flashing screen until
// you tap it.
import { beep } from "../sound.js";

export function initWatchMyPan(app) {
  let on = false, alarm = null, overlay = null;

  const btn = document.createElement("button");
  btn.className = "x-tool"; btn.replaceChildren(sticker("i-eyes")); btn.title = "Watch my pan"; btn.setAttribute("aria-label", "Watch my pan");
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => {
    on = !on;
    btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", String(on));
    btn.replaceChildren(sticker("i-eyes"), ...(on ? [document.createTextNode("Watching")] : []));
    if (on) app.say("Go on then. I'll shout if anything happens.");
    else stopAlarm();
  });
  document.getElementById("slot-cook-tools")?.append(btn);

  function startAlarm(reason) {
    if (!on || alarm) return;
    overlay = document.createElement("button");
    overlay.className = "x-alarm";
    overlay.innerHTML = `<b>Remy needs you!</b><span></span><small>Tap when you're back</small>`;
    overlay.querySelector("span").textContent = reason;
    overlay.addEventListener("click", stopAlarm);
    document.body.append(overlay);
    beep("alert");
    alarm = setInterval(() => beep("alert"), 2500);
    if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
  }
  function stopAlarm() {
    clearInterval(alarm); alarm = null;
    overlay?.remove(); overlay = null;
  }

  app.on("alert", (d) => startAlarm(d?.text || "Safety alert"));
  app.on("tip", (d) => { if (d?.severity === "warning" || d?.severity === "urgent") startAlarm(d.text); });
  app.on("timer_done", (d) => startAlarm(`${d?.label || "Timer"} is done`));
  app.on("stop", () => { on = false; btn.classList.remove("on"); btn.replaceChildren(sticker("i-eyes")); stopAlarm(); });
}
