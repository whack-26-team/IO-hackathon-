"""Check that every brain file is valid. Runs automatically on every pull request.

    python tools/validate.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAIN = ROOT / "remy-brain"
errors: list[str] = []
warnings: list[str] = []


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"{path.relative_to(ROOT)}: not valid JSON ({e})")
        return None


COOK_TIMES = None
try:
    COOK_TIMES = json.loads((BRAIN / "knowledge" / "cook-times.json").read_text(encoding="utf-8"))
except Exception:  # noqa: BLE001  (reported below with the other JSON files)
    pass


def cook_time(path: str):
    """Resolve 'pasta_dried_minutes_al_dente/rigatoni/default' in cook-times.json."""
    node = COOK_TIMES
    for part in path.split("/"):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, (int, float)) else None


for path in sorted((BRAIN / "recipes").glob("*.json")):  # not _imported/ (raw imports)
    r = load(path)
    if r is None:
        continue
    name = path.relative_to(ROOT)
    checked = r.get("checked_by_human") is True
    for key in ("id", "title", "ingredients", "steps"):
        if key not in r:
            errors.append(f"{name}: missing '{key}'")
    if r.get("id") != path.stem:
        errors.append(f"{name}: id '{r.get('id')}' must match the file name '{path.stem}'")
    if not r.get("steps"):
        errors.append(f"{name}: has no steps")
    for i, step in enumerate(r.get("steps", [])):
        where = f"{name}: step {i + 1}"
        if not step.get("instruction"):
            errors.append(f"{where} has no instruction")
        # Remy judges each step by these. Required once a human has checked the recipe.
        for key in ("looks_right", "looks_wrong", "done_when"):
            if not step.get(key):
                (errors if checked else warnings).append(f"{where} is missing '{key}'")
        t = step.get("timer")
        if not t:
            continue
        minutes = t.get("minutes")
        if not (t.get("label") and isinstance(minutes, (int, float)) and minutes > 0):
            errors.append(f"{where} timer needs a 'label' and positive numeric 'minutes'")
            continue
        check_at = t.get("check_at")
        if check_at is not None and not (isinstance(check_at, (int, float)) and 0 < check_at < minutes):
            errors.append(f"{where} timer 'check_at' must be between 0 and 'minutes'")
        # Timers must come from the cook-times table, never be guessed.
        src = t.get("from")
        if not src:
            (errors if checked else warnings).append(
                f"{where} timer has no 'from' (which cook-times.json entry it comes from)")
        elif COOK_TIMES is not None:
            expected = cook_time(src)
            if expected is None:
                errors.append(f"{where} timer 'from' path not found in cook-times.json: {src}")
            elif expected != minutes:
                errors.append(f"{where} timer is {minutes} min but cook-times.json {src} says {expected}")

for path in [BRAIN / "actions.json", BRAIN / "personality" / "roasts.json",
             *sorted((BRAIN / "knowledge").glob("*.json"))]:
    data = load(path)
    if path.name == "actions.json" and data is not None:
        for tool in data.get("tools", []):
            if not {"type", "name", "parameters"} <= tool.keys():
                errors.append(f"actions.json: tool {tool.get('name')} needs type, name, parameters")

for mode in ("gentle", "honest", "savage"):
    if not (BRAIN / "personality" / f"{mode}.md").exists():
        errors.append(f"remy-brain/personality/{mode}.md is missing")

if warnings:
    print("⚠️  Warnings (fine for unchecked recipes, must be fixed before checked_by_human: true):\n- "
          + "\n- ".join(warnings))
if errors:
    print("❌ Problems found:\n- " + "\n- ".join(errors))
    sys.exit(1)
print("✅ All REMY brain files look valid.")
