"""Remy's eyes: look at a camera picture and say what's happening in the pan. Owner: Matthew.

The voice (ElevenLabs) can only hear, so the phone sends a picture here every few
seconds. We ask Google's Gemini vision model what it sees, judged against the current
recipe step, and return short structured notes. Ahmed's voice connection feeds them to
Remy as context ("pan is smoking", "garlic turning brown"), and Remy decides what to say.

    POST /api/vision/look   { image: <JPEG, base64 or data: URL>, step?: {...}, question? }

Key: GEMINI_API_KEY in Render (REMY_API_KEY also accepted). Model: GEMINI_MODEL, or the
default below. If that model doesn't exist on the account, the first available
"flash" model is picked automatically.
"""

from __future__ import annotations

import base64
import json
import os
import re
import time

import httpx

API = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-3.8-flash"   # Google retired 2.5-flash for new accounts (Nov 2026)
MAX_IMAGE_BYTES = 1_500_000      # ~1.5 MB JPEG is plenty; phones should send ~512–1024px
MIN_SECONDS_BETWEEN = 1.0        # per caller, so one phone can't drain the free quota

_model_cache: dict[str, str] = {}
_refused: set[str] = set()       # models that answered 404 "not available" on this account
_last_call: dict[str, float] = {}

PROMPT = """You are the eyes of REMY, a live cooking assistant. Look at this photo from the
cook's phone camera. Report ONLY what is actually visible. Never guess at taste, smell,
or the inside of food, and never say food is "safe" to eat.

Current recipe step (may be empty): {step}
Extra question from Remy (may be empty): {question}

Reply with JSON only, in exactly this shape:
{{
  "summary": "one short sentence: what's happening in the frame",
  "can_see_cooking": true/false,         // is a pan, pot, board or food actually visible?
  "camera_tip": "" or "how to move the phone so the cooking is visible",
  "observations": ["short visible facts, e.g. 'garlic edges turning brown'"],
  "issues": [{{"type": "burning|overcooking|undercooking|boiling_over|smoke|too_hot|too_cold|messy|wrong_order|other",
               "detail": "what you see", "confidence": 0.0-1.0}}],
  "safety": "" or "IMMEDIATE danger you can see: fire, heavy smoke from oil, knife near fingers, child near the hob, raw meat touching ready-to-eat food",
  "step_done": true/false/null,          // does the photo show this step's done_when? null if unsure
  "answer": "" or "answer to Remy's question, based only on the photo"
}}
Use confidence below 0.6 when unsure (shadows, steam vs smoke, blur). Empty lists are fine."""


def api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or os.getenv("REMY_API_KEY") or "").strip()


def key_status() -> dict:
    name = "GEMINI_API_KEY" if os.getenv("GEMINI_API_KEY", "").strip() else (
        "REMY_API_KEY" if os.getenv("REMY_API_KEY", "").strip() else None)
    return {"vision_key_set": bool(name), "vision_key_name": name,
            "vision_model": _model_cache.get("model") or os.getenv("GEMINI_MODEL") or DEFAULT_MODEL}


class VisionError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _decode_image(image: str) -> tuple[str, str]:
    m = re.match(r"^data:(image/[a-z+]+);base64,(.*)$", image.strip(), re.S)
    mime, b64 = (m.group(1), m.group(2)) if m else ("image/jpeg", image.strip())
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        raise VisionError(400, "Send a JPEG, PNG or WebP picture.")
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:  # noqa: BLE001
        raise VisionError(400, "The picture isn't valid base64.") from None
    if not raw:
        raise VisionError(400, "The picture is empty.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise VisionError(413, f"Picture too big ({len(raw)//1000} KB). Send ~512–1024px JPEGs.")
    return mime, base64.b64encode(raw).decode()


def list_models(client: httpx.Client) -> list[str]:
    r = client.get(f"{API}/models", headers={"x-goog-api-key": api_key()}, params={"pageSize": 200})
    r.raise_for_status()
    return [m["name"].removeprefix("models/") for m in r.json().get("models", [])
            if "generateContent" in m.get("supportedGenerationMethods", [])]


def _pick_model(client: httpx.Client, suggested: str = "") -> str:
    if "model" in _model_cache:
        return _model_cache["model"]
    wanted = os.getenv("GEMINI_MODEL") or DEFAULT_MODEL
    names = [n for n in list_models(client) if n not in _refused]
    if suggested and suggested in names:
        choice = suggested                      # Google told us which model to use instead
    elif wanted in names:
        choice = wanted
    else:  # e.g. the default was renamed/retired: take the newest-looking flash model
        flash = sorted([n for n in names if "flash" in n and "image" not in n and "tts" not in n
                        and "live" not in n and "audio" not in n], reverse=True)
        if not flash:
            raise VisionError(502, f"No suitable Gemini model available (wanted {wanted}).")
        choice = flash[0]
    _model_cache["model"] = choice
    return choice


def look(image: str, step: dict | None = None, question: str = "", caller: str = "?") -> dict:
    if not api_key():
        raise VisionError(503, "Vision key missing: add GEMINI_API_KEY in Render → remy → Environment.")
    now = time.monotonic()
    if now - _last_call.get(caller, 0) < MIN_SECONDS_BETWEEN:
        raise VisionError(429, "Too many pictures. Send one every ~2–3 seconds.")
    _last_call[caller] = now

    mime, b64 = _decode_image(image)
    step_text = json.dumps({k: step.get(k) for k in ("instruction", "looks_right", "looks_wrong", "done_when")
                            if step and step.get(k)}, ensure_ascii=False) if step else ""
    body = {
        "contents": [{"parts": [
            {"text": PROMPT.format(step=step_text or "(none yet)", question=(question or "")[:300] or "(none)")},
            {"inline_data": {"mime_type": mime, "data": b64}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2,
                             "maxOutputTokens": 500},
    }
    started = time.monotonic()
    try:
        r, model = _generate(body)
    except httpx.TimeoutException:
        raise VisionError(504, "Gemini took too long. Try the next picture.") from None
    except httpx.HTTPError as e:
        raise VisionError(503, f"Couldn't reach Gemini ({type(e).__name__}). Try again shortly.") from None
    if r.status_code == 429:
        raise VisionError(429, "Gemini free-tier limit reached. Slow down the picture rate.")
    if r.status_code in (500, 503):
        raise VisionError(503, "Gemini is busy right now (Google's side). Try the next picture.")
    if r.status_code >= 400:
        raise VisionError(502, f"Gemini error {r.status_code}: {r.text[:300]}")
    return _parse(r, model, started)


def _generate(body: dict) -> tuple[httpx.Response, str]:
    """POST to Gemini, switching model if one is retired (404) or overloaded (503)."""
    with httpx.Client(timeout=httpx.Timeout(15, connect=5)) as client:
        model = _pick_model(client)
        r = client.post(f"{API}/models/{model}:generateContent",
                        headers={"x-goog-api-key": api_key()}, json=body)
        if r.status_code in (500, 503):  # overloaded: one quick retry, then a different flash model
            time.sleep(0.8)
            r = client.post(f"{API}/models/{model}:generateContent",
                            headers={"x-goog-api-key": api_key()}, json=body)
            if r.status_code in (500, 503):
                alt = _other_flash(client, model)
                if alt:
                    model = alt
                    r = client.post(f"{API}/models/{model}:generateContent",
                                    headers={"x-goog-api-key": api_key()}, json=body)
        for _ in range(3):  # model retired / not available to this account: try another
            if r.status_code != 404:
                break
            _refused.add(model)
            _model_cache.pop("model", None)
            hint = re.search(r"use models/([a-z0-9.\-]+)", r.text)
            model = _pick_model(client, suggested=hint.group(1) if hint else "")
            r = client.post(f"{API}/models/{model}:generateContent",
                            headers={"x-goog-api-key": api_key()}, json=body)
    return r, model


def _other_flash(client: httpx.Client, current: str) -> str | None:
    names = [n for n in list_models(client) if n not in _refused and n != current]
    flash = sorted([n for n in names if "flash" in n and not any(x in n for x in ("image", "tts", "live", "audio"))],
                   reverse=True)
    return flash[0] if flash else None


def _parse(r: httpx.Response, model: str, started: float) -> dict:
    try:
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(re.sub(r"^```(?:json)?|```$", "", text.strip()).strip())
    except Exception:  # noqa: BLE001
        raise VisionError(502, "Gemini's answer wasn't in the expected format.") from None

    # Keep only well-formed, bounded fields (the voice side relies on this shape)
    issues = []
    for i in result.get("issues") or []:
        if isinstance(i, dict) and i.get("detail"):
            try:
                conf = max(0.0, min(1.0, float(i.get("confidence", 0))))
            except (TypeError, ValueError):
                conf = 0.0
            issues.append({"type": str(i.get("type", "other"))[:30], "detail": str(i["detail"])[:200],
                           "confidence": round(conf, 2)})
    return {
        "summary": str(result.get("summary", ""))[:200],
        "can_see_cooking": bool(result.get("can_see_cooking", False)),
        "camera_tip": str(result.get("camera_tip", ""))[:200],
        "observations": [str(o)[:150] for o in (result.get("observations") or [])][:8],
        "issues": issues[:6],
        "safety": str(result.get("safety", ""))[:200],
        "step_done": result.get("step_done") if result.get("step_done") in (True, False) else None,
        "answer": str(result.get("answer", ""))[:300],
        "model": model,
        "ms": int((time.monotonic() - started) * 1000),
        "at": time.time(),
    }
