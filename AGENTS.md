# AGENTS.md: rulebook for AI coding assistants (Codex, Claude Code) and humans

Read this fully before making changes. Full plan: `docs/PLAN.md`. Each person's role and starter prompt: `ROLES/<name>.md`.

**Before you start work, check `docs/TEAM-TODO.md`**: it lists changes the team has decided that are waiting in *your* files.

## What we're building
**REMY**, a live AI chef. An iPhone (installable web app) streams the camera and mic
to an AI model (voice route chosen by Ahmed, see docs/PLAN.md "Voice options"). Remy talks back, spots mistakes, starts timers itself,
guides the recipe, and has personality modes (Gentle / Honest / Savage).

## Who owns what: ONLY edit your own folder
| Folder / file | Owner |
|---|---|
| `server/` (except `second_opinion.py`), `remy-brain/recipes/`, `remy-brain/knowledge/`, `tools/`, `docs/`, `ROLES/` | **Matthew** (Claude Code) |
| `app/` (except `app/remy/`, `app/demo/`, `app/extras/`) | **Matthew** (Claude Code), taken over from Felix |
| `app/demo/` (demo mode), `app/extras/` (mode switch, setup guide), `docs/pitch/` (slides) | **Felix** (Claude Code) |
| `app/remy/`, `server/second_opinion.py` | **Ahmed** (Codex) |
| `remy-brain/instructions.md`, `remy-brain/actions.json`, `remy-brain/personality/`, `tests/` | **Pranav** (Codex) |

If your task needs a change in someone else's folder, **don't make it**. Leave a
comment on their GitHub issue or PR describing the change instead.

## The contract (don't break it)
`docs/CONTRACT.md` defines the events between the live connection and the screen,
the `/api/session` request/response, and the recipe file shape. If you need to
change it, open a PR that changes `docs/CONTRACT.md` first and tag everyone.

## How to run
```bash
pip install -r server/requirements.txt
cp server/.env.example server/.env    # add OPENAI_API_KEY (get it from Ahmed, privately)
uvicorn server.main:app --reload --port 8000
# open http://localhost:8000  ("Pretend Remy" works without any key)
python tools/validate.py              # check brain files before committing
```
The iPhone needs **https** for the camera. Use `cloudflared tunnel --url http://localhost:8000`.

## Git rules
- **Never commit to `main` directly.** One branch per issue, named `<name>/c<checkpoint>-<issue>-<short-description>`,
  e.g. `felix/c2-9-app-screens`. Exact names for every issue: `docs/BRANCHES.md`.
- Always start a new branch from the latest `main`. Once a branch is merged, it's finished: start a fresh one.
- **Before every commit, run `git branch --show-current`.** It must be one of *your* branches
  (starting with your name). If it's `main` or a teammate's branch, stop and ask, and never commit there.
- Commit small and often. **Push your branch at least every hour.**
- At every checkpoint (C0–C5, see `docs/PLAN.md`): open/update your PR, link your
  issue (`Closes #N`), and post a Done / Next / Blocked comment on your issue.
- Never merge broken code to `main`. `python tools/validate.py` must pass.
- **PRs merge themselves** when the checks pass and you only changed your own folders (no secrets).
  Open a **draft** PR while still working, and mark it "Ready for review" when it's done. If a change must
  touch someone else's folder, the PR waits for Matthew (`needs-review` label). Details: `docs/BRANCHES.md`.
- **Never commit secrets.** `server/.env` is git-ignored; keep it that way. Don't
  paste keys in issues, PRs or chat. The phone only ever gets short-lived passes.

## Remy's behaviour boundaries (apply to all prompt/personality work)
- Safety beats comedy: real danger → clear `safety_alert` first, jokes after.
- Only warn/roast when confident; ask when unsure.
- Roast the cooking, never the person's identity or body.
- Swearing only in Savage mode (18+ opt-in).
- Food safety temperatures come only from `remy-brain/knowledge/food-safety.json`.
- Timers come from the recipe step or `cook-times.json`, never guessed. The
  **phone** counts time, not the AI.

## Code style
Keep it simple and readable for beginners: plain HTML/JS (no build step), Python
3.11+, FastAPI. Comment *why*, in plain English.
