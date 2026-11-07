// Owner: Matthew (taken over from Felix)
// The phone runs the timers, not the AI. AI can't count time reliably.
// Events in:  timer_start {id, label, seconds, check_at}, timer_cancel {id}
// Events out: timer_check {id, label}, timer_done {id, label}  (passed on to Remy)
//
// Changing a timer ("Remy, make it 8 minutes"): Remy sends timer_start again with
// the SAME id and the new time. We update that timer in place instead of adding a new one.
// The cook can also change it by hand with the −1 / +1 buttons.

export function createTimers(container, emit, beep = () => {}) {
  const timers = new Map();

  function fmt(s) {
    s = Math.max(s, 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function start({ id, label, seconds, check_at, estimate }) {
    id = id || label || `t${Date.now()}`;
    const now = Date.now();
    const old = timers.get(id);
    const t = old || { id, el: makeCard(id) };
    Object.assign(t, {
      label,
      estimate: !!estimate,
      total: seconds * 1000,
      endAt: now + seconds * 1000,
      // check_at = seconds from the start when Remy should check (e.g. taste the pasta)
      checkAt: check_at ? now + check_at * 1000 : null,
      checked: false,
      done: false,
    });
    t.el.querySelector(".label").textContent = label + (t.estimate ? " (estimate)" : "");
    t.el.classList.remove("check", "done");
    if (old) flash(t.el, "updated"); // show the cook the time changed
    else {
      container.appendChild(t.el);
      t.interval = setInterval(() => tick(t), 250);
      timers.set(id, t);
    }
    tick(t);
    return id;
  }

  function makeCard(id) {
    const el = document.createElement("div");
    el.className = "timer";
    el.innerHTML = `
      <div class="label"></div>
      <div class="time"></div>
      <div class="bar"><i></i></div>
      <div class="controls">
        <button class="minus" aria-label="1 minute less">−1</button>
        <button class="plus" aria-label="1 minute more">+1</button>
        <button class="x" aria-label="Cancel timer">✕</button>
      </div>`;
    el.querySelector(".minus").onclick = () => adjust(id, -60);
    el.querySelector(".plus").onclick = () => adjust(id, 60);
    // Cancel needs two taps, so a splash of water or a stray elbow can't kill the pasta timer
    const x = el.querySelector(".x");
    x.onclick = () => {
      if (x.classList.contains("sure")) return cancel({ id });
      x.classList.add("sure");
      x.textContent = "Cancel?";
      setTimeout(() => { x.classList.remove("sure"); x.textContent = "✕"; }, 3000);
    };
    // Once it's finished, tapping anywhere on the card clears it
    el.addEventListener("click", (e) => {
      const t = timers.get(id);
      if (t?.done && !e.target.closest("button")) cancel({ id });
    });
    return el;
  }

  function tick(t) {
    const now = Date.now();
    const left = Math.ceil((t.endAt - now) / 1000);
    t.el.querySelector(".time").textContent = t.done ? "DONE" : (t.estimate ? "~" : "") + fmt(left);
    // progress bar: how much of the time has gone
    const gone = t.total > 0 ? 1 - (t.endAt - now) / t.total : 1;
    t.el.querySelector(".bar i").style.width = `${Math.min(Math.max(gone, 0), 1) * 100}%`;

    if (t.checkAt && !t.checked && now >= t.checkAt && !t.done) {
      t.checked = true;
      t.el.classList.add("check");
      beep("check");
      emit("timer_check", { id: t.id, label: t.label });
    }
    if (!t.done && left <= 0) {
      t.done = true;
      t.el.classList.add("done");
      beep("done");
      emit("timer_done", { id: t.id, label: t.label });
    }
  }

  // Add or take away time (seconds). Moves the "check" moment too if it hasn't happened yet.
  function adjust(id, delta) {
    const t = timers.get(id);
    if (!t) return;
    const now = Date.now();
    if (t.done) { t.endAt = now; t.total = 0; } // finished timer: +1 means "one more minute from now"
    t.endAt = Math.max(t.endAt + delta * 1000, now);
    t.total = Math.max(t.total + delta * 1000, t.endAt - now);
    if (t.checkAt && !t.checked) t.checkAt += delta * 1000;
    if (t.endAt > now) { t.done = false; t.el.classList.remove("done"); }
    flash(t.el, "updated");
    tick(t);
  }

  function flash(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
  }

  function cancel({ id }) {
    const t = timers.get(id);
    if (!t) return;
    clearInterval(t.interval);
    t.el.remove();
    timers.delete(id);
  }

  function clearAll() {
    for (const id of [...timers.keys()]) cancel({ id });
  }

  return { start, cancel, adjust, clearAll };
}
