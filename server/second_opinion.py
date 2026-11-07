"""Second-opinion accuracy check (Owner: Ahmed, checkpoint C4).

Idea: every ~10 seconds (and when a step is about to finish), the phone sends one
sharp, higher-resolution picture here. We ask OpenAI's strongest vision model a
focused yes/no question, e.g.:

    "Is anything in this pan burning? Answer yes / no / unsure, plus one short reason."

The answer is sent back to the phone, which feeds it into the live call so Remy
can react with more confidence.

Plan:
  1. Add a route in server/main.py:  POST /api/second-opinion  {image, question, step}
     (ask Matthew. It's his file, or he can import a router from here)
  2. Call OpenAI's Responses API with the image + question; ask for JSON
     {"verdict": "yes"|"no"|"unsure", "reason": "..."}
  3. Keep it cheap: resize to ~1024px, only call it every ~10s, skip when nothing changed.

Not built yet. This file is a placeholder so the folder ownership is clear.
"""
