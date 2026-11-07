# The contract: how the pieces talk to each other

Change this file **first** (in its own PR, tagging everyone) before changing any of it in code.

> **How a session starts (no recipe picker):** the cook picks an attitude and presses **Start cooking**.
> Remy greets them, checks the camera, and asks what they'd like to cook. When they say it, Remy calls
> **`find_recipe`**. If it's one of our hand-checked recipes, that's used. Otherwise **Remy writes the
> recipe itself** with **`create_recipe`**, and the server safety-checks it (fixes timers from our table,
> marks estimates, attaches safe temperatures). Either way the screen gets a **`recipe`** event with the steps.

## 1. Remy → screen (events)
Both `app/remy/mock.js` (pretend) and `app/remy/live.js` (real) expose:
```js
const remy = createXRemy({ recipe, mode, stream, video, canvas });
remy.on(type, handler);   // listen
remy.send(type, data);    // tell Remy something
remy.start(); remy.stop();
```
Events Remy sends to the screen:

| type | data | screen shows |
|---|---|---|
| `recipe` | `{ recipe, source: "remy" \| "ai", checked_by_human }` (after `find_recipe` finds ours, or `create_recipe` succeeds). AI recipes have `recipe.safety` (safe temps) and timers may have `estimate: true` | shows the title, ingredients and step list |
| `status` | `{ status: "connecting" \| "live" \| "remy-speaking" \| "stopped" \| "error", message }` | status pill |
| `tip` | `{ text, severity: "info" \| "warning" \| "urgent" }` | tip bubble |
| `roast` | `{ text, level: 1 \| 2 \| 3 }` | big shaking roast bubble |
| `alert` | `{ text }` | red full-screen flash |
| `step` | `{ current_step, step_complete, next_instruction }` | step list ticks |
| `timer_start` | `{ id, label, seconds, check_at }` (`check_at` = seconds from start) | countdown |
| `timer_cancel` | `{ id }` | removes countdown |

## 2. Screen → Remy (`remy.send`)
| type | data |
|---|---|
| `timer_check` | `{ id, label }` |
| `timer_done` | `{ id, label }` |
| `mode_changed` | `{ mode }` |

## 3. Remy's actions (OpenAI tools)
Defined in `remy-brain/actions.json`: `find_recipe`, `create_recipe`, `show_tip`, `roast`, `safety_alert`,
`update_step`, `start_timer` (minutes), `cancel_timer`. `live.js` maps each one to
the events above (minutes → seconds).

Two actions need an answer from the server, which the live connection passes back to Remy as the tool output:
- **`find_recipe { dish }`**: call `GET /api/recipes/find?q=<dish>`. If `found`, emit `recipe` (source `remy`).
- **`create_recipe { title, ingredients, steps, ... }`**: call `POST /api/recipes/ai` with `{ "recipe": <the arguments> }`.
  If `ok`, emit `recipe` with the **returned** (checked) recipe, source `ai`.

## 4. Server API
| | Request | Response |
|---|---|---|
| `GET /api/health` | | `{ ok, openai_key_set, model }` |
| `GET /api/recipes` | | `[{ id, title, summary, checked_by_human, steps }]` (steps = count) |
| `GET /api/recipes/find?q=` | the cook's words, e.g. `I want steak` | `{ found, source, checked_by_human, recipe?, reference?, message }`. `found` = one of our hand-checked recipes. If not, `message` tells Remy to write its own (`reference` = optional TheMealDB recipe to adapt) |
| `POST /api/recipes/ai` | `{ recipe: { title, ingredients, steps, ... } }` (from `create_recipe`) | `{ ok, recipe, changes, warnings, message }`: cleaned recipe with corrected timers, `estimate` flags and `safety` temps |
| `GET /api/recipes/{id}` | | full recipe (shape below) |
| `POST /api/brain` | `{ mode, recipe_id? }` (no `recipe_id` = Remy asks what to cook) | `{ instructions, tools, recipe, mode, max_minutes }`: Remy's brain for **any** voice route, no AI key needed |
| `POST /api/vision/look` | `{ image: <JPEG base64 / data: URL, ≤1.5 MB>, step?: <current recipe step>, question? }` | `{ summary, can_see_cooking, camera_tip, observations[], issues[{type, detail, confidence}], safety, step_done, answer, model, ms, at }`: **Remy's eyes** (Gemini). Send ~1 picture every 2–3 s (429 if faster). Feed it to the voice as context, act on `issues` with confidence ≥ 0.6, and treat `safety` as urgent |
| `POST /api/session` | `{ mode: "gentle" \| "honest" \| "savage", recipe_id? }` (no `recipe_id` = Remy asks) | `{ client_secret, expires_at, model, max_minutes, recipe, mode }` · `503` if no OpenAI key |

## 5. Recipe file shape (`remy-brain/recipes/<id>.json`)
```json
{
  "id": "rigatoni",                 // must equal the file name
  "title": "Rigatoni with tomato & garlic",
  "summary": "…",
  "aliases": ["pasta", "tomato pasta"],   // what a cook might say; used by find_recipe
  "source": "TheMealDB #12345 / written by …",
  "checked_by_human": false,
  "ingredients": ["200g dried rigatoni", "…"],
  "steps": [
    {
      "instruction": "Add the rigatoni and stir.",
      "looks_right": ["pasta moving freely"],
      "looks_wrong": ["pasta clumped together"],
      "timer": { "label": "Rigatoni", "minutes": 11, "check_at": 10,     // optional, minutes
                 "from": "pasta_dried_minutes_al_dente/rigatoni/default" }, // the cook-times.json entry it comes from
      "done_when": "Pasta is in and stirred."
    }
  ]
}
```
`python tools/validate.py` checks this shape. Recipes marked `checked_by_human: true` must have
`looks_right` / `looks_wrong` / `done_when` on every step, and every timer must match the
`cook-times.json` entry named in `from`. Raw imports live in `remy-brain/recipes/_imported/` and
aren't listed in the app.
