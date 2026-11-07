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


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"{path.relative_to(ROOT)}: not valid JSON ({e})")
        return None


for path in sorted((BRAIN / "recipes").glob("*.json")):
    r = load(path)
    if r is None:
        continue
    name = path.relative_to(ROOT)
    for key in ("id", "title", "ingredients", "steps"):
        if key not in r:
            errors.append(f"{name}: missing '{key}'")
    if r.get("id") != path.stem:
        errors.append(f"{name}: id '{r.get('id')}' must match the file name '{path.stem}'")
    for i, step in enumerate(r.get("steps", [])):
        if not step.get("instruction"):
            errors.append(f"{name}: step {i} has no instruction")
        t = step.get("timer")
        if t and not (isinstance(t.get("minutes"), (int, float)) and t.get("label")):
            errors.append(f"{name}: step {i} timer needs 'label' and numeric 'minutes'")

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

if errors:
    print("❌ Problems found:\n- " + "\n- ".join(errors))
    sys.exit(1)
print("✅ All REMY brain files look valid.")
