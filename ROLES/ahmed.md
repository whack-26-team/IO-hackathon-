> **📌 Waiting for you:** check [`docs/TEAM-TODO.md`](../docs/TEAM-TODO.md) for changes the team has decided that need doing in your files.

# Ahmed: everything live voice (Remy's ears, eyes and mouth)

## 📩 Message to Ahmed
> Hey Ahmed! You're building **the connection between the phone and the AI**: Remy hearing you, seeing the pan, and talking back. You're also **choosing how we do the voice**, so we don't overspend.
>
> **You don't have to use OpenAI's expensive live voice.** There are cheaper routes (see "Voice options" in `docs/PLAN.md`): the phone's free built-in speech + a cheap vision model, or Google's Gemini Live free tier. Try them quickly and pick what works. Felix's screen doesn't care which route you choose, because it just listens for the same events.
>
> **To start:**
> 1. Open the repo `whack-26-team/IO-hackathon-` in Codex (connect GitHub and approve the `whack-26-team` org if asked)
> 2. Paste the prompt below and ask for a plan before any code
> 3. Your tasks are issues #13–#18 on GitHub (filter "Assigned to me")
>
> ⚠️ A ChatGPT/Codex subscription doesn't include API calls, so whatever route you pick needs an API key (free tier or with a spending limit). Send it to Matthew **privately**, never in GitHub or group chat.

> 🌿 **Your branches:** you work only on your own branches, one per issue, all starting with `ahmed/` (e.g. `ahmed/c2-15-voice-connection`). The exact names are in your issues and in `docs/BRANCHES.md`. Never push to `main`.

## 🤖 Prompt to paste into Codex
```
I'm Ahmed, on a 4-person hackathon team building REMY: a live AI chef that watches
you cook through an iPhone camera, talks to you out loud, roasts your mistakes, and
starts cooking timers automatically. I use Codex. Two teammates use Claude Code.

FIRST, read these files fully before doing anything:
- AGENTS.md (team rulebook: folder ownership, git rules, Remy's behaviour boundaries)
- docs/PLAN.md, especially "Voice options", "How live works", "Accuracy", and my
  section "Ahmed: Everything live voice"
- docs/CONTRACT.md (the exact events my code must send to the screen and receive back)
- app/remy/mock.js (pretend Remy: my code must have the SAME interface {on, send, start, stop})
- app/remy/live.js (untested starter for route C, OpenAI realtime over WebRTC)
- app/app.js (how the screen creates and uses Remy. I don't edit it, but I need to understand it)
- server/main.py (/api/session builds Remy's instructions + tools. Matthew owns it)
- remy-brain/actions.json (the tools/actions Remy can call: show_tip, roast,
  safety_alert, update_step, start_timer, cancel_timer)

MY ROLE: Remy's ears, eyes and mouth. Get the cook's voice and camera pictures to an AI
model, and get Remy's voice + actions back to the screen, cheaply and reliably.

I OWN: app/remy/ and server/second_opinion.py. I must NOT edit app/ screens (Felix),
server/main.py (Matthew) or remy-brain/ (Pranav/Matthew). If I need a server route
or a change there, draft the exact change for the owner instead.

VOICE ROUTES (I choose at C0, cheapest that works well enough):
- A: iPhone Safari's built-in speech recognition (listening) + speechSynthesis
  (Remy's voice), both free. Send text + a camera picture every ~2s to a cheap,
  fast vision model. Probably needs a small server route to keep the API key secret.
- B: Gemini Live API (live voice + ~1 fps video), free tier for development.
- C: OpenAI realtime over WebRTC (starter in live.js), most natural, most expensive.
- D: a mix (e.g. A/B while building, C only for the demo).
Whatever the route, keep the API key on the server only (server/.env). The phone
must never hold the real key.

MY CHECKPOINTS (GitHub issues #13–#18):
- C0 (#13): quickly test route A on an iPhone (does Safari speech recognition work
  reliably?), look at B's free tier and limits, compare with C. Recommend a route
  with pros/cons/cost and draft the decision comment. Get the key that route needs.
- C1 (#14): smallest working voice test on the chosen route: I say hello, Remy answers
  out loud on an iPhone. Measure reply delay and note how interrupting works.
- C2 (#15): full connection in app/remy/ (e.g. cheap.js for A/B, or live.js for C):
  camera pictures (~512px; ~1/s for live routes, ~every 2s for A), Remy's actions →
  the screen events in docs/CONTRACT.md, timer_check/timer_done passed back to Remy,
  10-minute session cap, pause when the app is hidden, recover from dropped
  connections, clear error messages (never silent). Keep mock.js in sync.
- C3 (#16): joining-up with Felix's screen + Matthew's server; measure "something
  happens → Remy reacts" (target ~2s).
- C4 (#17): second-opinion check (plan in server/second_opinion.py): every ~10s / at
  step ends, a sharper picture to a stronger vision model with a yes/no/unsure
  question, answer fed back into the conversation. Balance cost vs accuracy.
- C5 (#18): reliability on venue Wi-Fi + hotspot, error handling, final cost check.

CONSTRAINTS:
- Don't change docs/CONTRACT.md events without telling me first (the team must agree).
- Plain JS in app/remy/ (no build step). Python/FastAPI on the server side.
- Model names and APIs changed a lot in 2026: check the provider's CURRENT official
  docs rather than relying on memory, and keep model names in server/.env.
- Cost matters: small images, only send when useful, spending limits on keys.
- Safety alerts must never be delayed or swallowed by other messages.

MY DEDICATED BRANCHES (one per issue; exact names, don't invent others):
- C0 (#13): ahmed/c0-13-voice-route
- C1 (#14): ahmed/c1-14-voice-test
- C2 (#15): ahmed/c2-15-voice-connection
- C3 (#16): ahmed/c3-16-latency
- C4 (#17): ahmed/c4-17-second-opinion
- C5 (#18): ahmed/c5-18-reliability
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
  ahmed/c<checkpoint>-31-<short-description>.

HOW TO WORK WITH ME:
1. Don't write code yet. Give me a plan for C0 (comparing routes A/B/C with cost,
   effort and quality) and ask me any questions.
2. After I approve: branch using the exact branch name for the issue from docs/BRANCHES.md
   (ahmed/c<checkpoint>-<issue>-<description>, always started from the latest main), small commits, push at least hourly.
3. Test with the real server: uvicorn server.main:app --reload --port 8000, and on
   an iPhone via Matthew's https link.
4. At each checkpoint: open a PR to main with "Closes #<issue>" and give me a
   Done / Next / Blocked note to post on the issue.
Explain your reasoning simply, including any cost implications.
```
