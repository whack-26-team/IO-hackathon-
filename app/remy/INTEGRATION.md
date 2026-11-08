# ElevenLabs on the existing REMY camera screen

Ahmed C2, issue #15. `live.js` now exports the ElevenLabs adapter. The original
OpenAI starter is retained in `openai.js`; it has not been retested.

## Connection

1. The screen provides its camera, canvas and microphone stream.
2. `/api/brain` supplies the complete merged instructions, selected personality,
   knowledge and the current action schemas. These are sent as `session_brain`.
3. ElevenLabs handles spoken conversation. Its `remy_action` client tool dispatches
   schema-checked actions to the existing screen events. Recipe actions use the
   server's checked recipe endpoints.
4. One 512px camera image is sent to `/api/vision/look` at a time, followed by a
   three-second gap. Observations update voice context silently; relevant changes
   trigger speech. Old observations are discarded and repeat warnings suppressed.
5. The phone runs timers. `timer_check` and `timer_done` trigger a spoken reminder
   using the step recorded when the timer began. Elapsed time is not proof of safe
   cooking. A cook can also request an explicit reminder duration. Ambiguous
   compound durations are rejected; repeat as a number of minutes or seconds.

`agent-prompt.md` is our copy of the agent's published dashboard prompt: only the ElevenLabs transport
instructions (single voice, `remy_action`, timers, camera) followed by `{{session_brain}}`. Remy's core
rules are **not** repeated there: the server sends the latest ones at the start of `session_brain`
(`/api/brain`). The dashboard prompt fell from 10,738 to about 3,697 characters when the
duplicate rules were removed. That is a character count, not a measured credit saving.
The source-only HTML comment at the top of `agent-prompt.md` is not in the dashboard.
If you edit either copy, keep the other in step.

The published agent uses Realtime Mini and Oliver - Clean, British and Steady as its only voice.
Gentle, Honest and Savage change delivery, not voice. The copied ElevenLabs settings use patient turn
eagerness, background voice detection on, and Ignore Default Personality off.
Check actual response delay, kitchen-noise behaviour, and usage during the
real phone cook-along. The agent copy and
app connection need a real cook-along after this branch is deployed; creating
the copy alone does not redirect the deployed site.

## Current limits and owner handoffs

- This is a public-agent hackathon prototype. There is no browser API key. The
  optional `sessionProvider` can supply private credentials later, but no private
  endpoint is wired. Matthew must agree the contract and provide short-lived
  sessions before wider access. The browser ten-minute cap is not an account
  spending limit.
- Felix must silence timer beeps during real calls and update the screen's
  retention notice: audio goes to ElevenLabs and images to Gemini; provider
  retention has not been verified. Safety alerts should remain visible/audible.
- Hidden pages pause camera and end the call. Returning reconnects within the
  original ten-minute cap. Two dropped-connection retries retain recipe/timer
  state. Camera failures leave voice available. Voice failure keeps timers on
  screen. Background timer speech requires the page/call to be active.
- Safety events bypass the app's ordinary speech queue and immediately show an
  alert. Actual SDK interruption/audio latency still needs a real device test.
- Local Gemini credentials are absent, so no live image-model or microphone call
  is claimed as tested. No supermarket checkout or persistent preferences exist.

## Validation and real test

Run `node --test app/remy/integration.test.mjs` and `python tools/validate.py`.
Thirteen tests cover prompt completeness, validated actions, timer reminders,
ambiguous durations, stale camera results, disconnects and session lifecycle.
FastAPI smoke checks passed for all three `/api/brain` modes, static modules and
recipe lookup. These use fake speech/vision sessions, not real model calls.

The live target is https://remy-2wc2.onrender.com. Its `/remy/live.js` currently
serves the ElevenLabs adapter. Open it on the phone, choose Gentle, untick Pretend Remy,
and start cooking. Test:

1. Ask what ingredients Remy can see; show a new ingredient and check freshness.
2. Say "Set a timer for 10 seconds to remind me to check the tray." Confirm a
   visible countdown, then a spoken reminder; check that no timer beep plays.
3. Select a recipe, follow one step, and verify the next-step screen update.
4. Interrupt Remy, hide/restore the page, then briefly disconnect the network.
5. Stop and verify the camera indicator and voice both stop.
6. Start a new call in Savage after the 18+ opt-in and confirm the same voice
   delivers the different attitude. Trigger a safety alert and check that the warning stays clear.

Record reply latency and failures before marking the PR ready for review.

Official references: [JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script),
[client tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools),
[dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables).
