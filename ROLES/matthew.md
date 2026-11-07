# Matthew: team lead · server · recipes & cooking knowledge

## 📩 Note to self
You keep the team unblocked: merging PRs, running the joining-up session, and making sure Remy has a solid kitchen behind it (server, recipes, cooking times, food-safety facts). Your issues are #1–#6.

**First:** create the org project board (issue #1), merge PR #25 once you've read it, and send each teammate their file from `ROLES/`.

🌿 **Your branches:** `matthew/…`, one per issue (see `docs/BRANCHES.md`).

## 🤖 Prompt to paste into Claude Code
```
I'm Matthew, team lead on a 4-person hackathon team building REMY: a live AI chef
that watches you cook through an iPhone camera, talks to you, roasts your mistakes,
and starts cooking timers automatically. I use Claude Code. Two teammates use Codex.

FIRST, read these files fully before doing anything:
- AGENTS.md (team rulebook)
- docs/PLAN.md (whole plan; my section is "Matthew: Team lead · Server · Recipes")
- docs/CONTRACT.md (the API my server must provide)
- server/main.py (my server: /api/recipes, /api/session, serves the app)
- tools/import_recipe.py, tools/validate.py (my tools)
- remy-brain/recipes/*.json, remy-brain/knowledge/*.json (my data files)

MY ROLE: team lead + the "back office": server, https link, deployment, recipes,
cooking-times and food-safety facts, merging PRs.

I OWN: server/ (except second_opinion.py), remy-brain/recipes/, remy-brain/knowledge/,
tools/, docs/. I must NOT edit app/, app/remy/, remy-brain/personality/ or
remy-brain/instructions.md (Felix, Ahmed and Pranav own those).

MY CHECKPOINTS (GitHub issues #1–#6):
- C0 (#1): project board set up, team onboarded, PRs reviewed.
- C1 (#2): cloudflared https link for iPhone testing; API key (from Ahmed, whichever
  voice route he picks) in server/.env; /api/session works for that route. If Ahmed
  picks a cheaper route (phone speech + cheap vision model, or Gemini Live), help
  add the server route he needs.
- C2 (#3): run tools/import_recipe.py on my laptop (TheMealDB is blocked in Claude's
  cloud sessions) for steak, pasta and eggs; add the "Remy-ify" step (fill
  looks_right / looks_wrong / done_when, timers from cook-times.json); hand-check
  the 3 demo recipes and set checked_by_human: true; expand cook-times.json; verify
  food-safety.json against USDA / UK FSA guidance; validate.py passes.
- C3 (#4): run the joining-up session: merge everyone's C2 PRs, first real cook-along,
  log what broke as new issues.
- C4 (#5): deploy to Render (start: uvicorn server.main:app --host 0.0.0.0 --port $PORT,
  key as a Render secret); fix recipe issues; stretch: pick any TheMealDB dish in-app.
- C5 (#6): feature freeze, final merge, cost check, "how it works" pitch slide.

MY DEDICATED BRANCHES (one per issue; exact names, don't invent others):
- C0 (#1): matthew/c0-1-setup
- C1 (#2): matthew/c1-2-https-session
- C2 (#3): matthew/c2-3-recipes
- C3 (#4): matthew/c3-4-joining-up
- C4 (#5): matthew/c4-5-deploy-render
- C5 (#6): matthew/c5-6-freeze
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
  matthew/c<checkpoint>-31-<short-description>.

HOW TO WORK WITH ME:
1. Plan first for my current checkpoint and ask me questions before coding.
2. Branch using the exact branch name for the issue from docs/BRANCHES.md
   (matthew/c<checkpoint>-<issue>-<description>, always started from the latest main), small commits, push at least hourly, PR to main with
   "Closes #<issue>".
3. When reviewing teammates' PRs: check the automatic check passed, they only touched
   their own folders, no secrets were committed, and the contract wasn't changed
   without agreement.
```
