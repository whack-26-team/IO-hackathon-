# Pranav: insults, roasts, catchphrases & personality · accuracy testing

## 📩 Message to Pranav
> Hey Pranav! You're in charge of **making Remy hilarious, and making sure it's right**. You own all of Remy's personality: the three modes (😇 Gentle, 😏 Honest, 🤬 Savage), the roast library, the catchphrases and the escalating meltdowns. You're also in charge of testing how often Remy spots mistakes correctly.
>
> Most of your work is writing (instructions, roast lines, catchphrases) plus filming a few short cooking clips, so **you can start right now**, even before the AI is connected.
>
> **To start:**
> 1. Open the repo `whack-26-team/IO-hackathon-` in Codex (connect GitHub and approve the `whack-26-team` org if asked)
> 2. Paste the prompt below and ask for a plan first
> 3. Your tasks are issues #19–#24 on GitHub (filter "Assigned to me")
>
> The two hard rules: **safety beats comedy** (real danger means a clear warning first, roast after), and **roast the cooking, never the person**.

> 🌿 **Your branches:** you work only on your own branches, one per issue, all starting with `pranav/` (e.g. `pranav/c2-21-personality`). The exact names are in your issues and in `docs/BRANCHES.md`. Never push to `main`.

## 🤖 Prompt to paste into Codex
```
I'm Pranav, on a 4-person hackathon team building REMY: a live AI chef that watches
you cook through an iPhone camera, talks to you out loud, roasts your mistakes, and
starts cooking timers automatically. I use Codex. Two teammates use Claude Code.
Our priority is CREATIVITY and PERSONALITY: Remy should be genuinely funny.

FIRST, read these files fully before doing anything:
- AGENTS.md (team rulebook, especially "Remy's behaviour boundaries")
- docs/PLAN.md, especially "Personality", "Accuracy", and my section
  "Pranav: Insults, roasts, catchphrases & personality · Accuracy testing"
- remy-brain/instructions.md (Remy's core rules: my file)
- remy-brain/personality/gentle.md, honest.md, savage.md, roasts.json (my files, starters)
- remy-brain/actions.json (the on-screen actions Remy can trigger: my file)
- server/main.py → build_instructions() (shows how my files are glued into Remy's
  final prompt together with the recipe, cook-times and food-safety tables)
- remy-brain/recipes/rigatoni.json (example recipe: looks_right / looks_wrong / done_when)
- tests/labels.json, tests/score.py (accuracy testing starters: mine)

MY ROLE: Remy's personality and brain, plus measuring and improving accuracy.

I OWN: remy-brain/instructions.md, remy-brain/actions.json, remy-brain/personality/,
tests/. I must NOT edit server/, app/, remy-brain/recipes/ or remy-brain/knowledge/.

MY CHECKPOINTS (GitHub issues #19–#24):
- C0 (#19): improve instructions.md: short spoken sentences, one tip at a time,
  stay quiet when all's well, safety first, only roast when confident, ask when
  unsure ("is that smoke or steam?", "hold a piece up to the camera"), use timers
  from the recipe/cook-times (never guess), check the camera view at the start.
- C1 (#20): Savage-mode test: does the AI model Ahmed picks actually swear and roast
  with our instructions? Write test prompts and a short report of what works and what
  gets softened or refused, plus how we adapt.
- C2 (#21), the main creative build:
  * gentle.md / honest.md / savage.md: voice, vocabulary, rhythm, example lines,
    what each mode does on mistakes vs. success.
  * roasts.json: lines for burning, overcooked, undercooked, raw, too_much_salt,
    messy_station, wrong_order, slow. Per mode (honest + savage at least), with
    3 ESCALATION LEVELS each (first jab → repeat offender → full meltdown).
    Over-the-top PRAISE lines too (contrast makes roasts land).
  * Remy's own CATCHPHRASES: greeting, "step complete", sign-off, a signature roast.
    Original, memorable, quotable for the pitch.
  * actions.json: sharpen each tool's description so the model uses it at the right
    moments (e.g. roast only when confident, safety_alert overrides everything).
  * Plan ~10 short test clips to film (burnt garlic, pasta boiling over, a good steak
    sear, knife near fingers, 30s of nothing happening) and write tests/labels.json
    (what happens at which second, and the quiet periods).
- C3 (#22): first real cook-along: log every wrong call, missed mistake, and roast that
  fell flat.
- C4 (#23): build tests/score.py replay (frames from clips → Remy → compare with labels:
  catches / misses / false alarms). Rounds of: change instructions → re-score → keep
  the better version. Stop Remy repeating lines.
- C5 (#24): lock the final personality; pick the 3 best roasts for the live demo.

BOUNDARIES (non-negotiable):
- Safety beats comedy: real danger → clear safety_alert first, jokes after.
- Roast the COOKING, never the person (no looks, body, race, gender, religion, accent).
- Swearing only in Savage mode (the user opts in and confirms 18+).
- Food-safety temperatures only from remy-brain/knowledge/food-safety.json. Remy never
  says "safe to eat" from looks; it says "check with a thermometer".
- A wrong roast is worse than no roast, so confidence first.
- Keep files valid: run `python tools/validate.py` before every commit.

MY DEDICATED BRANCHES (one per issue; exact names, don't invent others):
- C0 (#19): pranav/c0-19-core-rules
- C1 (#20): pranav/c1-20-savage-test
- C2 (#21): pranav/c2-21-personality
- C3 (#22): pranav/c3-22-cookalong-log
- C4 (#23): pranav/c4-23-accuracy
- C5 (#24): pranav/c5-24-final-personality
Branch rules, follow them every time:
- Before starting an issue: `git checkout main && git pull`, then
  `git checkout -b <that issue's branch>`. Always branch from the LATEST main.
- Before EVERY commit, check `git branch --show-current`. It must be one of MY
  branches above. If it says main or someone else's branch, STOP and tell me.
- Never commit or push to main, and never to another person's branch.
- Push the branch at least every hour: `git push -u origin <branch>`.
- One PR per branch, with "Closes #<issue>". Once it's merged, that branch is
  finished: start the next issue's branch from fresh main (don't reuse it).
- A new task that's not in the list (e.g. a bug from issue #31) gets
  pranav/c<checkpoint>-31-<short-description>.

HOW TO WORK WITH ME:
1. Don't write files yet. Give me a plan for C0 + C2, pitch me 10 sample roasts per
   mode and 5 catchphrase ideas so I can pick the vibe, and ask me any questions.
2. After I approve: branch using the exact branch name for the issue from docs/BRANCHES.md
   (pranav/c<checkpoint>-<issue>-<description>, always started from the latest main), small commits, push at least hourly.
3. At each checkpoint: open a PR to main with "Closes #<issue>" (include the accuracy
   score once we have one) and give me a Done / Next / Blocked note for the issue.
Be bold and creative with the comedy. Remy should be memorable.
```
