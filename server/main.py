"""REMY server, the "back office".

Owner: Matthew. Other people: please ask before editing.

What it does:
  * serves the app (the `app/` folder) so the phone opens one link
  * GET  /api/recipes        -> list of recipes
  * GET  /api/recipes/find?q=steak -> find a recipe by what the cook said (Remy's find_recipe)
  * POST /api/recipes/ai     -> safety-check a recipe Remy wrote itself (create_recipe)
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
from server import vision

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "app"
BRAIN_DIR = ROOT / "remy-brain"
RECIPES_DIR = BRAIN_DIR / "recipes"

load_dotenv(ROOT / "server" / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
# Ahmed: confirm the current realtime model name in OpenAI's docs and set it in .env
REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
REMY_VOICE = os.getenv("REMY_VOICE", "marin")
SESSION_MINUTES = int(os.getenv("SESSION_MINUTES", "10"))

MODES = ("gentle", "honest", "savage")

app = FastAPI(title="REMY")


# ---------- helpers ----------

def _read_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def load_recipe(recipe_id: str) -> dict:
    # Our recipes first, then ones found online earlier (cached in _imported/)
    for folder in (RECIPES_DIR, IMPORT_DIR):
        path = folder / f"{recipe_id}.json"
        # Only allow plain file names, so nobody can ask for ../../secret
        if path.parent == folder and path.exists():
            return _read_json(path)
    raise HTTPException(404, f"No recipe called '{recipe_id}'")


NO_RECIPE_YET = """# TODAY'S RECIPE
Not chosen yet. The cook just pressed Start cooking. After your greeting and camera
check, ask what they'd like to cook (they can also tell you what ingredients they have).
1. Call find_recipe with their words. If it returns one of OUR recipes (found: true),
   briefly confirm it, name the ingredients, and guide from step 1.
2. Otherwise (or if they want changes, e.g. spicier, vegetarian, for 6 people, only
   what's in their fridge): write the recipe yourself and call create_recipe. Give every
   step looks_right / looks_wrong / done_when, and timers only where something is timed.
   If find_recipe gave a "reference" recipe, you may adapt it.
3. create_recipe returns the checked recipe: use ITS timers (they may have been
   corrected), mention any estimates, and give the attached safe temperatures."""


NAME_RULE = """# YOUR NAME
The cook calls you Remy. Whenever they say "Remy" (on its own, or to start a sentence), answer
straight away, e.g. "Yes, chef?" or "I'm here.", then help with whatever they ask. Never ignore
your name. Only a safety alert comes first."""


def build_instructions(recipe: dict | None, mode: str) -> str:
    """Glue Pranav's personality files + Matthew's recipe/knowledge into one prompt."""
    core = _read_text(BRAIN_DIR / "instructions.md")
    personality = _read_text(BRAIN_DIR / "personality" / f"{mode}.md")
    roasts = BRAIN_DIR / "personality" / "roasts.json"
    roast_text = json.dumps(_read_json(roasts), ensure_ascii=False) if roasts.exists() else "{}"
    cook_times = json.dumps(_read_json(BRAIN_DIR / "knowledge" / "cook-times.json"), ensure_ascii=False)
    safety = json.dumps(_read_json(BRAIN_DIR / "knowledge" / "food-safety.json"), ensure_ascii=False)

    return "\n\n".join([
        core,
        f"# PERSONALITY MODE: {mode.upper()}\n{personality}",
        NAME_RULE,
        "# ROAST & CATCHPHRASE LIBRARY (riff on these, don't just repeat them)\n" + roast_text,
        ("# TODAY'S RECIPE\n" + json.dumps(recipe, ensure_ascii=False)) if recipe else NO_RECIPE_YET,
        "# COOKING TIMES (use these for start_timer, never guess)\n" + cook_times,
        "# FOOD SAFETY (fixed facts, never contradict these)\n" + safety,
    ])


def load_tools() -> list:
    return _read_json(BRAIN_DIR / "actions.json")["tools"]


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
        })
    return out


@app.get("/api/recipes/find")
def find(q: str):
    """Find a recipe from what the cook said, e.g. ?q=I want to make steak.
    Remy's find_recipe action calls this. See server/recipe_sources.py for the order."""
    if not q.strip():
        raise HTTPException(400, "Say what you'd like to cook")
    return find_recipe(q[:200])


class AIRecipe(BaseModel):
    recipe: dict


@app.post("/api/recipes/ai")
def ai_recipe(req: AIRecipe):
    """Safety-check a recipe Remy wrote (create_recipe): fixes timers from cook-times.json,
    marks the rest as estimates, attaches safe temperatures. See server/recipe_check.py."""
    return check_ai_recipe(req.recipe)


@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: str):
    return load_recipe(recipe_id)


class SessionRequest(BaseModel):
    recipe_id: str | None = None   # None = Remy asks the cook what to make
    mode: str = "honest"


@app.post("/api/brain")
def get_brain(req: SessionRequest):
    """Remy's full instructions + actions for ANY voice route (no AI key needed).

    /api/session is the OpenAI-specific shortcut. Other routes (phone voice + a cheap
    vision model, Gemini Live, …) call this and pass the result to their own AI.
    """
    if req.mode not in MODES:
        raise HTTPException(400, f"mode must be one of {MODES}")
    recipe = load_recipe(req.recipe_id) if req.recipe_id else None
    return {
        "instructions": build_instructions(recipe, req.mode),
        "tools": load_tools(),
        "recipe": recipe,
        "mode": req.mode,
        "max_minutes": SESSION_MINUTES,
    }


@app.post("/api/session")
async def create_session(req: SessionRequest):
    if req.mode not in MODES:
        raise HTTPException(400, f"mode must be one of {MODES}")
    recipe = load_recipe(req.recipe_id) if req.recipe_id else None
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
            "tools": load_tools(),
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


# ---------- the app itself ----------

@app.get("/")
def index():
    return FileResponse(APP_DIR / "index.html")


@app.middleware("http")
async def always_fresh_app(request: Request, call_next):
    """Phones (Safari especially) can keep showing an old copy of the app's files for a long time.
    'no-cache' makes them check for a newer version every time (they still reuse an unchanged file)."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


app.mount("/", StaticFiles(directory=APP_DIR), name="app")
