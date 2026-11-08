"""Only the cooking times and food-safety facts that matter for the dish (Owner: Matthew).

Remy's brain used to carry the whole cook-times.json and food-safety.json (~7k characters) on
every session, which costs ElevenLabs credits. Now:
  * always: the cook-times rules (never guess), the food-safety rule (thermometer, never "safe"
    from looks), every hazard (fire, knife, raw meat, handles, allergens, smoking oil) and one
    compact line of minimum temperatures, so the essential safety is always there;
  * with a recipe: only the timings and safety entries that match it.
find_recipe / create_recipe hand the matching ones over when the dish is chosen mid-session
(knowledge_for), because ElevenLabs' instructions are fixed once the session starts.
"""
from __future__ import annotations

import json
import re

from server.recipe_check import GENERIC, SAFETY_RULES, _load, _words

# Extra words in cook-times keys that don't name the food
SKIP = GENERIC | set("al dente fresh brown boneless raw new frozen sunny up quick simple other".split())
# Categories whose entry keys don't name the food: kept whole when the dish mentions it
CATEGORY_FOOD = {
    "pasta_dried_minutes_al_dente": {"pasta"},
    "steak_minutes_per_side_very_hot_pan": {"steak"},
    "eggs": {"egg", "omelette"},
    "rice_and_grains_minutes": {"rice", "risotto", "couscous", "quinoa"},
    "potatoes_minutes": {"potato", "potatoe", "mash", "chip"},
    "quick_and_simple": {"noodle"},
}
TRIGGERS = set().union(*CATEGORY_FOOD.values())
# Short names for the always-there temperature line
# (start of the food-safety key, short label): matched on the START of the key, so "pork" can't
# pick up "minced meat (beef, pork...)"
TEMP_LABELS = [
    ("poultry", "poultry"), ("minced meat", "mince, burgers, sausages"), ("whole cuts of beef", "whole beef/lamb"),
    ("pork,", "pork"), ("fish and shellfish", "fish & shellfish"), ("egg dishes", "egg dishes"), ("leftovers", "leftovers"),
]


def _ordered(key: str) -> list[str]:
    """Words of a cook-times key in order ('courgette_slices_fry' -> courgette, slice, fry)."""
    out = []
    for t in re.findall(r"[a-z0-9.]+", key.lower().replace("_", " ")):
        out.append(t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t)
    return out


def _recipe_words(recipe: dict) -> set[str]:
    seasoning = re.compile(r"(black|white|ground)\s+pepper|salt and pepper|pepper to taste", re.I)   # not peppers (veg)
    parts = [recipe.get("title", ""), recipe.get("id", "").replace("-", " "), seasoning.sub(" ", " ".join(recipe.get("ingredients", [])))]
    for s in recipe.get("steps", []):
        parts.append(seasoning.sub(" ", s.get("instruction", "")))
        for t in [s.get("timer"), *(s.get("timer_by_shape") or {}).values()]:
            if isinstance(t, dict):
                parts.append(t.get("label", ""))
    return _words(" ".join(parts))


def _timer_paths(recipe: dict) -> set[str]:
    paths = set()
    for s in recipe.get("steps", []):
        for t in [s.get("timer"), *(s.get("timer_by_shape") or {}).values()]:
            if isinstance(t, dict) and t.get("from"):
                paths.add(str(t["from"]))
    return paths


def relevant_cook_times(recipe: dict | None) -> dict:
    ct = _load("cook-times.json")
    out: dict = {"_rules": ct.get("_rules", [])}
    if not recipe:
        return out
    words, paths = _recipe_words(recipe), _timer_paths(recipe)
    for cat, entries in ct.items():
        if cat.startswith("_") or not isinstance(entries, dict):
            continue
        whole = bool(CATEGORY_FOOD.get(cat, set()) & words)
        kept = {}
        for key, val in entries.items():
            if key.startswith("_"):
                continue
            food = [w for w in _ordered(key) if w not in SKIP and not w[0].isdigit()]   # first = the food
            exact = f"{cat}/{key}" in paths or any(p.startswith(f"{cat}/{key}") for p in paths)
            # word match: the food (first word) is in the dish, any dish word in the key too ('steak' in
            # garlic_butter_baste_steak), and never inside the pasta/egg/steak/rice tables (those go whole)
            by_word = (cat not in CATEGORY_FOOD and food and food[0] in words
                       and all(w in words for w in food if w in TRIGGERS))
            if whole or exact or by_word:
                kept[key] = val
        if kept:
            kept.update({k: v for k, v in entries.items() if k.startswith("_")})   # the category's notes
            out[cat] = kept
    return out


def temps_line(fs: dict) -> str:
    temps = fs.get("minimum_internal_temps_c", {})
    bits = []
    for needle, label in TEMP_LABELS:
        for key, val in temps.items():
            if key.startswith(needle) and isinstance(val, dict) and val.get("temp_c"):
                bits.append(f"{label} {val['temp_c']}°C")
                break
    return "Minimum core temps (thermometer, thickest part): " + ", ".join(bits) + ". Whole cuts and fish: rest 3 min."


def relevant_food_safety(recipe: dict | None) -> dict:
    fs = _load("food-safety.json")
    out: dict = {"_rule": fs.get("_rule", ""), "temps": temps_line(fs), "hazards": fs.get("hazards", {})}
    if not recipe:
        return out
    text = " ".join([recipe.get("title", ""), " ".join(recipe.get("ingredients", []))]).lower()
    temps = fs.get("minimum_internal_temps_c", {})
    matched = {key: temps[key] for pattern, key in SAFETY_RULES if re.search(pattern, text) and key in temps}
    if matched:
        out["minimum_internal_temps_c"] = matched
    if re.search(r"\bsteak\b", text):
        doneness = next((v for k, v in fs.items() if k.startswith("steak_doneness")), None)
        if doneness:
            out["steak_doneness_c (taste, not safety)"] = doneness
    return out


def knowledge_for(recipe: dict | None) -> dict:
    """What find_recipe / create_recipe hand back with a recipe: its timings + safety entries."""
    return {"cook_times": relevant_cook_times(recipe), "food_safety": relevant_food_safety(recipe)} if recipe else {}


def as_text(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
