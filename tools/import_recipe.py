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


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
# One shared copy of the TheMealDB code (also used live by the server's recipe finder)
from server.recipe_sources import (IMPORT_DIR, mealdb_lookup as lookup,  # noqa: E402
                                   mealdb_search as search, mealdb_to_remy as to_remy)


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
