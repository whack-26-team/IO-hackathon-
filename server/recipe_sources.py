"""Finding recipes by what the cook SAYS ("I want to make steak"). Owner: Matthew.

Used by:
  * server/main.py      -> GET /api/recipes/find?q=...   (Remy's find_recipe action)
  * tools/import_recipe.py (manual imports)

Order of preference:
  1. Our own hand-written / hand-checked recipes in remy-brain/recipes/ (matched on
     title + "aliases"), because they have looks_right / looks_wrong / timers.
  2. Otherwise Remy writes the recipe itself (create_recipe -> server/recipe_check.py).
     If TheMealDB (free online recipe database) has the dish, it's returned as a
     "reference" Remy may adapt (cached in remy-brain/recipes/_imported/).
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "remy-brain" / "recipes"
IMPORT_DIR = RECIPES_DIR / "_imported"
MEALDB = f"https://www.themealdb.com/api/json/v1/{os.getenv('THEMEALDB_KEY', '1')}"

# Words that don't help identify a dish ("I'd like to make some steak please")
STOPWORDS = set("""a an the i id i'd im i'm we we're lets let's let us to make makes making cook cooking
cooked want wanna would like love please some something how do can could you me my for of with
and or tonight today dinner lunch breakfast recipe recipes dish meal quick easy simple good nice
just maybe think thinking about try trying going gonna""".split())


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def words(text: str) -> list[str]:
    toks = re.findall(r"[a-z]+", text.lower())
    out = []
    for t in toks:
        if t in STOPWORDS:
            continue
        out.append(t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t)  # eggs -> egg
    return out


# ---------- 1. our own recipes ----------

def local_recipes() -> list[dict]:
    out = []
    for path in sorted(RECIPES_DIR.glob("*.json")):
        try:
            out.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception:  # noqa: BLE001  (validate.py reports broken files)
            continue
    return out


def match_local(query: str) -> dict | None:
    q = set(words(query))
    if not q:
        return None
    best, best_score = None, (0.0, 0)
    for r in local_recipes():
        for name in [r.get("title", ""), r.get("id", ""), *r.get("aliases", [])]:
            n = set(words(name.replace("-", " ")))
            if not n:
                continue
            # every word of the alias said by the cook = strong match ("pasta" -> boiled pasta).
            # On a tie, the alias with more matching words wins ("tomato pasta" -> rigatoni).
            score = (len(q & n) / len(n), len(q & n))
            if score > best_score:
                best, best_score = r, score
    return best if best_score[0] >= 1.0 else None


# ---------- 2. TheMealDB ----------

def split_steps(method: str) -> list[str]:
    # TheMealDB methods are sometimes numbered lines, sometimes one big paragraph.
    lines = [l.strip() for l in re.split(r"\r?\n+", method) if l.strip()]
    lines = [re.sub(r"^(step\s*)?\d+[.):]?\s*", "", l, flags=re.I) for l in lines]
    lines = [l for l in lines if len(l) > 3 and not re.fullmatch(r"step\s*\d*", l, re.I)]
    if len(lines) <= 1:  # one paragraph -> split into sentences
        lines = [s.strip() for s in re.split(r"(?<=[.!?])\s+", method) if len(s.strip()) > 3]
    return lines


def mealdb_to_remy(meal: dict) -> dict:
    ingredients = []
    for i in range(1, 21):
        ing = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if ing:
            ingredients.append(f"{measure} {ing}".strip())
    return {
        "id": slugify(meal["strMeal"]),
        "title": meal["strMeal"],
        "summary": f"{meal.get('strArea') or ''} {meal.get('strCategory') or ''}".strip(),
        "source": f"TheMealDB #{meal['idMeal']}",
        "source_url": meal.get("strSource") or "",
        "video": meal.get("strYoutube") or "",
        "image": meal.get("strMealThumb") or "",
        "checked_by_human": False,
        "ingredients": ingredients,
        "steps": [
            {"instruction": s, "looks_right": [], "looks_wrong": [], "done_when": ""}
            for s in split_steps(meal.get("strInstructions") or "")
        ],
    }


def mealdb_search(term: str) -> list[dict]:
    r = httpx.get(f"{MEALDB}/search.php", params={"s": term}, timeout=10)
    r.raise_for_status()
    return r.json().get("meals") or []


def mealdb_lookup(meal_id: str) -> dict | None:
    r = httpx.get(f"{MEALDB}/lookup.php", params={"i": meal_id}, timeout=10)
    r.raise_for_status()
    meals = r.json().get("meals") or []
    return meals[0] if meals else None


def match_mealdb(query: str) -> dict | None:
    q = words(query)
    if not q:
        return None
    candidates: dict[str, dict] = {}
    # whole phrase first, then each word (longest first) since search is by dish name
    for term in [" ".join(q), *sorted(set(q), key=len, reverse=True)]:
        for m in mealdb_search(term):
            candidates.setdefault(m["idMeal"], m)
        if len(candidates) >= 25:
            break
    best, best_score = None, 0
    for m in candidates.values():
        title = set(words(m["strMeal"]))
        score = len(set(q) & title)  # whole words only: "egg" doesn't match "eggplant"
        if score > best_score or (score == best_score and best and len(m["strMeal"]) < len(best["strMeal"])):
            best, best_score = m, score
    # Most of what the cook said must be in the dish name: "fish and chips" shouldn't
    # become "Fish pie". A wrong dish is worse than Remy asking again.
    return best if best and best_score / len(set(q)) >= 0.6 else None


# ---------- the one function the server calls ----------

def find_recipe(query: str) -> dict:
    """-> {found, source: 'remy'|'themealdb'|None, checked_by_human, recipe? | reference?, message}"""
    r = match_local(query)
    if r:
        return {"found": True, "source": "remy", "checked_by_human": bool(r.get("checked_by_human")),
                "recipe": r, "message": f"Found our recipe: {r['title']}."}
    try:
        meal = match_mealdb(query)
    except httpx.HTTPError:
        meal = None
    if meal:
        recipe = mealdb_to_remy(meal)
        try:  # cache it (on Render this disk resets on each deploy, which is fine)
            IMPORT_DIR.mkdir(parents=True, exist_ok=True)
            (IMPORT_DIR / f"{recipe['id']}.json").write_text(
                json.dumps(recipe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        except OSError:
            pass
        return {"found": False, "source": "themealdb", "checked_by_human": False, "reference": recipe,
                "message": (f"Not one of our checked recipes. Write your own recipe for what the cook "
                            f"asked and call create_recipe. You may adapt this online reference "
                            f"('{recipe['title']}') if it fits.")}
    return {"found": False, "source": None, "checked_by_human": False,
            "message": ("Not one of our checked recipes. If you know the dish, write the recipe "
                        "yourself and call create_recipe. If you're not sure what they mean, ask.")}
