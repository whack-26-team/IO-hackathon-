# Ahmed: ElevenLabs voice route and C1 handoff

## Decision for issue #13

Use ElevenLabs Agents for the initial voice experiment. Ahmed already has 75 call
minutes and reports 40,000 credits; model charges and call minutes must be tracked
separately in the account. A Remy agent has been created in his ElevenLabs workspace.
This choice prioritises voice quality and interruption handling. It has not yet
been measured against the phone-voice, Gemini, or OpenAI alternatives. No claim of
winning a latency or cost comparison is made.

## Try issue #14

Run Matthew's existing FastAPI server, then open `/remy/voice-test.html`.
Paste the Remy agent ID (not an API key), choose a recipe/mode, and press Start.
On iPhone use the team's HTTPS URL. The SDK loads from esm.sh at a pinned version,
so internet access to that CDN and ElevenLabs is required. There is no build step.
For general conversation without recipes, any static server serving `app/` works.

This is an isolated public-agent test. The ID is supplied by the tester and is not
committed. It does not use or change `/api/session`, `live.js`, or Felix's screen.
No audio is started on page load. Sessions stop after two minutes or when hidden.
The page does not persist transcripts; ElevenLabs account retention settings still
apply. There is no camera capture, vision model, timer tool, or basket integration.

Measure manually on the real phone: voice intelligibility, interruption cut-off,
delay from end of speech to first audible reply, and recovery after Stop/restart.
The displayed transcript gap is only a diagnostic, not audible response latency.
Do not close #14 until the real iPhone conversation and interruption test passes.

## Next: issue #15 (separate branch)

Preserve the contract's `on`, `send`, `start`, `stop` interface and all existing
screen event shapes. Register the six actions from `remy-brain/actions.json` as
ElevenLabs client tools, validating arguments before emitting screen events.
The C1 connector intentionally does not claim these actions are implemented.
Load the team's `/api/brain` instructions and configure the ElevenLabs agent to
accept the agreed per-session instructions/mode; recipe context alone is not a
replacement for Pranav's full system instructions.

### Server handoff for Matthew — proposed, not an existing contract

Keep the existing OpenAI `/api/session` route intact. Propose a separate
`POST /api/elevenlabs/session` accepting `{recipe_id, mode}`. Server should validate
these, build the same brain, request an ElevenLabs WebRTC conversation token using
`GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...`, and return
the short-lived `conversation_token` plus recipe, mode and max_minutes. Use server
environment settings `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`; never return
the API key. Apply authentication/rate limits and do not cache tokens. Agent
authentication and origin restrictions should be configured before broad sharing.

Matthew should propose the contract addition before we implement this endpoint.
Camera analysis likewise needs an agreed endpoint/provider. It should accept
bounded images and recipe step context and return timestamped observations. Ahmed
will translate fresh observations into silent context or deliberate speech events,
deduplicate them and discard late results. This endpoint is not implemented here.

## Official references

- https://elevenlabs.io/docs/eleven-agents/libraries/java-script
- https://elevenlabs.io/docs/eleven-agents/libraries/react
- https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events

## Validation boundary

Automated lifecycle checks can establish stop/connection race handling and message
forwarding using a fake SDK. They cannot establish actual voice quality, iPhone
audio routing, ElevenLabs agent configuration, or camera accuracy. Those require
the real session and cooking test.
