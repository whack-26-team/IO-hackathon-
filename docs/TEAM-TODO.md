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

### 2. Savage swears occasionally (decided 2026-11-07, Matthew edited your files with his approval)
Savage now swears in roughly one roast in three: one word per line, aimed at the food,
never the cook, milder words first and stronger ones only on repeats. Never in safety
alerts, timers or guidance. Changed: `personality/savage.md` and the Savage lines in
`personality/roasts.json`.

- [ ] **Update (later the same day):** Matthew turned it up. Savage now swears in about two in three roasts, and after the cook's 2nd mistake it sometimes adds a nickname ("you donkey", "you idiot sandwich", "you absolute muppet", "you plank"): see `savage.md` "Nicknames" and `roasts.json` "nicknames". `instructions.md` roasting rules were updated to allow it.
- [ ] Read the new lines and tweak them in your style if you like (they're yours)
- [ ] Re-run your Savage swearing test (`tests/c1-savage-test.md`) when you can, and note whether the voice model actually says them

---

## Ahmed (`app/remy/`, `server/second_opinion.py`)

### 1. Oil smoke is a tip, not a safety alert (decided 2026-11-07, see PR #77)
Same rule as above.

- [ ] `app/remy/agent-prompt.md`, priority 1: remove "smoking oil" and say "fire or flames".
- [ ] The ElevenLabs agent's prompt in the ElevenLabs dashboard, if it's a copy of `agent-prompt.md`: same change.
- [ ] `app/remy/mock.js` (around line 81): Pretend Remy's alert "Pan is smoking! Take it off the heat." → a different danger, e.g. "Fingers! Tuck them into a claw grip."

### 2. Savage swears occasionally (decided 2026-11-07)
- [ ] If the ElevenLabs agent has its own copy of the Savage personality (not loaded from `/api/brain`), update it to match `remy-brain/personality/savage.md`: occasional swearing in roasts, aimed at the food, never in safety alerts
- [ ] Check the Savage voice actually says the words (ElevenLabs may soften them) and note the result on #55

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
- `boiled-pasta` ✓: Remy asks which shape, then uses that shape's timer from `timer_by_shape` (cook-times.json). Say "pasta", "penne", "fusilli"…
- Simple demos ✓: `toast`, `cheese-sandwich`, `overnight-oats`, `fruit-salad` (knife), `instant-noodles` (3-min timer)
