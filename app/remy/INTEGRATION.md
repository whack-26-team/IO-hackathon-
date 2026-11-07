# ElevenLabs on the existing REMY camera screen

Ahmed C2, issue #15. `live.js` now exports the ElevenLabs adapter. The original
OpenAI starter is retained in `openai.js`; it has not been retested.

## Connection

1. The screen provides its camera, canvas and microphone stream.
2. `/api/brain` supplies the complete merged instructions, selected personality,
   knowledge and eight action schemas. These are sent as `session_brain`.
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

`agent-prompt.md` begins with the full merged `remy-brain/instructions.md`, followed
by the transport instructions and `{{session_brain}}`. Core rules explicitly take
priority over personality examples. The exact core prefix has an automated test.
The configured ElevenLabs agent is `agent_9201m6v41z1he9eshw97vkqbyyvn` (public ID,
not a secret), with a response-returning client tool named `remy_action` and two
required string arguments: `action`, `arguments_json`. Tool timeout: 25 seconds.
The GPT-6 Luna / Eric primary voice remains in place. ElevenLabs also has a
secondary voice labeled `Savage` using its Marcus British male library voice.
The published prompt requests `<Savage>...</Savage>` speech tags only when the
selected mode is Savage after the screen's 18+ opt-in; Gentle and Honest use Eric.
This is an original chef voice, not a Gordon Ramsay impersonation. Check the
audible voice switch on a phone before treating it as verified.

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

The live target is https://remy-2wc2.onrender.com. At this checkpoint it still
serves the old OpenAI adapter; deployment of this branch remains necessary.
After deployment, open it on the phone, choose Gentle, untick Pretend Remy,
and start cooking. Test:

1. Ask what ingredients Remy can see; show a new ingredient and check freshness.
2. Say "Set a timer for 10 seconds to remind me to check the tray." Confirm a
   visible countdown, then a spoken reminder; check that no timer beep plays.
3. Select a recipe, follow one step, and verify the next-step screen update.
4. Interrupt Remy, hide/restore the page, then briefly disconnect the network.
5. Stop and verify the camera indicator and voice both stop.
6. Start a new call in Savage after the 18+ opt-in and confirm its voice differs
   from Gentle. Trigger a safety alert and check that the warning stays clear.

Record reply latency and failures before marking the PR ready for review.

Official references: [JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script),
[client tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools),
[dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables).
