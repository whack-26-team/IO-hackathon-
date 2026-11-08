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

### 2. Savage swearing is now Matthew's (decided 2026-11-07)
Matthew is handling **Savage swearing, the nicknames** ("you donkey", "you idiot sandwich",
"you absolute muppet", "you plank") **the raw line "It's fucking raw!"** and the **escalating "show me the pan" reminders** (`camera_reminders` in roasts.json) himself.
That means `personality/savage.md` and the **Savage** lines in `personality/roasts.json`.

- [ ] Don't change the swearing, nicknames or raw line in those files. If you think one needs changing, comment on the PR or ask Matthew
- [ ] Everything else stays yours: Gentle, Honest, praise, catchphrases, `instructions.md`, `actions.json`, `tests/`
- [ ] Optional: when real Remy can be tested, run the Savage part of `tests/c1-savage-test.md` and note whether the voice actually says the words

---

## Ahmed (`app/remy/`, `server/second_opinion.py`)

### 1. Oil smoke is a tip, not a safety alert (decided 2026-11-07, see PR #77)
Same rule as above.

- [ ] `app/remy/agent-prompt.md`, priority 1: remove "smoking oil" and say "fire or flames".
- [ ] The ElevenLabs agent's prompt in the ElevenLabs dashboard, if it's a copy of `agent-prompt.md`: same change.
- [x] `app/remy/mock.js`: Pretend Remy's alert is now the knife alert (done by Matthew)

### 2. Savage swears occasionally (decided 2026-11-07)
- [ ] If the ElevenLabs agent has its own copy of the Savage personality (not loaded from `/api/brain`), update it to match `remy-brain/personality/savage.md`: occasional swearing in roasts, aimed at the food, never in safety alerts
- [ ] Check the Savage voice actually says the words (ElevenLabs may soften them) and note the result on #55

### 3. Timers now start when the cook says it's in (Matthew edited your files with his approval, PR on 2026-11-07)
- `app/remy/actions.js`: `start_timer` accepts a timer from **any** step of the loaded recipe (and `timer_by_shape`), not only the current step. That was why timers were refused. When the cook says "pasta's in" / "it's in", `hear()` starts the next recipe timer itself (using the pasta shape the cook named) and returns it. A duplicate `start_timer` with the same label and length returns `already_running`.
- `app/remy/elevenlabs.js`: when `hear()` starts a timer, Remy gets a `[TIMER STARTED BY APP]` context update so he confirms it and doesn't start another.
- New tests at the end of `app/remy/integration.test.mjs` (all pass; the "exact prefix of the agent prompt" test was already failing and your PR #85 syncs it).
- [ ] Have a look and keep it in your style; tell Matthew if anything clashes with your PR #85

### Done
- [x] Timer beeps skipped in real sessions, plus an accurate privacy note (Matthew, PR #73).

---

## Felix (`app/demo/`, `app/extras/`, `app/school/`, `docs/pitch/`)

**Felix isn't building right now. Matthew is building all of these** (issues reassigned to him):
- [x] Extras kit (#111), screen awake, your cooks, badges, weekly challenge, share card (#112–#116)
- [x] Judge mode + highlights, watch my pan, look & feel, recipe browser (#117–#120)
- [ ] Cooking school screen (#121), with Pranav's lesson files (#124)
- [ ] Two-player cook-off (#122)
- [ ] Demo mode `?demo=1`, mid-cook attitude switch, setup card, backup video (#83)

---

## New recipes you can use when testing
Remy finds these by name (see `aliases` in each file):
- `rigatoni`, `steak`, `scrambled-eggs` (all ✓ checked by Matthew)
- `cereal` ✓: no-cook demo, safe to use anywhere (no hob, no knife)
- `boiled-pasta` ✓: Remy asks which shape, then uses that shape's timer from `timer_by_shape` (cook-times.json). Say "pasta", "penne", "fusilli"…
- Simple demos ✓: `toast`, `cheese-sandwich`, `overnight-oats`, `fruit-salad` (knife), `instant-noodles` (3-min timer)
