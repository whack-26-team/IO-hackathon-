# Felix: the app screen, timers, demo & pitch

## 📩 Message to Felix
> Hey Felix! You're building **everything the user sees and touches** in REMY: the start screen, the live camera view, Remy's tip and roast bubbles, the red safety alert, the recipe steps and the cooking timers. You also own the demo and pitch at the end.
>
> A working starter version is already in the repo, with a **pretend Remy** that fires fake tips, roasts and timers, so you don't have to wait for anyone.
>
> **To start:**
> 1. Connect your GitHub at https://claude.ai/connect-github
> 2. Start a Claude Code session on `whack-26-team/IO-hackathon-` (claude.ai/code, or `claude` in the cloned folder on your laptop)
> 3. Switch to **plan mode**, paste the prompt below, and plan before building
> 4. Your tasks are issues #7–#12 on GitHub (filter "Assigned to me")
>
> Rule of thumb: only edit `app/` (not `app/remy/`, that's Ahmed's), work on your own branch, push every hour, open a PR at each checkpoint.

## 🤖 Prompt to paste into Claude Code
```
I'm Felix, on a 4-person hackathon team building REMY: a live AI chef that watches
you cook through an iPhone camera, talks to you, roasts your mistakes, and starts
cooking timers automatically. I use Claude Code. Two teammates use Codex.

FIRST, read these files fully before doing anything:
- AGENTS.md (team rulebook: folder ownership, git rules, Remy's behaviour boundaries)
- docs/PLAN.md (whole plan; my section is "Felix: The app screen · Timers · Demo & pitch")
- docs/CONTRACT.md (the events my screen receives from Remy and sends back)
- app/index.html, app/app.js, app/timers.js, app/style.css (the starter I'm building on)
- app/remy/mock.js (pretend Remy, which I test against. I may tweak its fake-event script)

MY ROLE: everything the user sees and touches. A working installable iPhone web app
(Safari → Share → Add to Home Screen, opens full screen like a real app).

I OWN: app/ (except app/remy/, which is Ahmed's). I must NOT edit server/, app/remy/live.js
or remy-brain/. If I need something changed there, draft a comment for the owner's GitHub issue.

MY CHECKPOINTS (GitHub issues #7–#12):
- C0 (#7): run the app locally (docs/SETUP.md), confirm pretend Remy works.
- C1 (#8): iPhone risk check on Matthew's https link: camera works, Add to Home Screen
  works full screen, camera still works there, sound plays after the Start tap.
  Write up results for the issue.
- C2 (#9), the main build, all working with pretend Remy:
  * Start screen: recipe picker (shows "unchecked" recipes), personality picker
    (Gentle / Honest / Savage, with an 18+ confirm for Savage), privacy + safety note,
    big Start button (this tap unlocks sound/mic on iPhone, keep it).
  * Cooking screen: full-screen rear camera; tip bubble coloured by severity
    (info/warning/urgent); big shaking roast bubble (bigger for level 2/3 roasts);
    red full-screen safety alert flash; step list with ticks and "Step X of Y".
  * Timers (app/timers.js): several at once, a "check" moment, emits timer_check and
    timer_done back to Remy, tap to cancel, and ADJUST time (e.g. "make it 8 minutes").
  * App icon + name for the home screen. Looks good on iPhone sizes, safe areas respected.
  * A "Remy is speaking" indicator driven by the status event.
- C3 (#10): swap pretend Remy for the real one (untick "Pretend Remy") and fix what
  looks wrong in the first real cook-along.
- C4 (#11): polish (animations, mode switch mid-cook, stretch: session recap screen
  "you burnt 2 things, 6/10") + write the demo script: rigatoni with the auto timer →
  burn something on purpose in Savage mode → safety alert beats the jokes.
- C5 (#12): backup demo video, pitch slides, rehearse.

CONSTRAINTS:
- Plain HTML/CSS/JS, no build step, no frameworks (teammates must be able to read it).
- Don't change the event names/shapes in docs/CONTRACT.md. If I truly need a change,
  stop and tell me so I can agree it with the team first.
- Must work in iPhone Safari AND as a home-screen app. The camera needs https.
- Safety alerts must always be visually stronger than roasts.
- Nothing is recorded or saved; keep the privacy note on the start screen.

HOW TO WORK WITH ME:
1. Don't code yet. First, give me a short plan for my CURRENT checkpoint (start with
   C0/C1, then C2), broken into small steps, and ask me any questions.
2. After I approve: create the branch named for the issue in docs/BRANCHES.md
   (felix/c<checkpoint>-<issue>-<description>, from the latest main), make small commits, and push
   at least every hour.
3. After each change, run the server (uvicorn server.main:app --reload --port 8000)
   and check it in the browser with pretend Remy.
4. At the checkpoint: open a PR to main that says "Closes #<issue>", with screenshots,
   and write me a Done / Next / Blocked note to post on the issue.
Explain things simply. I'm learning as I go.
```
