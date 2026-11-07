# Changes waiting for Pranav and Ahmed

Matthew (team lead) keeps this list. These are changes in **your** files that come from a
team decision, so nobody else edits them for you. Check this file whenever you start a
session. When you've done an item, tick it in your PR (`- [x]`) and mention the item in
the PR description.

---

## Pranav (`remy-brain/instructions.md`, `remy-brain/actions.json`, `remy-brain/personality/`, `tests/`)

### 1. Oil smoke is a tip, not a safety alert (decided 2026-11-07, see PR #77)
Smoke from a hot pan (searing, frying) must **never** trigger `safety_alert` and never a
roast. Very heavy smoke → a normal `show_tip`: "turn the heat down". Only **visible
flames or fire** get a `safety_alert`.

- [ ] `remy-brain/instructions.md`, priority 1 ("SAFETY FIRST"): remove "smoking oil" and say "fire or flames".
- [ ] `remy-brain/actions.json`, `safety_alert` description: remove "smoking oil".
- [ ] `remy-brain/actions.json`, `safety_alert` → `text` example: replace "Oil is smoking: take the pan off the heat" with e.g. "Flames in the pan: turn off the heat and cover it".
- [ ] `tests/labels.json`: clip 04 (steam or smoke) is still right as it is: ask, no alert. No change needed unless you add a smoke clip.

Already done by Matthew: recipes, `remy-brain/knowledge/food-safety.json`, and the
Gemini picture check in `server/vision.py`.

---

## Ahmed (`app/remy/`, `server/second_opinion.py`)

### 1. Oil smoke is a tip, not a safety alert (decided 2026-11-07, see PR #77)
Same rule as above.

- [ ] `app/remy/agent-prompt.md`, priority 1: remove "smoking oil" and say "fire or flames".
- [ ] The ElevenLabs agent's prompt in the ElevenLabs dashboard, if it's a copy of `agent-prompt.md`: same change.
- [ ] `app/remy/mock.js` (around line 81): Pretend Remy's alert "Pan is smoking! Take it off the heat." → a different danger, e.g. "Fingers! Tuck them into a claw grip."

### Done
- [x] Timer beeps skipped in real sessions, plus an accurate privacy note (Matthew, PR #73).

---

## New recipes you can use when testing
Remy finds these by name (see `aliases` in each file):
- `rigatoni`, `steak`, `scrambled-eggs` (all ✓ checked by Matthew)
- `cereal` ✓: no-cook demo, safe to use anywhere (no hob, no knife)
- Simple demos (unchecked): `toast`, `cheese-sandwich`, `overnight-oats`, `fruit-salad` (knife), `instant-noodles` (3-min timer)
