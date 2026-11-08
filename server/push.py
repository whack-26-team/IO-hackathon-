"""Lock-screen timer alerts (Web Push). Owner: Matthew.

When a timer starts on the phone, the app sends its end time here. When it's due, the server sends a
push notification, so "⏱ Rigatoni is done" shows even with the phone locked (iPhone: only from the
home-screen app, iOS 16.4+, after the cook allows notifications).

Keys: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in Render (never in the repo). Without them the feature
just reports "not set up". Timers live in memory: a redeploy forgets them, and the free Render server
may be asleep for very long timers with the phone locked (it sleeps after ~15 min without traffic).
"""

from __future__ import annotations

import json
import os
import threading
import time

MAX_AHEAD_S = 4 * 3600          # don't accept timers more than 4 hours away
MAX_PER_PHONE = 20

_timers: dict[tuple[str, str], dict] = {}   # (subscription endpoint, timer id) -> {sub, label, fire_at}
_lock = threading.Lock()
_thread: threading.Thread | None = None
sent_log: list[dict] = []                  # last few sends (for tests / debugging)


class PushError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def public_key() -> str:
    return os.getenv("VAPID_PUBLIC_KEY", "").strip()


def enabled() -> bool:
    return bool(public_key() and os.getenv("VAPID_PRIVATE_KEY", "").strip())


def _valid_sub(sub) -> bool:
    return (isinstance(sub, dict) and str(sub.get("endpoint", "")).startswith("https://")
            and len(str(sub.get("endpoint"))) < 1000 and isinstance(sub.get("keys"), dict)
            and sub["keys"].get("p256dh") and sub["keys"].get("auth"))


def schedule(sub: dict, timer_id: str, label: str = "", fire_at_ms: float | None = None, cancel: bool = False) -> dict:
    """Add, move or cancel one timer alert. fire_at_ms = when the timer ends (ms since 1970)."""
    if not enabled():
        raise PushError(503, "Lock-screen alerts aren't set up yet (VAPID keys missing on the server).")
    if not _valid_sub(sub):
        raise PushError(400, "Not a valid push subscription.")
    timer_id = str(timer_id or "")[:60]
    if not timer_id:
        raise PushError(400, "Missing timer id.")
    key = (sub["endpoint"], timer_id)
    with _lock:
        if cancel:
            _timers.pop(key, None)
            return {"ok": True, "cancelled": True}
        fire_at = float(fire_at_ms or 0) / 1000
        now = time.time()
        if not (now - 5 <= fire_at <= now + MAX_AHEAD_S):
            raise PushError(400, "Timer end time must be within the next 4 hours.")
        if key not in _timers and sum(1 for k in _timers if k[0] == sub["endpoint"]) >= MAX_PER_PHONE:
            raise PushError(429, "Too many timers for this phone.")
        _timers[key] = {"sub": sub, "label": str(label or "Timer")[:40], "fire_at": fire_at}
    _ensure_thread()
    return {"ok": True, "fire_at_ms": int(fire_at * 1000)}


def _send(sub: dict, label: str, timer_id: str) -> None:
    from pywebpush import WebPushException, webpush   # imported here so the app runs without it
    payload = {"title": f"⏱ {label} is done", "body": "Back to the hob, chef. Remy's waiting.", "tag": f"timer-{timer_id}"}
    try:
        webpush(subscription_info=sub, data=json.dumps(payload),
                vapid_private_key=os.getenv("VAPID_PRIVATE_KEY", "").strip(),
                vapid_claims={"sub": os.getenv("VAPID_SUBJECT", "https://remy-2wc2.onrender.com")}, ttl=600)
        sent_log.append({"label": label, "ok": True})
    except WebPushException as e:   # expired subscription, phone offline...: nothing else to do
        sent_log.append({"label": label, "ok": False, "error": str(e)[:120]})
    del sent_log[:-20]


def due_now(now: float | None = None) -> list[tuple[dict, str, str]]:
    """Take the timers that have ended off the list: [(sub, label, id)]."""
    now = time.time() if now is None else now
    with _lock:
        due = [(k, v) for k, v in _timers.items() if v["fire_at"] <= now]
        for k, _ in due:
            _timers.pop(k, None)
    return [(v["sub"], v["label"], k[1]) for k, v in due]


def _loop() -> None:
    while True:
        for sub, label, timer_id in due_now():
            _send(sub, label, timer_id)
        time.sleep(1)


def _ensure_thread() -> None:
    global _thread
    if _thread is None or not _thread.is_alive():
        _thread = threading.Thread(target=_loop, name="remy-push", daemon=True)
        _thread.start()
