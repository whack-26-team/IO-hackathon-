// Owner: Felix
// The phone runs the timers, not the AI. AI can't count time reliably.
// Events in:  timer_start {id, label, seconds, check_at}, timer_cancel {id}
// Events out: timer_check {id, label}, timer_done {id, label}  (passed on to Remy)

export function createTimers(container, emit) {
  const timers = new Map();

  function fmt(s) {
    const m = Math.floor(Math.max(s, 0) / 60);
    const sec = Math.max(s, 0) % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function start({ id, label, seconds, check_at }) {
    id = id || `t${Date.now()}`;
    cancel({ id });
    const el = document.createElement("div");
    el.className = "timer";
    el.innerHTML = `<div class="label"></div><div class="time"></div><button class="x">cancel</button>`;
    el.querySelector(".label").textContent = label;
    el.querySelector(".x").onclick = () => cancel({ id });
    container.appendChild(el);

    const endAt = Date.now() + seconds * 1000;
    // check_at = seconds from the start when Remy should check (e.g. taste the pasta)
    const checkAt = check_at ? Date.now() + check_at * 1000 : null;
    const t = { id, label, el, endAt, checkAt, checked: false, done: false };
    t.interval = setInterval(() => tick(t), 250);
    timers.set(id, t);
    tick(t);
    return id;
  }

  function tick(t) {
    const left = Math.round((t.endAt - Date.now()) / 1000);
    t.el.querySelector(".time").textContent = t.done ? "DONE" : fmt(left);
    if (t.checkAt && !t.checked && Date.now() >= t.checkAt) {
      t.checked = true;
      t.el.classList.add("check");
      emit("timer_check", { id: t.id, label: t.label });
    }
    if (!t.done && left <= 0) {
      t.done = true;
      t.el.classList.add("done");
      emit("timer_done", { id: t.id, label: t.label });
    }
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

  return { start, cancel, clearAll };
}
