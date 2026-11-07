# Changes waiting for Pranav, Ahmed and Felix

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

## Felix (`app/demo/`, `app/extras/`, `docs/pitch/`)

New tasks while Matthew is on a break: **issue #83**. Read `docs/DEMO.md` first.

- [ ] Demo mode: make `app/demo/demo-remy.js` (opened with `?demo=1`) play the beats of `docs/DEMO.md`
- [ ] Pitch slides in `docs/pitch/` (6 slides max, plus a PDF)
- [ ] Rehearse the demo on your iPhone, post the timings on #83
- [ ] Record the backup video once demo mode works (shared drive, link on #83)
- [ ] Change attitude mid-cook by tapping the badge (`app/extras/mode-switch.js`)
- [ ] First-time setup card (`app/extras/setup-guide.js`)
- [ ] Backup video on a laptop with a video file as the camera (steps in #83)

---

## New recipes you can use when testing
Remy finds these by name (see `aliases` in each file):
- `rigatoni`, `steak`, `scrambled-eggs` (all ✓ checked by Matthew)
- `cereal` ✓: no-cook demo, safe to use anywhere (no hob, no knife)
- `boiled-pasta` (unchecked): Remy asks which shape, then uses that shape's timer from `timer_by_shape` (cook-times.json). Say "pasta", "penne", "fusilli"…
- Simple demos ✓: `toast`, `cheese-sandwich`, `overnight-oats`, `fruit-salad` (knife), `instant-noodles` (3-min timer)
