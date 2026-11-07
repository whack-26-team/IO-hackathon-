# The contract: how the pieces talk to each other

Change this file **first** (in its own PR, tagging everyone) before changing any of it in code.

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
Defined in `remy-brain/actions.json`: `show_tip`, `roast`, `safety_alert`,
`update_step`, `start_timer` (minutes), `cancel_timer`. `live.js` maps each one to
the events above (minutes → seconds).

## 4. Server API
| | Request | Response |
|---|---|---|
| `GET /api/health` | | `{ ok, openai_key_set, model }` |
| `GET /api/recipes` | | `[{ id, title, summary, checked_by_human, steps }]` (steps = count) |
| `GET /api/recipes/{id}` | | full recipe (shape below) |
| `POST /api/session` | `{ recipe_id, mode: "gentle" \| "honest" \| "savage" }` | `{ client_secret, expires_at, model, max_minutes, recipe, mode }` · `503` if no OpenAI key |

## 5. Recipe file shape (`remy-brain/recipes/<id>.json`)
```json
{
  "id": "rigatoni",                 // must equal the file name
  "title": "Rigatoni with tomato & garlic",
  "summary": "…",
  "source": "TheMealDB #12345 / written by …",
  "checked_by_human": false,
  "ingredients": ["200g dried rigatoni", "…"],
  "steps": [
    {
      "instruction": "Add the rigatoni and stir.",
      "looks_right": ["pasta moving freely"],
      "looks_wrong": ["pasta clumped together"],
      "timer": { "label": "Rigatoni", "minutes": 11, "check_at": 10 },  // optional, minutes
      "done_when": "Pasta is in and stirred."
    }
  ]
}
```
`python tools/validate.py` checks this shape.
