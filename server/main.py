"""REMY server, the "back office".

Owner: Matthew. Other people: please ask before editing.

What it does:
  * serves the app (the `app/` folder) so the phone opens one link
  * GET  /api/recipes        -> list of recipes
  * GET  /api/recipes/find?q=steak -> find a recipe by what the cook said (Remy's find_recipe)
  * POST /api/recipes/ai     -> safety-check a recipe Remy wrote itself (create_recipe)
  * POST /api/chat           -> backup Remy: Gemini writes his reply when ElevenLabs is down
  * GET  /api/qr?text=       -> QR code (SVG) for one of REMY's own links (judge page)
  * GET  /api/check/credits  -> ElevenLabs characters left (pitch checklist at /check)
  * GET  /api/push/key, POST /api/push/timer -> lock-screen timer alerts (server/push.py)
  * GET  /api/recipes/{id}   -> one full recipe
  * POST /api/brain          -> Remy's instructions + actions for ANY voice route
  * POST /api/session        -> a short-lived pass for the live OpenAI call,
                                with Remy's instructions already built in
  * POST /api/vision/look    -> Remy's eyes: what's in this camera picture? (Gemini)
  * GET  /api/health         -> quick "is it running and is the key set?" check

Run it (from the repo root):
    pip install -r server/requirements.txt
    uvicorn server.main:app --reload --port 8000
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server.recipe_check import check_ai_recipe
from server.recipe_sources import IMPORT_DIR, find_recipe
from server.knowledge import as_text, knowledge_for, relevant_cook_times, relevant_food_safety, tools_text
from server import vision
from server import chat
from server import push

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "app"
BRAIN_DIR = ROOT / "remy-brain"
RECIPES_DIR = BRAIN_DIR / "recipes"
LESSONS_DIR = BRAIN_DIR / "lessons"   # cooking-school lessons (same shape as recipes, "lesson": true)

load_dotenv(ROOT / "server" / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
# Ahmed: confirm the current realtime model name in OpenAI's docs and set it in .env
REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
REMY_VOICE = os.getenv("REMY_VOICE", "marin")
SESSION_MINUTES = int(os.getenv("SESSION_MINUTES", "10"))

MODES = ("gentle", "honest", "savage", "lesson")

app = FastAPI(title="REMY")


# ---------- helpers ----------

def _read_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def load_recipe(recipe_id: str) -> dict:
    # Our recipes first, then cooking-school lessons, then ones found online earlier (cached in _imported/)
    for folder in (RECIPES_DIR, LESSONS_DIR, IMPORT_DIR):
        path = folder / f"{recipe_id}.json"
        # Only allow plain file names, so nobody can ask for ../../secret
        if path.parent == folder and path.exists():
            return _read_json(path)
    raise HTTPException(404, f"No recipe called '{recipe_id}'")


NO_RECIPE_YET = """# TODAY'S RECIPE
Not chosen yet. The cook just pressed Start cooking. After your greeting and camera
check, ask what they'd like to cook (they can also tell you what ingredients they have).
Vague food ("eggs", "chicken", "potatoes")? Ask how they'd like it first (e.g. scrambled, fried,
boiled or poached), then call find_recipe with the answer.
1. Call find_recipe with their words. If it returns one of OUR recipes (found: true),
   briefly confirm it, name the ingredients, and guide from step 1.
2. Otherwise (or if they want changes, e.g. spicier, vegetarian, for 6 people, only
   what's in their fridge): write the recipe yourself and call create_recipe. Give every
   step looks_right / looks_wrong / done_when, and timers only where something is timed.
   If find_recipe gave a "reference" recipe, you may adapt it.
3. create_recipe returns the checked recipe: use ITS timers (they may have been
   corrected), mention any estimates, and give the attached safe temperatures.
The exact cooking times and safe temperatures for the dish come back in "knowledge" with
find_recipe / create_recipe: use those."""


def lesson_rule(recipe: dict) -> str:
    """Cooking school: coach a technique and score it, instead of cooking a meal."""
    score_on = ", ".join(str(s) for s in (recipe.get("score_on") or [])[:6]) or "the technique"
    return ("# LESSON MODE\nThis is a short technique lesson, not a meal. Use one calm coaching voice, "
            "without Gentle, Honest or Savage attitudes, heckles, or roasts. Coach one tip at a time and judge: "
            f"{score_on}. When the last step is done, call lesson_score once with 1 to 5 stars and one short "
            "specific coaching comment. Say the stars out of five, never out of ten. Never roast while a knife is in use; "
            "a blade beside tucked knuckles is normal, and safety alerts come first for clear danger.")


SWAP_RULE = """# MISSING AN INGREDIENT
Suggest one sensible swap. If it changes the recipe, call create_recipe with the adapted recipe
(same steps and timers where they still apply) so the screen shows it."""

PASTA_RULE = """# PASTA
Any dish with pasta: find out the shape before the pasta timer. First check the camera notes for a
[PASTA PACKET SEEN]; if there is one, offer your guess ("Looks like penne, 11 minutes on the packet,
right?"). If you can't see a packet, ask them to show it or tell you the pasta. The packet time wins."""

NAME_RULE = """# YOUR NAME
When the cook only says "Remy" or "Hey Remy", reply exactly "Yes, chef?" and wait.
If they include a request after your name, answer the request directly. Never answer your
own voice or fill the silence with another line. Only an urgent safety alert comes first."""


PEOPLE_ONLY = ("_owner", "_sources", "_checked")   # notes for the team, not instructions for Remy


def for_remy(data) -> str:
    """A knowledge table as compact JSON without the team-only notes (fewer voice tokens per reply)."""
    def clean(node):
        if isinstance(node, dict):
            return {k: clean(v) for k, v in node.items() if k not in PEOPLE_ONLY}
        if isinstance(node, list):
            return [clean(v) for v in node]
        return node
    return json.dumps(clean(data), ensure_ascii=False, separators=(",", ":"))


SAVAGE_ONLY = ("nicknames", "camera_reminders", "ignoring_remy", "comebacks", "savage_insult_bank")


def roasts_for_mode(data: dict, mode: str) -> dict:
    """Only the selected attitude's lines (keeps Remy's instructions short: the voice service has
    to carry all of it). Savage-only sections are dropped for Gentle and Honest."""
    def pick(node):
        if isinstance(node, dict):
            if set(node) & {"gentle", "honest", "savage"}:
                return {k: pick(v) for k, v in node.items() if k == mode or k not in ("gentle", "honest", "savage")}
            return {k: pick(v) for k, v in node.items()}
        return node
    out = pick(data)
    if mode != "savage":
        for key in SAVAGE_ONLY:
            out.pop(key, None)
    return out


def profile_line(profile: dict | None) -> str:
    """One short line about the cook's diet/allergies (only when they set some in ⚙️ Settings)."""
    if not isinstance(profile, dict):
        return ""
    diet = [str(d)[:20] for d in (profile.get("diet") or [])][:4]
    allergies = [str(a)[:20] for a in (profile.get("allergies") or [])][:8]
    if not diet and not allergies:
        return ""
    bits = ([f"Diet: {', '.join(diet)}."] if diet else []) + ([f"Allergies: {', '.join(allergies)}."] if allergies else [])
    return ("# ABOUT THE COOK\n" + " ".join(bits) + " Steer away from those ingredients and suggest swaps. "
            "You can't detect allergens: when one might be involved, tell them to check every label.")


def build_instructions(recipe: dict | None, mode: str, lite: bool = False, profile: dict | None = None) -> str:
    """Glue Pranav's personality files + Matthew's recipe/knowledge into one prompt."""
    core = _read_text(BRAIN_DIR / "instructions.md")
    is_lesson = bool(recipe and recipe.get("lesson"))
    personality = ("Calm, clear technique coaching. Praise progress specifically." if is_lesson
                   else _read_text(BRAIN_DIR / "personality" / f"{mode}.md"))
    roasts = BRAIN_DIR / "personality" / "roasts.json"
    roast_text = for_remy(roasts_for_mode(_read_json(roasts), mode)) if roasts.exists() and not is_lesson else "{}"
    # only what matters for this dish (plus the essential safety rules): server/knowledge.py
    cook_times = as_text(relevant_cook_times(recipe))
    safety = as_text(relevant_food_safety(recipe))

    return "\n\n".join([
        core,
        f"# {'LESSON COACH' if is_lesson else 'PERSONALITY MODE: ' + mode.upper()}\n{personality}",
        NAME_RULE,
        PASTA_RULE,
        *([lesson_rule(recipe)] if recipe and recipe.get("lesson") else []),
        SWAP_RULE,
        *([profile_line(profile)] if profile_line(profile) else []),
        *([] if lite or is_lesson else ["# ROAST & CATCHPHRASE LIBRARY (riff on these, don't just repeat them)\n" + roast_text]),
        ("# TODAY'S RECIPE\n" + json.dumps(recipe, ensure_ascii=False)) if recipe else NO_RECIPE_YET,
        "# COOKING TIMES (use these for start_timer, never guess)\n" + cook_times,
        "# FOOD SAFETY (fixed facts, never contradict these)\n" + safety,
    ])


def load_tools() -> list:
    return _read_json(BRAIN_DIR / "actions.json")["tools"]


def tools_for(recipe: dict | None) -> list:
    tools = load_tools()
    return [tool for tool in tools if tool["name"] != "roast"] if recipe and recipe.get("lesson") else tools


# ---------- API ----------

@app.get("/api/health")
def health():
    return {
        "ok": True,
        "openai_key_set": bool(OPENAI_API_KEY),
        "model": REALTIME_MODEL,
        # just yes/no, never the values
        "elevenlabs_key_set": bool(os.getenv("ELEVENLABS_API_KEY", "").strip()),
        "elevenlabs_agent_set": bool(os.getenv("ELEVENLABS_AGENT_ID", "").strip()),
        **vision.key_status(),
    }


@app.get("/api/recipes")
def list_recipes():
    out = []
    for path in sorted(RECIPES_DIR.glob("*.json")):
        r = _read_json(path)
        out.append({
            "id": r["id"],
            "title": r["title"],
            "summary": r.get("summary", ""),
            "checked_by_human": r.get("checked_by_human", False),
            "steps": len(r.get("steps", [])),
            "ingredients": r.get("ingredients", []),   # so the browser can flag diet/allergy clashes
            "special": bool(r.get("special")),         # Remy's special: pinned to the top
        })
    return sorted(out, key=lambda r: not r["special"])


@app.get("/api/recipes/find")
def find(q: str):
    """Find a recipe from what the cook said, e.g. ?q=I want to make steak.
    Remy's find_recipe action calls this. See server/recipe_sources.py for the order."""
    if not q.strip():
        raise HTTPException(400, "Say what you'd like to cook")
    result = find_recipe(q[:200])
    dish = result.get("recipe") or result.get("reference")
    if dish:   # this dish's cooking times + safety, since Remy's instructions only had the essentials
        result["knowledge"] = knowledge_for(dish)
    return result


class AIRecipe(BaseModel):
    recipe: dict


@app.post("/api/recipes/ai")
def ai_recipe(req: AIRecipe):
    """Safety-check a recipe Remy wrote (create_recipe): fixes timers from cook-times.json,
    marks the rest as estimates, attaches safe temperatures. See server/recipe_check.py."""
    result = check_ai_recipe(req.recipe)
    if isinstance(result, dict) and isinstance(result.get("recipe"), dict):
        result["knowledge"] = knowledge_for(result["recipe"])
    return result


@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: str):
    return load_recipe(recipe_id)


class SessionRequest(BaseModel):
    recipe_id: str | None = None   # None = Remy asks the cook what to make
    mode: str = "honest"
    lite: bool = False             # ?lite=1 on the page: no roast library (connection test)
    profile: dict | None = None    # {diet: [...], allergies: [...]} from ⚙️ Settings


@app.post("/api/brain")
def get_brain(req: SessionRequest):
    """Remy's full instructions + actions for ANY voice route (no AI key needed).

    /api/session is the OpenAI-specific shortcut. Other routes (phone voice + a cheap
    vision model, Gemini Live, …) call this and pass the result to their own AI.
    """
    if req.mode not in MODES:
        raise HTTPException(400, f"mode must be one of {MODES}")
    recipe = load_recipe(req.recipe_id) if req.recipe_id else None
    if req.mode == "lesson" and not (recipe and recipe.get("lesson")):
        raise HTTPException(400, "lesson mode requires a lesson recipe")
    tools = tools_for(recipe)
    return {
        "instructions": build_instructions(recipe, req.mode, req.lite, req.profile),
        "tools": tools,   # full schemas: the app checks every call against these
        "tools_text": tools_text(tools, recipe),   # compact list the voice reads (saves ElevenLabs tokens)
        "recipe": recipe,
        "mode": req.mode,
        "max_minutes": SESSION_MINUTES,
    }


@app.post("/api/session")
async def create_session(req: SessionRequest):
    if req.mode not in MODES:
        raise HTTPException(400, f"mode must be one of {MODES}")
    recipe = load_recipe(req.recipe_id) if req.recipe_id else None
    if req.mode == "lesson" and not (recipe and recipe.get("lesson")):
        raise HTTPException(400, "lesson mode requires a lesson recipe")
    instructions = build_instructions(recipe, req.mode)

    if not OPENAI_API_KEY:
        raise HTTPException(
            503,
            "OpenAI key missing. Add OPENAI_API_KEY to server/.env "
            "(see docs/SETUP.md). The app still works with pretend Remy.",
        )

    # Ask OpenAI for a short-lived pass ("ephemeral key") for the phone.
    # Ahmed: double-check this request shape against OpenAI's current Realtime docs.
    body = {
        "expires_after": {"anchor": "created_at", "seconds": 600},
        "session": {
            "type": "realtime",
            "model": REALTIME_MODEL,
            "instructions": instructions,
            "tools": tools_for(recipe),
            "audio": {"output": {"voice": REMY_VOICE}},
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json=body,
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"OpenAI refused the session: {r.text[:500]}")
    data = r.json()
    return {
        "client_secret": data.get("value"),
        "expires_at": data.get("expires_at"),
        "model": REALTIME_MODEL,
        "max_minutes": SESSION_MINUTES,
        "recipe": recipe,
        "mode": req.mode,
    }


# ---------- Remy's eyes ----------

class LookRequest(BaseModel):
    image: str                       # JPEG/PNG/WebP, base64 or a data: URL
    step: dict | None = None         # current recipe step (instruction, looks_right, ...)
    question: str = ""               # optional, e.g. "is that smoke or steam?"


@app.post("/api/vision/look")
def vision_look(req: LookRequest, request: Request):
    """What's happening in the pan? See server/vision.py for the reply shape."""
    caller = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0]
    try:
        return vision.look(req.image, req.step, req.question, caller=caller.strip())
    except vision.VisionError as e:
        raise HTTPException(e.status, str(e)) from None


class ChatRequest(BaseModel):
    mode: str = "honest"
    recipe_id: str | None = None
    recipe: dict | None = None      # a recipe Remy wrote himself (not saved on the server)
    history: list = []
    note: str = ""
    profile: dict | None = None


@app.post("/api/chat")
def chat_reply(req: ChatRequest, request: Request):
    """Backup Remy (no ElevenLabs): Gemini writes his reply + actions. See server/chat.py."""
    if req.mode not in MODES:
        raise HTTPException(400, f"mode must be one of {MODES}")
    recipe = req.recipe if isinstance(req.recipe, dict) else (load_recipe(req.recipe_id) if req.recipe_id else None)
    if req.mode == "lesson" and not (recipe and recipe.get("lesson")):
        raise HTTPException(400, "lesson mode requires a lesson recipe")
    caller = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0]
    try:
        return chat.reply(build_instructions(recipe, req.mode, lite=True, profile=req.profile), tools_for(recipe), req.history, req.note,
                          caller=caller.strip())
    except chat.ChatError as e:
        raise HTTPException(e.status, e.message) from None


@app.get("/api/vision/models")
def vision_models():
    """Which Gemini models this key can use, in the order we'd try them (names only)."""
    if not vision.api_key():
        raise HTTPException(503, "Vision key missing.")
    try:
        with vision.httpx.Client(timeout=10) as client:
            return {"try_order": vision.candidates(client), "current": vision.key_status()["vision_model"]}
    except (vision.httpx.HTTPError, vision.VisionError) as e:
        raise HTTPException(502, f"Couldn't list Gemini models: {e}") from None


@app.get("/api/lessons")
def list_lessons():
    """Cooking-school lessons (remy-brain/lessons/*.json): title, summary, what Remy scores."""
    out = []
    for path in sorted(LESSONS_DIR.glob("*.json")):
        r = _read_json(path)
        out.append({"id": r["id"], "title": r["title"], "summary": r.get("summary", ""),
                    "steps": len(r.get("steps", [])), "score_on": r.get("score_on", [])})
    return out


class PushTimer(BaseModel):
    subscription: dict
    id: str
    label: str = ""
    fire_at: float | None = None     # when the timer ends, ms since 1970
    cancel: bool = False


@app.get("/api/push/key")
def push_key():
    """Public key for lock-screen timer alerts (empty + enabled:false until set up on Render)."""
    return {"enabled": push.enabled(), "key": push.public_key()}


@app.get("/api/push/recent")
def push_recent():
    """Last few alerts the server sent: how late each left the server (no phone details)."""
    return {"recent": push.sent_log[-10:], "waiting": len(push._timers)}


@app.post("/api/push/timer")
def push_timer(req: PushTimer):
    """Schedule, move or cancel a lock-screen alert for one timer (server/push.py)."""
    try:
        return push.schedule(req.subscription, req.id, req.label, req.fire_at, req.cancel)
    except push.PushError as e:
        raise HTTPException(e.status, e.message) from None


@app.get("/api/allergens")
def allergens():
    """Diet/allergy keyword lists for the screen's ⚠ highlighting (remy-brain/knowledge/allergens.json)."""
    return _read_json(BRAIN_DIR / "knowledge" / "allergens.json")


@app.get("/api/qr")
def qr_code(text: str):
    """A QR code (SVG) for a link, e.g. the judge page's 'scan to try REMY'. Only our own site's links."""
    if len(text) > 300 or not text.startswith(("https://remy-2wc2.onrender.com", "http://localhost", "http://127.0.0.1")):
        raise HTTPException(400, "QR codes are only made for REMY's own links.")
    import io
    import qrcode
    import qrcode.image.svg
    buf = io.BytesIO()
    qrcode.make(text, image_factory=qrcode.image.svg.SvgPathFillImage, border=2).save(buf)
    from fastapi.responses import Response
    return Response(buf.getvalue(), media_type="image/svg+xml")


# ---------- the app itself ----------

@app.get("/")
def index():
    return FileResponse(APP_DIR / "index.html")


@app.get("/check")
def check_page():
    """Pitch checklist (app/extras/check.html): not linked anywhere, open /check before going on stage."""
    return FileResponse(APP_DIR / "extras" / "check.html")


@app.get("/api/check/credits")
def check_credits():
    """ElevenLabs characters left on the account whose API key is on the server (numbers only, never the key)."""
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        return {"ok": False, "reason": "No ElevenLabs API key on the server, so credits can't be read here."}
    try:
        r = httpx.get("https://api.elevenlabs.io/v1/user/subscription", headers={"xi-api-key": key}, timeout=8)
    except httpx.HTTPError:
        return {"ok": False, "reason": "Couldn't reach ElevenLabs."}
    if r.status_code != 200:
        return {"ok": False, "reason": f"ElevenLabs said {r.status_code} (the key may not be allowed to read the subscription)."}
    d = r.json()
    used, limit = int(d.get("character_count") or 0), int(d.get("character_limit") or 0)
    return {"ok": True, "used": used, "limit": limit, "left": max(0, limit - used), "tier": d.get("tier"),
            "resets_at": d.get("next_character_count_reset_unix")}


@app.get("/judge")
def judge_page():
    """Big 'scan to try REMY' QR code for the judging table (app/extras/judge.html)."""
    return FileResponse(APP_DIR / "extras" / "judge.html")


@app.middleware("http")
async def always_fresh_app(request: Request, call_next):
    """Phones (Safari especially) can keep showing an old copy of the app's files for a long time.
    'no-cache' makes them check for a newer version every time (they still reuse an unchanged file)."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


app.mount("/", StaticFiles(directory=APP_DIR), name="app")
