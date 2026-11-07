# REMY: your live AI chef 👨‍🍳

Built for the **IO Hackathon**.

Prop up your iPhone, start cooking, and REMY **watches live and talks to you out
loud**. It spots mistakes, starts timers by itself (rigatoni in → 11-minute al dente
timer), walks you through the recipe, and roasts you when you burn the garlic.
Pick its attitude: 😇 Gentle, 😏 Honest or 🤬 Savage (18+).

## Quick start
```bash
pip install -r server/requirements.txt
uvicorn server.main:app --reload --port 8000
```
Open http://localhost:8000, tick **Pretend Remy**, and press **Start cooking**.
Full step-by-step guide, including the iPhone: **[docs/SETUP.md](docs/SETUP.md)**.

## The team
| | Role |
|---|---|
| **Matthew** | Team lead · server · recipes & cooking knowledge |
| **Felix** | The app screen · timers · demo & pitch |
| **Ahmed** | Everything live voice · OpenAI connection |
| **Pranav** | Personality, roasts & catchphrases · accuracy testing |

## Docs
- 📋 **[docs/PLAN.md](docs/PLAN.md)**: the full plan, individual roles, checkpoints
- 🔌 **[docs/CONTRACT.md](docs/CONTRACT.md)**: how the pieces talk to each other
- ⚠️ **[docs/RISKS.md](docs/RISKS.md)**: risks & boundaries
- 🤖 **[AGENTS.md](AGENTS.md)**: rules for Codex / Claude Code (and humans)

## How it works
```
iPhone (app/)  ──camera pictures + voice──▶  OpenAI realtime model (Remy)
     ▲   │                                         │
     │   └── asks for a short-lived pass ──▶ server/ (adds Remy's personality,
     │                                        recipe, cook-times, food-safety)
     └──── Remy's voice + actions (tips, roasts, timers, alerts) ◀──┘
```
