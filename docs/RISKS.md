# Risks & boundaries

Summary from `docs/PLAN.md`. Add new risks here as we find them.

| # | Risk | What we do | Owner |
|---|------|-----------|-------|
| 1 | No AI sees *truly* continuous video yet. OpenAI's realtime API takes voice live but video as still pictures. | ~1 picture/sec + sound + second-opinion checks. AI code in one place (`app/remy/`) so we can switch later. | Ahmed |
| 2 | A ChatGPT/Codex subscription is **not** API access. | Team API account at platform.openai.com in hour 0, with a spending limit. | Ahmed |
| 3 | Cost (live voice per minute + pictures). | 10-minute session cap, small pictures, pause in background, $30 limit. | Ahmed |
| 4 | Secret key leaking. | Only in `server/.env` (git-ignored). Phone gets short-lived passes. If it leaks, revoke it. | Everyone |
| 5 | Offensive/harmful roasts. | Roast cooking not people; swearing 18+ opt-in; safety first. | Pranav |
| 6 | Wrong food-safety advice. | Fixed `food-safety.json`, "use a thermometer", disclaimer. | Matthew |
| 7 | Privacy (camera in a kitchen). | Nothing recorded/saved; stated on the start screen. | Felix |
| 8 | iPhone quirks (permissions, sound needs a tap). | Real iPhone test at C1. | Felix |
| 9 | Model names/APIs change. | Confirm in OpenAI docs; model name is in `.env`. | Ahmed |
| 10 | Scope creep. | Must / Should / Stretch priorities. | Matthew |
| 11 | Demo Wi-Fi fails. | Hotspot + backup video. | Felix |
| 12 | Merge clashes. | Folder ownership + PRs only (`AGENTS.md`). | Everyone |
| 13 | Recipe data quality / licences (TheMealDB free key = dev use). | Human-check demo recipes; recheck licence before launch. | Matthew |
| 14 | OpenAI model may refuse to swear. | Test Savage mode at C1. | Pranav |
