# REMY: 24-hour build plan

## Context
We're building **REMY**, an AI chef for the IO Hackathon. You prop up your iPhone, start cooking, and Remy **watches live and talks to you out loud**. It spots mistakes, **starts timers by itself** (rigatoni goes in → an 11-minute al dente timer starts), walks you through any recipe, and has **real personality**, all the way up to a foul-mouthed, roasting hot-head chef when you burn something.

There are 4 people and 24 hours:
- **Matthew & Felix** use **Claude Code**
- **Ahmed & Pranav** use **Codex**, and have the OpenAI access that powers Remy's live brain

All four are already in the `whack-26-team` organisation. The plan has to let everyone work at once without clashing, end up as **something you install on an iPhone like an app**, be readable by non-technical teammates, put **creativity and personality first**, and **question every choice now** so we don't hit problems at 3am.

---

## The big picture, in plain English

| Part | Who | What it does |
|------|-----|--------------|
| 📱 **The app**, what you see | Felix | Live camera, Remy's tip bubble, recipe steps, **timers**, personality picker |
| 🧠 **Remy's live connection**, the "phone call" to the AI | Ahmed | Keeps a live call open to OpenAI. Sends your voice and the camera feed, plays Remy's voice, plus the "second opinion" accuracy check |
| 🎭 **Remy's personality & accuracy testing** | Pranav | How Remy talks in each mode, the roasts, when to stay quiet, plus testing how often Remy is right |
| 🗄️ **Server, recipes & cooking knowledge** | Matthew | Temporary passes for the AI call, the recipe library, the cooking-times and food-safety tables, putting it all online, team coordination |

### How "live" works
1. Tap **Start cooking** (iPhones need one tap before allowing sound and mic).
2. The app gets a **temporary pass** from our server, a key that expires within minutes, so our real OpenAI key never touches the phone.
3. The phone opens a **live call straight to OpenAI** (same tech as video calls). Your voice goes up and Remy's voice comes back instantly, and you can interrupt it.
4. During the call the app sends **a camera picture about every second**. Remy also **hears** the kitchen: sizzling, boiling, a smoke alarm.
5. Remy changes the screen through **actions**: `show_tip`, `update_step`, `safety_alert`, `start_timer`, `roast`.

---

## 🎭 Personality (creativity first)

You pick Remy's attitude on the start screen:

| Mode | Vibe | When you burn the garlic… |
|------|------|---------------------------|
| 😇 **Gentle** | Patient teacher | "Ah, that's caught a bit. Let's turn the heat down and start a fresh batch." |
| 😏 **Honest** (default) | Cheeky, sarcastic | "Well, that garlic is officially charcoal. Bin it, chef." |
| 🤬 **Savage** (18+, swearing on) | Furious, theatrical, foul-mouthed TV-chef energy | A full, sweary roast of the garlic, the pan and your life choices. |

**How we make it actually funny (Pranav):**
- A **roast library** in `remy-brain/personality/`: example lines per mistake type (burning, overcooking, raw, messy station, wrong order, too much salt), so the AI has a style to riff on rather than writing from scratch.
- **Escalation:** first mistake is a light jab, a repeat mistake gets a bigger roast. Remy remembers what you did earlier in the session.
- **Praise too:** a well-seared steak gets over-the-top praise, so the contrast makes the roasts land.
- **Catchphrases unique to Remy**, so it has its own identity.

**⚠️ Boundaries we have to respect:**
- **Roast the cooking, never the person.** No insults about looks, race, gender, weight and so on. It's comedy about burnt garlic, not bullying.
- **Swearing is opt-in** (Savage mode with an 18+ confirm), never the default. That matters for the judges and the demo room too.
- **Safety beats comedy.** On a real danger (fire, oil smoking, knife near fingers, raw chicken), Remy drops the act and says it clearly first. It can roast you *after*.
- **Only roast when sure.** Wrongly yelling "YOU BURNT IT" when you didn't kills the joke and trust. Roasts need high confidence (see Accuracy).
- **Risk:** OpenAI's model may soften or refuse strong swearing. **Pranav tests Savage mode in the first 2 hours.** If it's too tame, we lean on theatrical (but less sweary) insults, plus the swear words in our roast library.

---

## 📖 Recipes: where they come from

**Base data comes from an online recipe database**, so every recipe starts from the same consistent structure instead of whatever an AI makes up:

**Step 1, grab the base recipe from an online database (Matthew).**
- **Main source: [TheMealDB](https://www.themealdb.com/api.php)**, a free recipe API with ~300 dishes (steaks, pastas, curries…). Every dish comes back in the **same format**: name, category, cuisine, a list of up to 20 ingredients with measures, the method, a photo and often a YouTube video. Its free test key is meant for development and education, which fits a hackathon. A public launch would need its paid supporter key.
- **Backup / extra source: [Spoonacular](https://spoonacular.com/food-api)**. Its free tier is limited per day, but it already splits methods into **numbered steps with equipment and lengths** ("boil 11 minutes"), which helps timers.
- **Stretch, "paste a recipe link":** many recipe websites embed a standard machine-readable recipe block (called *schema.org Recipe*: ingredients, steps, cook time). We can read just that block from a link the user pastes, without scraping the whole site.

**Step 2, "Remy-ify" it (adds what the database doesn't have).** Online databases give ingredients and a method, but **not** what each step should *look* like or exact timers. A script sends the base recipe to the AI once and turns it into our step format below (`looks_right`, `looks_wrong`, `timer`, `done_when`). Timer lengths are taken from our **cook-times table** where it has the dish (rigatoni = 11 min), not guessed.

**Step 3, save it and check it.** The result is saved as a file in `remy-brain/recipes/`, so it's only processed once and is the same every time. For the **3 demo dishes (steak, rigatoni, scrambled eggs)** a human double-checks the file. Any other dish works too, but is marked "unchecked".

**⚠️ Questioning this choice:**
- **Database quality varies.** Some TheMealDB methods are one long paragraph, and measures are written loosely ("a pinch"). Step 2 fixes the structure, and the human check covers the demo dishes.
- **The databases are mostly British/American home cooking.** If a dish isn't there, we fall back to the AI writing it in our format, marked "AI-written, unchecked".
- **Don't depend on the internet during the demo.** Demo recipes are saved as files in the repo, so if TheMealDB is down, Remy still works.
- **Licences:** the free keys are for development/non-commercial use. Fine now; recheck before any public launch. We don't copy recipe websites wholesale.

**Every recipe has the same shape** (`remy-brain/recipes/*.json`): ingredients, then steps, and each step has:
- `looks_right`: "pasta floating, water at a rolling boil"
- `looks_wrong`: "foam boiling over", "pasta stuck together"
- `timer`: e.g. `{ "label": "Rigatoni", "minutes": 11, "check_at": 10 }`
- `done_when`: "bite test: firm centre, no white core"

This is the main key to accuracy, because Remy compares what it sees against a specific description, not a vague idea.

**⚠️ Boundary:** an AI-generated recipe can be wrong about temperatures and times. **Food safety numbers (e.g. chicken 75°C, pork 63°C) come from a fixed table we write once**, `remy-brain/knowledge/food-safety.json`, never from the AI. Remy never says "safe to eat" from looks alone. It says "check it with a thermometer".

---

## ⏱️ Automatic timers

- **Cooking-times table** (`remy-brain/knowledge/cook-times.json`): rigatoni 11–13 min, spaghetti 9–11, penne 10–12, steak per side by thickness and doneness, soft-boiled egg 6½ min and so on.
- When Remy **sees** (or **hears you say**) "pasta's in", it triggers `start_timer { label: "Rigatoni", minutes: 11 }`.
- **The app runs the timer, not the AI.** AI can't count time reliably, but the phone can. The app shows a countdown and, at the "check" mark and at the end, **tells Remy**, which then speaks ("taste one now, should be al dente").
- Several timers can run at once (pasta + sauce + garlic bread).
- **Always confirm:** "Starting an 11-minute rigatoni timer. Say 'cancel' if that's wrong." A box says 8 minutes? "Remy, make it 8."

---

## 🎯 Accuracy: how Remy knows something is wrong

Being honest about the limits first: from a phone camera, **some things are easy to see** (smoke, black edges, boiling over, pale vs. browned steak, a knife near fingers) and **some are almost impossible** (pasta being slightly overcooked, a steak's inside). Remy combines several clues:

1. **Timers are the strongest clue for doneness.** Pasta overcooked = the timer passed + it looks swollen or splitting. Remy warns *before* it happens ("2 minutes left, taste one").
2. **Recipe descriptions** (`looks_right` / `looks_wrong`) tell Remy exactly what to look for at each step.
3. **Sound:** sizzle, boil, smoke alarm, and what you say.
4. **Ask you:** "Hold a piece of pasta up to the camera" or "cut the steak open and show me". That's a close-up on demand, like a real chef would ask.
5. **Second opinion check (Ahmed):** every ~10 seconds, and whenever a step is about to finish, a **sharper, high-resolution picture** goes to OpenAI's strongest vision model with a focused question ("Is anything in this pan burning? Answer yes / no / unsure + why"). Its answer is fed back into the live call. The live voice stays fast and the important judgments are more careful.
6. **Confidence rule:** Remy only warns or roasts when it's **sure**. When unsure it asks ("is that smoke or steam?"). It's better to ask than to cry wolf.
7. **Camera setup at the start:** Remy checks it can see the hob ("move the phone left, I can't see the pan"), and good lighting gets a mention.

**How we measure and improve it (Pranav):**
- Record **~10 short real cooking clips** with the moments written down ("garlic burns at 1:42", "pasta done at 11:00").
- A **test script** replays them through Remy and scores **catches** (spotted it), **misses**, and **false alarms** (cried wolf).
- Change Remy's instructions → re-run → keep what scores better. Write the score in the PR so we see progress.

---

## ⚠️ Risks & boundaries: full list

| # | Risk | What we do |
|---|------|-----------|
| 1 | **No AI sees *truly* continuous video yet.** OpenAI's live API takes voice live but video as quick still pictures (no release date for native video). Gemini Live: also 1 picture/sec. | ~1 picture/sec + sound + second-opinion checks. All AI code in one place, so we can switch when native video arrives. |
| 2 | **A ChatGPT/Codex subscription is *not* API access.** The API is a separate pay-as-you-go account at platform.openai.com (Pro/Business may get API credits). | **Ahmed, hour 0:** one team API account, credits or billing, **spending limit** (e.g. $30). Without it Remy can't talk. |
| 3 | **Cost:** live voice is charged per minute, the second-opinion check per picture. | 10-minute session cap, small pictures, pause in background, spending limit as the hard cap. Check the spend after the first test. |
| 4 | **Secret key leaking.** | Only on the server in `.env` (never on GitHub). The phone gets temporary passes only. |
| 5 | **Offensive or harmful roasts.** | Roast cooking not people, swearing opt-in 18+, safety first. |
| 6 | **Wrong food-safety advice.** | Fixed safety table, "use a thermometer", disclaimer on the start screen. |
| 7 | **Privacy:** a camera in someone's kitchen. | Nothing recorded or saved (except the test clips we film ourselves). The start screen says so. |
| 8 | **iPhone quirks:** home-screen apps re-asking permissions, sound needing a tap. | **Test on a real iPhone in hours 1–2.** |
| 9 | **Model names change** (OpenAI renamed and retired models in 2026). | Confirm in official docs. The name is a setting in `.env`. |
| 10 | **Scope creep:** we're asking for a lot in 24h. | Priority list below. Stretch items only after the must-haves work end to end. |
| 11 | **Demo Wi-Fi failing.** | Phone hotspot + recorded backup video. |
| 12 | **Merge clashes** (4 people + 4 AI assistants). | Folder ownership + pull requests only. |

## Priorities (what gets cut if we run late)
- **Must have:** live talk + seeing, 3 demo recipes with steps, auto timers, Honest + Savage modes, safety alerts, home-screen install.
- **Should have:** second-opinion accuracy check, test clips + score, Gentle mode, escalating roasts.
- **Stretch:** pick any TheMealDB dish in the app (auto-imported), "paste a recipe link", multiple simultaneous timers UI polish, session recap ("you burnt 2 things, 6/10").

---

## Who does what

| Person | Assistant | Role | Owns | Done when… |
|--------|-----------|------|------|-----------|
| **Matthew** (lead) | Claude Code | Server, recipes & cooking knowledge, coordination | `server/`, `remy-brain/recipes/`, `remy-brain/knowledge/`, `tools/import_recipe.py` | https link works on iPhone; `/api/session` gives a pass with personality + recipe loaded; recipe importer (TheMealDB → Remy format); 3 checked demo recipes; cook-times + food-safety tables; online on Render; PRs reviewed |
| **Felix** | Claude Code | The app screen & demo | `app/` (not `app/remy/`) | Camera, Start, personality picker (with 18+ confirm), tip bubble, steps, **timer countdowns**, red alert flash, home-screen install; demo script + pitch |
| **Ahmed** | Codex | **Everything live voice**: the live call, Remy's voice, listening to you, sending camera pictures, plus the OpenAI account | `app/remy/`, `server/second_opinion.py` | Talk ↔ Remy live, interruptible; ~1 picture/sec; actions reach the screen; timer events go back to Remy; second-opinion check running; 10-min cap |
| **Pranav** | Codex | **All the insults, roasts, catchphrases & personality modes**, plus accuracy testing | `remy-brain/instructions.md`, `remy-brain/personality/`, `remy-brain/actions.json`, `tests/` | 3 modes written + roast library; Savage tested early; test clips recorded + score script; score improving across PRs |

### How the pieces plug together (written in `docs/CONTRACT.md`)
1. **Ahmed's live connection → Felix's screen** (events): `tip {text, severity}`, `step {current_step, step_complete, next_instruction}`, `alert {text}`, `roast {text, level}`, `timer_start {id, label, seconds, check_at}`, `timer_cancel {id}`, `status {...}`. Felix starts with a **pretend Remy** that fires fake events, so he never waits.
2. **Felix's screen → Ahmed's connection:** `timer_check {id}`, `timer_done {id}`, `mode_changed {mode}`, which are passed on to Remy.
3. **Pranav's & Matthew's brain files → Matthew's server:** combined into Remy's instructions when a call starts (personality mode + recipe + timing/safety tables + actions).
4. **Server → app:** `POST /api/session {recipe_id, mode}` → temporary pass. `GET /api/recipes`.

## 👤 Individual plans

Each person's plan below becomes their GitHub issues (one issue per checkpoint task) on the project board.
**C0–C5** are the checkpoints (see "Checkpoints" below).

### Matthew: Team lead · Server · Recipes & cooking knowledge (Claude Code)
**Your job in one line:** keep the team unblocked and make sure Remy has a solid kitchen behind it: the server, the recipes, and the facts (times, temperatures).
**You own:** `server/`, `remy-brain/recipes/`, `remy-brain/knowledge/`, `tools/`, `docs/`, the project board, merging PRs.
**Don't touch:** `app/`, `app/remy/`, `remy-brain/personality/` (ask the owner).

| Checkpoint | Tasks |
|-----------|-------|
| **C0** (0–1h) | Review and merge Claude's skeleton. Check the board is set up and everyone has their issues. Start the team chat thread for blockers |
| **C1** (1–2h) | Server running locally + **cloudflared https link** so Felix and Ahmed can test on iPhones. Store the OpenAI key in `server/.env` (from Ahmed). `/api/session` returns a real temporary pass |
| **C2** (2–8h) | `tools/import_recipe.py`: fetch a dish from TheMealDB → Remy-ify (steps, `looks_right`/`looks_wrong`, timers) → save. Import + **hand-check steak, rigatoni, scrambled eggs**. Write `cook-times.json` (pasta shapes, steak by thickness/doneness, eggs, rice, veg) and `food-safety.json` (meat/fish/egg safe temps). `/api/session` combines personality mode + recipe + tables + actions into Remy's instructions. `GET /api/recipes` |
| **C3** (8h) | **Run the joining-up session**: everyone's work merged to `main`, first real cook-along. List what broke and assign fixes on the board |
| **C4** (8–16h) | Put it online on **Render** (permanent https link, key stored safely). Fix recipe errors found in testing. Stretch: pick any TheMealDB dish in the app |
| **C5** (16–24h) | Feature freeze, final merge, cost check on OpenAI's usage page, help with pitch (tech slide: how it works) |

**Depends on:** Ahmed for the OpenAI key (C1), Pranav's personality files to load into sessions (C2).
**Others depend on you for:** the https link (C1), `/api/session` (Ahmed, C2), recipe files (everyone, C2).
**Done when:** the iPhone opens a permanent link, a session starts with the right recipe and mode, and the 3 demo recipes are correct.

### Felix: The app screen · Timers · Demo & pitch (Claude Code)
**Your job in one line:** everything the user sees and touches. Make Remy look and feel like a real, fun iPhone app.
**You own:** `app/` (except `app/remy/`), the demo script, pitch slides, the backup video.
**Don't touch:** `app/remy/` (Ahmed), `server/` (Matthew).

| Checkpoint | Tasks |
|-----------|-------|
| **C0** | Pull the skeleton, run it, check the pretend Remy shows tips over the camera on your laptop |
| **C1** | **iPhone risk check:** open Matthew's https link → camera works → Add to Home Screen → still works full screen → sound plays after the Start tap. Report results on the board |
| **C2** | Start screen: recipe picker, **personality picker** (Gentle / Honest / Savage, with an 18+ confirm for Savage), privacy + safety note, big Start button. Cooking screen: full-screen camera, **tip bubble** coloured by severity, big **roast** bubble (shake animation), **red alert flash**, **step list** with ticks, **timers** (`timers.js`: several countdowns, "check" mark, sends `timer_check` / `timer_done`, tap to cancel or adjust). App icon + name for the home screen. Everything works with the pretend Remy |
| **C3** | Swap pretend Remy for Ahmed's real one (one line). Fix whatever looks wrong in the first real cook-along |
| **C4** | Polish: animations, Remy's "speaking" indicator, mode switch mid-cook, session recap screen (stretch). Write the **demo script** (rigatoni with auto timer → burn something on purpose in Savage mode → safety alert) |
| **C5** | Record the **backup demo video**, build pitch slides, rehearse the demo twice |

**Depends on:** Matthew's https link (C1), Ahmed's real connection (C3).
**Others depend on you for:** the iPhone check results (everyone, C1), the demo (C5).
**Done when:** someone who's never seen it can install it from the home screen and cook with it without help.

### Ahmed: Everything live voice · OpenAI account (Codex)
**Your job in one line:** Remy's ears, eyes and mouth. The live call to OpenAI that hears you, sees the pan and talks back instantly.
**You own:** `app/remy/` (`live.js`, `mock.js`), `server/second_opinion.py`, the OpenAI API account + spending limit.
**Don't touch:** `app/` screens (Felix), `remy-brain/` (Matthew/Pranav).

| Checkpoint | Tasks |
|-----------|-------|
| **C0** | **Hour 0, top priority:** create the team OpenAI **API** account (platform.openai.com, separate from ChatGPT), add credits, **set a $30 spending limit**, and give the key to Matthew privately (not in chat or GitHub). Confirm the current live/realtime model name in OpenAI's docs |
| **C1** | Smallest possible test: phone → live call → you say "hello", Remy answers out loud. Check you can interrupt it |
| **C2** | `live.js`: get a temporary pass from `/api/session` → open the live call → send mic audio, play Remy's voice → send **a camera picture about every second** (small, ~512px) → turn Remy's actions (`show_tip`, `update_step`, `safety_alert`, `roast`, `start_timer`) into the agreed events for Felix's screen → pass Felix's `timer_check` / `timer_done` back to Remy → **10-minute auto stop**, pause when the app is hidden, reconnect if the call drops. Keep `mock.js` working the same way |
| **C3** | Joining-up: real call with Felix's screen and Matthew's server. Measure the delay (something happens → Remy reacts) |
| **C4** | `second_opinion.py`: every ~10s and at step ends, send a sharp picture to OpenAI's strongest vision model with a focused question ("is anything burning? yes/no/unsure + why") and feed the answer into the live call. Tune picture size and frequency against cost and speed |
| **C5** | Reliability: test on venue Wi-Fi + phone hotspot, check what happens on errors (it must show a message, never just go silent), final cost check |

**Depends on:** Matthew's `/api/session` (C2), Pranav's `actions.json` (C2).
**Others depend on you for:** the OpenAI key (Matthew, C0), real Remy (Felix, C3).
**Done when:** you can cook for 10 minutes talking to Remy, it reacts to the pan within ~2 seconds, and nothing crashes.

### Pranav: Insults, roasts, catchphrases & personality · Accuracy testing (Codex)
**Your job in one line:** make Remy hilarious and right, so people want to cook with it and believe what it says.
**You own:** `remy-brain/instructions.md`, `remy-brain/personality/` (all modes, roasts, catchphrases), `remy-brain/actions.json`, `tests/`.
**Don't touch:** `server/`, `app/` (ask the owner).

| Checkpoint | Tasks |
|-----------|-------|
| **C0** | Read the contract. Draft Remy's core rules in `instructions.md`: short sentences, one tip at a time, stay quiet when all's well, safety first, only roast when sure, ask when unsure |
| **C1** | **Savage-mode swearing test**: does OpenAI's live model actually swear and roast with our instructions? Report on the board. If it's too tame, adjust the approach early |
| **C2** | `personality/gentle.md`, `honest.md`, `savage.md`: tone, vocabulary, example lines. **`roasts.json`**: lines per mistake (burning, overcooked, undercooked, raw, too much salt, messy station, wrong order, slow), **3 escalation levels** each (first jab → repeat-offender meltdown), plus over-the-top **praise** lines. **Remy's catchphrases** (opening line, sign-off, "step complete" line, a signature roast). `actions.json`: when Remy should use each action. **Film ~10 short cooking clips** (burnt garlic, overboiling pasta, a good steak sear, knife near fingers, nothing happening) and write `labels.json` (what happens and when) |
| **C3** | Joining-up: first real cook-along. Note every wrong call, missed mistake, and roast that fell flat |
| **C4** | `tests/score.py`: replay the clips through Remy and count **catches / misses / false alarms**. Rounds of: change instructions → re-score → keep what's better (post the score in every PR). Tune roast timing so it doesn't repeat itself |
| **C5** | Lock the final personality. Pick the 3 best roasts for the live demo with Felix |

**Depends on:** Ahmed's live call to test with (C1/C3).
**Others depend on you for:** `actions.json` (Ahmed, C2), personality files (Matthew, C2).
**Done when:** the Savage roasts make the team laugh, safety alerts never get buried in jokes, and the accuracy score improved from the first round to the last.

---

## 📋 Project board (track progress even when apart)

A **GitHub Project** board for the `whack-26-team` organisation, which everyone can see on phone (GitHub app) or laptop:

- **Columns:** 📥 To do → 🔨 In progress → 👀 In review (PR open) → ✅ Done · plus 🚧 **Blocked**
- **Fields on every card:** Owner (Matthew / Felix / Ahmed / Pranav), Checkpoint (C0–C5), Priority (Must / Should / Stretch)
- **Views:** "By person" (each person's own list), "By checkpoint" (what's due next), "Blocked" (what needs help)
- **Automatic updates:** cards move on their own. An issue added → To do, a PR opened → In review, a PR merged → Done (GitHub's built-in board workflows)
- **Async check-ins:** at every checkpoint each person posts a 3-line comment on their issue: **Done / Next / Blocked**. Anyone can catch up without a call.

**⚠️ Questioning this:** Claude may not have permission to create org-wide project boards (that needs an extra GitHub permission). Claude will try. If it's refused, Matthew creates the empty board in ~1 minute (org page → Projects → New project → Board), and Claude fills it with the issues and fields. GitHub usernames for Felix, Ahmed and Pranav are still needed to assign cards. Otherwise they're created unassigned and people self-assign.

## 💾 Saving work to GitHub: checkpoints

**Checkpoints** (also set up as GitHub **milestones**, so the board shows progress per checkpoint):

| | When | Goal |
|--|------|------|
| **C0** | 1h | Skeleton in, everyone set up |
| **C1** | 2h | Risk checks done (iPhone, live call, swearing test) |
| **C2** | 8h | Each person's part works on its own |
| **C3** | 8–9h | Joined up: first real cook-along |
| **C4** | 16h | Feature freeze |
| **C5** | 20h | Demo-ready, online, backup video |

**The saving rules:**
1. **Save often:** commit after every small working change.
2. **Upload your branch at least every hour**, so work is never only on one laptop (and the cloud sessions can be wiped).
3. **At every checkpoint:** open or update your pull request, post your Done/Next/Blocked note, and Matthew merges into `main` so **everyone syncs to the same version**.
4. **Never merge broken code into `main`.** If it isn't working by the checkpoint, merge what works and move the rest to the next checkpoint.
5. **Claude follows the same rules:** after each piece of work it commits and pushes to its branch, and opens or updates a PR at each checkpoint. (The skeleton is the only direct push to `main`.) The same rules are written into `AGENTS.md`, so Codex follows them too.
6. **Optional safety net:** a small GitHub check runs on every pull request (basic "does the server start / are the recipe files valid"), so broken work gets flagged before merging.

---

## Getting it onto the iPhone as an app
- **Hackathon:** an installable web app. Safari → Share → **Add to Home Screen** gives an icon and full screen. No App Store or Mac needed.
- **Later:** a real App Store app in Swift (Mac + $99/yr Apple developer account). The server, brain files and AI design all carry over, and only the screen is rebuilt.

## Codex & Claude Code side by side
- **`AGENTS.md`** (Codex reads it automatically) is the one rulebook: what Remy is, folder ownership, the contract, how to run it, the boundaries above (personality rules, never commit `.env`), branch + PR rules.
- **`CLAUDE.md`** says "follow AGENTS.md", so there's one rulebook.
- **Each person's GitHub issue** has a plain-English goal, a checklist, and a "paste this into Codex/Claude to start" prompt.

## GitHub rules (plain version)
- **`main`** = the working version. Nobody edits it directly.
- Own **branch** per task (e.g. `pranav/savage-mode`) → **pull request** → a quick teammate review (Matthew by default) → merge.
- Claude switches to this too after the initial skeleton, which is the one direct push.
- **Needed:** Felix's, Ahmed's and Pranav's **GitHub usernames** so Claude can assign their issues (or Claude creates them unassigned and people self-assign).

## Folder layout
```
AGENTS.md  CLAUDE.md  README.md  .gitignore
docs/        CONTRACT.md  SETUP.md (non-technical)  RISKS.md
server/      main.py  second_opinion.py  requirements.txt  .env.example
app/         index.html  app.js  timers.js  style.css  manifest.json  icon.png
app/remy/    live.js  mock.js
remy-brain/  instructions.md  actions.json
             personality/  gentle.md  honest.md  savage.md  roasts.json
             recipes/      steak.json  rigatoni.json  scrambled-eggs.json
             knowledge/    cook-times.json  food-safety.json
tools/       import_recipe.py   (TheMealDB/Spoonacular → Remy recipe format)
tests/       clips/ (not committed, too big; shared drive)  labels.json  score.py
```
Remove GitHub's demo leftovers (`index.html`, `package.json`, the "Proof HTML" check, and the "Auto Assign" robot that gives every task to matthew-jm8).

## Timeline (24h)
| When | What |
|------|------|
| **0–1h** | Claude pushes the skeleton. **Ahmed:** OpenAI API account + limit. Issues created, branches started |
| **1–2h** | **Early risk checks:** iPhone home-screen install, camera + mic + sound; **Savage mode swearing test** |
| 2–8h | Everyone builds their part (Felix on pretend Remy; Pranav films test clips) |
| **8h, first joining-up** | Real Remy in. First real cook-along: rigatoni with auto timer |
| 8–16h | Second-opinion check, roast tuning, accuracy scoring rounds, polish |
| 16–20h | Feature freeze, online, cost check, backup demo video |
| 20–24h | Pitch practice, plus spare time |

## What Claude does once you approve
1. Push the skeleton to `main`: the folders; a server with `/api/session` (it shows a clear message until the OpenAI key is added); the app with camera + pretend Remy firing tips, roasts and a working **timer countdown**; starter brain files (3 recipe outlines in the agreed shape, cook-times and safety table starters, 3 personality files); `AGENTS.md`, `CLAUDE.md`, `docs/`; the README renamed to REMY; the demo-file clean-up.
2. Create the **project board** (or fill the one Matthew creates), the **C0–C5 milestones**, and **one issue per person per checkpoint** from the individual plans above, each with a checklist and a copy-paste starter prompt for Codex/Claude, plus labels (`matthew`, `felix`, `ahmed`, `pranav`, `must`/`should`/`stretch`, `blocked`).
3. Add the small pull-request check (server starts, recipe files valid).
4. From then on, work on branches with PRs and push at the checkpoints.

## How we'll check it works
- **Skeleton:** start the server, open the app in a headless browser with a fake camera, and confirm the camera shows, pretend-Remy tips and roasts appear, a pretend `timer_start` shows a countdown and fires `timer_done`, and `/api/session` returns the right shape or a clear "key missing" message. Check every recipe file matches the agreed shape.
- **Real Remy (8h):** on an iPhone, put rigatoni in, then confirm the timer starts by itself and Remy calls the taste check at 10 min. Burn some bread on purpose: Remy warns (Honest) or roasts (Savage). Hold a knife near your fingers: the safety alert beats the jokes.
- **Accuracy score:** `tests/score.py` gives catches / misses / false alarms on the labelled clips, reported in each PR from Pranav.
- **Costs:** check OpenAI's usage page after a 10-minute session.
