"""Safety check for recipes Remy writes itself (the create_recipe action). Owner: Matthew.

AI is great at recipes but can get times and temperatures wrong. Before an AI recipe
reaches the screen, the server:
  1. cleans up its shape (and caps its size),
  2. fixes timers using remy-brain/knowledge/cook-times.json where we know the food,
     and marks every other timer as an "estimate" so Remy says so,
  3. attaches the right safe temperatures from food-safety.json for meat/fish/eggs,
  4. labels it as an AI recipe (checked_by_human: false).
It returns the cleaned recipe plus a list of what it changed, so Remy can mention it.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

KNOWLEDGE = Path(__file__).resolve().parent.parent / "remy-brain" / "knowledge"

MAX_STEPS, MAX_INGREDIENTS, MAX_TEXT = 30, 40, 300

# Words in cook-times.json keys that don't identify a food
GENERIC = set("""boil boiled simmer pan minute minutes total default min max check at per side hot very
medium low high heat oven from cold water whole chunk chunks sliced sheets soak off add adding after
stock flesh skin down rest covered c thick dried and the a white""".split())  # 'white' rice is the default

# Which safety entry applies, by words found in the title/ingredients (most specific first)
SAFETY_RULES = [
    (r"\b(chicken|turkey|duck|poultry)\b", "poultry (chicken, turkey, duck), whole or minced, plus stuffing"),
    (r"\b(mince|minced|burgers?|sausages?|meatballs?)\b", "minced meat (beef, pork, lamb, veal), burgers, sausages"),
    (r"\b(pork|gammon|ham)\b", "pork, whole cuts (chops, loin, roasts)"),
    (r"\b(beef|steak|lamb|veal|venison)\b", "whole cuts of beef, lamb, veal (steaks, chops, roasts)"),
    (r"\b(fish|salmon|cod|haddock|tuna|prawns?|shrimp|mussels?|clams?|scallops?|seafood)\b", "fish and shellfish"),
    (r"\b(eggs?)\b", "eggs"),
]


def _load(name: str) -> dict:
    return json.loads((KNOWLEDGE / name).read_text(encoding="utf-8"))


def _words(text: str) -> set[str]:
    out = set()
    for t in re.findall(r"[a-z]+", text.lower()):
        out.add(t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t)
    return out


def _timer_index() -> list[tuple[set[str], str, float, float | None]]:
    """(keywords, path, minutes, check_at) for every unambiguous timing in cook-times.json.
    Steak is left out on purpose: it depends on thickness + doneness, so Remy must ask."""
    ct = _load("cook-times.json")
    index = []

    def add(path: str, key: str, minutes, check_at=None):
        kw = {w for w in _words(key.replace("_", " ")) if w not in GENERIC}
        if kw and isinstance(minutes, (int, float)):
            index.append((kw, path, float(minutes), check_at))

    for section, entries in ct.items():
        if section.startswith("_") or not isinstance(entries, dict) or section.startswith("steak"):
            continue
        for key, val in entries.items():
            if key.startswith("_"):
                continue
            path = f"{section}/{key}"
            if isinstance(val, (int, float)):
                add(path, key, val)
            elif isinstance(val, dict):
                for leaf in ("default", "minutes_per_side", "total_minutes", "max"):
                    if isinstance(val.get(leaf), (int, float)):
                        add(f"{path}/{leaf}", key, val[leaf], val.get("check_at") if leaf == "default" else None)
                        break
    return index


def _resolve(path: str):
    node = _load("cook-times.json")
    for part in path.split("/"):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, (int, float)) else None


def _text(v, limit=MAX_TEXT) -> str:
    return str(v or "").strip()[:limit]


def _list(v, limit=8) -> list[str]:
    if isinstance(v, str):
        v = [v]
    return [_text(x) for x in (v or []) if _text(x)][:limit]


def check_ai_recipe(data: dict) -> dict:
    changes: list[str] = []
    warnings: list[str] = []
    title = _text(data.get("title"), 80) or "Remy's recipe"
    ingredients = _list(data.get("ingredients"), MAX_INGREDIENTS)

    steps = []
    index = _timer_index()
    for i, raw in enumerate((data.get("steps") or [])[:MAX_STEPS]):
        if isinstance(raw, str):
            raw = {"instruction": raw}
        instruction = _text(raw.get("instruction"))
        if not instruction:
            continue
        step = {
            "instruction": instruction,
            "looks_right": _list(raw.get("looks_right")),
            "looks_wrong": _list(raw.get("looks_wrong")),
            "done_when": _text(raw.get("done_when")),
        }
        t = raw.get("timer")
        if isinstance(t, dict) and isinstance(t.get("minutes"), (int, float)) and t["minutes"] > 0:
            timer = {"label": _text(t.get("label"), 40) or f"Step {len(steps) + 1}",
                     "minutes": round(float(t["minutes"]), 1)}
            if isinstance(t.get("check_at"), (int, float)) and 0 < t["check_at"] < timer["minutes"]:
                timer["check_at"] = round(float(t["check_at"]), 1)
            src = _text(t.get("from"), 120)
            known = _resolve(src) if src else None
            table_check = None
            if known is None:
                # find the most specific cook-times entry mentioned in the label + instruction
                said = _words(f"{timer['label']} {instruction}")
                hits = [(kw, p, m, c) for kw, p, m, c in index if kw <= said]
                if hits:
                    kw, src, known, table_check = max(hits, key=lambda h: len(h[0]))
            if known is not None:
                if timer["minutes"] != known:
                    changes.append(f"'{timer['label']}' timer: {timer['minutes']} → {known:g} min "
                                   f"(from our cooking-times table)")
                    timer["minutes"] = known
                if timer.get("check_at", 0) >= known:
                    timer.pop("check_at")
                if table_check and "check_at" not in timer:
                    timer["check_at"] = table_check   # e.g. "taste the pasta" 1 min before the end
                timer["from"] = src
            else:
                timer["estimate"] = True
                warnings.append(f"'{timer['label']}' ({timer['minutes']:g} min) is an estimate, "
                                "not from our table. Tell the cook to check the packet/recipe.")
            step["timer"] = timer
        steps.append(step)

    if not steps:
        return {"ok": False, "message": "The recipe had no usable steps. Write it again with a list of steps."}

    # Safe temperatures: always from our fixed table, never from the AI
    temps = _load("food-safety.json")["minimum_internal_temps_c"]
    haystack = " ".join([title, *ingredients]).lower()
    safety, seen = [], set()
    for pattern, key in SAFETY_RULES:
        if re.search(pattern, haystack) and key in temps and key not in seen:
            seen.add(key)
            entry = temps[key]
            safety.append({"food": key, **({"temp_c": entry["temp_c"]} if "temp_c" in entry else {}),
                           "note": entry.get("note", "")})

    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50]
    recipe = {
        "id": f"ai-{slug}",
        "title": title,
        "summary": _text(data.get("summary"), 160),
        "source": "ai",
        "checked_by_human": False,
        "serves": data.get("serves") if isinstance(data.get("serves"), int) else None,
        "ingredients": ingredients,
        "steps": steps,
        "safety": safety,
    }
    msg = "Recipe checked and shown on screen."
    if changes:
        msg += " I corrected: " + "; ".join(changes) + ". Use the corrected times."
    if warnings:
        msg += " Estimates: " + " ".join(warnings)
    if safety:
        msg += " Safe temperatures attached: " + ", ".join(
            f"{s['food'].split(' (')[0]} {s['temp_c']}°C" for s in safety if "temp_c" in s) + "."
    return {"ok": True, "recipe": recipe, "changes": changes, "warnings": warnings, "message": msg}
