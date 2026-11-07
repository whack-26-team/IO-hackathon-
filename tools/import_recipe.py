"""Import a recipe from TheMealDB into REMY's recipe format (Owner: Matthew).

Usage (from the repo root):
    python tools/import_recipe.py "rigatoni"            # search by name, pick the first match
    python tools/import_recipe.py "beef" --list         # just list matches

What it does:
  1. Fetches the base recipe (name, ingredients + measures, method) from TheMealDB.
  2. Splits the method into steps.
  3. Saves remy-brain/recipes/<id>.json with EMPTY looks_right / looks_wrong / done_when
     and checked_by_human = false.

Next (C2, TODO Matthew): the "Remy-ify" step. Send the base recipe to an AI once to
fill in looks_right / looks_wrong / done_when, and take timers from
remy-brain/knowledge/cook-times.json. Then a human checks the file.

TheMealDB's free key "1" is for development/education. Recheck the licence before launch.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
RECIPES_DIR = ROOT / "remy-brain" / "recipes"
KEY = os.getenv("THEMEALDB_KEY", "1")
API = f"https://www.themealdb.com/api/json/v1/{KEY}"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def search(name: str) -> list[dict]:
    r = httpx.get(f"{API}/search.php", params={"s": name}, timeout=20)
    r.raise_for_status()
    return r.json().get("meals") or []


def split_steps(method: str) -> list[str]:
    # TheMealDB methods are sometimes numbered lines, sometimes one big paragraph.
    lines = [l.strip() for l in re.split(r"\r?\n+", method) if l.strip()]
    lines = [re.sub(r"^(step\s*)?\d+[.):]?\s*", "", l, flags=re.I) for l in lines]
    lines = [l for l in lines if len(l) > 3]
    if len(lines) <= 1:  # one paragraph -> split into sentences
        lines = [s.strip() for s in re.split(r"(?<=[.!?])\s+", method) if len(s.strip()) > 3]
    return lines


def to_remy(meal: dict) -> dict:
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


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("name")
    p.add_argument("--list", action="store_true")
    p.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = p.parse_args()

    meals = search(args.name)
    if not meals:
        print(f"No TheMealDB results for '{args.name}'.")
        return 1
    if args.list:
        for m in meals:
            print(f"- {m['strMeal']} ({m.get('strArea')}, {m.get('strCategory')})")
        return 0

    recipe = to_remy(meals[0])
    out = RECIPES_DIR / f"{recipe['id']}.json"
    if out.exists() and not args.force:
        print(f"{out} already exists (use --force to overwrite).")
        return 1
    out.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {out} with {len(recipe['steps'])} steps. Next: Remy-ify + human check.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
