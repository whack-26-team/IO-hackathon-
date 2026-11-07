"""Import a recipe from TheMealDB into REMY's recipe format (Owner: Matthew).

Usage (from the repo root):
    python tools/import_recipe.py "steak" --list        # list matches with their TheMealDB ids
    python tools/import_recipe.py --id 52874            # import one exact dish by id
    python tools/import_recipe.py "steak"               # import the first match

What it does:
  1. Fetches the base recipe (name, ingredients + measures, method) from TheMealDB.
  2. Splits the method into steps.
  3. Saves remy-brain/recipes/_imported/<id>.json with EMPTY looks_right / looks_wrong /
     done_when and checked_by_human = false. The app only lists remy-brain/recipes/*.json,
     so raw imports never show up until they've been "Remy-ified" and moved up a folder.

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


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
# One shared copy of the TheMealDB code (also used live by the server's recipe finder)
from server.recipe_sources import (IMPORT_DIR, mealdb_lookup as lookup,  # noqa: E402
                                   mealdb_search as search, mealdb_to_remy as to_remy)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("name", nargs="?", help="dish to search for, e.g. steak")
    p.add_argument("--list", action="store_true", help="only list matches (with ids)")
    p.add_argument("--id", help="import this exact TheMealDB id")
    p.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = p.parse_args()

    if args.id:
        meal = lookup(args.id)
        if not meal:
            print(f"No TheMealDB dish with id {args.id}.")
            return 1
    else:
        if not args.name:
            p.error("give a dish name or --id")
        meals = search(args.name)
        if not meals:
            print(f"No TheMealDB results for '{args.name}'. Try a broader word (e.g. 'beef', 'pasta').")
            return 1
        if args.list:
            for m in meals:
                print(f"  --id {m['idMeal']:>6}  {m['strMeal']}  ({m.get('strArea')}, {m.get('strCategory')})")
            return 0
        meal = meals[0]

    recipe = to_remy(meal)
    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    out = IMPORT_DIR / f"{recipe['id']}.json"
    if out.exists() and not args.force:
        print(f"{out.relative_to(ROOT)} already exists (use --force to overwrite).")
        return 1
    out.write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {out.relative_to(ROOT)}: {recipe['title']}, {len(recipe['ingredients'])} ingredients, "
          f"{len(recipe['steps'])} steps.\nNext: commit + push it, then it gets Remy-ified and hand-checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
