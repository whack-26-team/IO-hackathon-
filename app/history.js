// Owner: Matthew. Everything REMY remembers, kept ONLY on this phone (localStorage), never uploaded.
// Every read/write is wrapped: private browsing, full storage or blocked site data just means
// nothing is remembered, and the app still works.
const PREFIX = "remy:";

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}

// Past cooks, newest first: { at, dish, mode, score, timers, alerts, roasts, highlights, ...extra }
export function cooks() { return get("cooks", []); }
// Stars (1-5) for a saved cook; older cooks were saved with a score out of 10
export function starsOf(c) { return c?.stars ?? (c?.score ? Math.max(1, Math.min(5, Math.round(c.score / 2))) : 0); }
export const starText = (n) => "★".repeat(n) + "☆".repeat(5 - n);
export function addCook(entry) {
  const list = [{ at: Date.now(), ...entry }, ...cooks()].slice(0, 200);
  set("cooks", list);
  return list;
}

// Settings the cook chose (name, chattiness, diet, allergies...)
export function settings() { return get("settings", {}); }
export function saveSettings(patch) { const next = { ...settings(), ...patch }; set("settings", next); return next; }

// Wipe everything REMY stored on this phone
export function clearAll() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* nothing stored */ }
}
