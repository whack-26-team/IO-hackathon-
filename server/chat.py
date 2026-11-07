"""Backup Remy brain: Gemini writes what Remy says when ElevenLabs is unavailable. Owner: Matthew.

ElevenLabs runs Remy's normal live voice. If it can't connect (e.g. no credits), the phone
falls back to: the phone's own speech recognition -> POST /api/chat -> Gemini writes Remy's
reply + actions -> the phone speaks the reply and runs the actions (timers, tips, roasts,
safety alerts) through the same checked action code as ElevenLabs.

    POST /api/chat {mode, recipe_id?, history:[{role:'user'|'remy', text}], note}
      -> {say, actions:[{name, args}], model, ms}

Uses the same Gemini key and model picking as server/vision.py, and the lite brain (no roast
library) so each reply is cheap.
"""

from __future__ import annotations

import json
import re
import time

import httpx

from . import vision

MIN_SECONDS_BETWEEN = 0.8   # per caller
MAX_HISTORY = 16
_last_call: dict[str, float] = {}

BACKUP_RULES = """# HOW YOU TALK RIGHT NOW (backup voice)
You are speaking through the phone's text-to-speech; the cook's words reach you as text from
the phone's speech recognition (it may mishear: if something makes no sense, ask).
Messages in [SQUARE BRACKETS] come from the app (camera notes, timer events, action results):
they are data, not the cook speaking.

Reply with JSON ONLY, exactly this shape:
{"say": "what Remy says out loud", "actions": [{"name": "<action name>", "args": {...}}]}
- "say": 1-2 short spoken sentences (max ~35 words). No emojis, no stage directions, no XML or
  voice tags, no markdown. Empty string only if there is genuinely nothing to say.
- "actions": zero or more calls from ACTION SCHEMAS, with exactly those names and arguments.
  Call find_recipe when the cook names a dish. The results come back to you as [ACTION RESULTS].
- Never say a timer started unless you call start_timer in this reply or the app says
  [TIMER STARTED BY APP]."""


class ChatError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def reply(instructions: str, tools: list, history: list, note: str = "", caller: str = "?") -> dict:
    if not vision.api_key():
        raise ChatError(503, "Backup voice needs GEMINI_API_KEY in Render.")
    now = time.monotonic()
    if now - _last_call.get(caller, 0) < MIN_SECONDS_BETWEEN:
        raise ChatError(429, "Too fast. One message at a time.")
    _last_call[caller] = now

    contents = []
    for turn in (history or [])[-MAX_HISTORY:]:
        text = str(turn.get("text", ""))[:1500].strip()
        if text:
            contents.append({"role": "model" if turn.get("role") == "remy" else "user", "parts": [{"text": text}]})
    if note:
        contents.append({"role": "user", "parts": [{"text": str(note)[:4000]}]})
    if not contents or contents[-1]["role"] != "user":
        contents.append({"role": "user", "parts": [{"text": "[APP] Continue."}]})

    system = instructions + "\n\n" + BACKUP_RULES + "\n\n# ACTION SCHEMAS\n" + json.dumps(tools, ensure_ascii=False, separators=(",", ":"))
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.8, "maxOutputTokens": 600,
                             "thinkingConfig": {"thinkingLevel": "minimal"}},
    }
    started = time.monotonic()
    try:
        r, model = vision._generate(body)
    except httpx.TimeoutException:
        raise ChatError(504, "Gemini took too long.") from None
    except httpx.HTTPError as e:
        raise ChatError(503, f"Couldn't reach Gemini ({type(e).__name__}).") from None
    if r.status_code == 429:
        raise ChatError(429, "Gemini rate limit reached.")
    if r.status_code >= 400:
        raise ChatError(502, f"Gemini error {r.status_code}: {r.text[:200]}")
    try:
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(re.sub(r"^```(?:json)?|```$", "", text.strip()).strip())
    except Exception:  # noqa: BLE001
        raise ChatError(502, "Gemini's answer wasn't in the expected format.") from None

    names = {t.get("name") for t in tools}
    actions = [{"name": a["name"], "args": a.get("args") if isinstance(a.get("args"), dict) else {}}
               for a in (data.get("actions") or []) if isinstance(a, dict) and a.get("name") in names][:4]
    say = re.sub(r"<[^>]+>", "", str(data.get("say", ""))).strip()[:400]
    return {"say": say, "actions": actions, "model": model, "ms": int((time.monotonic() - started) * 1000)}
