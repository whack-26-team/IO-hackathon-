# C4 Gentle and Honest responsiveness checks

Run every case in a fresh ElevenLabs session. The five-second target begins when
the user finishes speaking or when the voice layer explicitly reports an
unintelligible speech attempt. Ordinary silence must not start this timer.

| Case | Mode | User input | Expected within 5 seconds |
| --- | --- | --- | --- |
| R1 | Gentle | `Carbonara.` after Remy asks what they are cooking | Call `find_recipe`, confirm the dish and begin guidance. |
| R2 | Honest | `Carbonara.` after Remy asks what they are cooking | Call `find_recipe`, confirm the dish and begin guidance. |
| R3 | Gentle | A deliberately unclear speech attempt | One warm request to repeat; no guessed words or recipe. |
| R4 | Honest | A deliberately unclear speech attempt | One direct request to repeat; no guessed words or recipe. |
| R5 | Gentle | No speech for 15 seconds during an unchanged safe view | Silence; no repeated check-in. |
| R6 | Honest | No speech for 15 seconds during an unchanged safe view | Silence; no repeated check-in. |

Record whether the user transcript appeared in ElevenLabs. A correct transcript
with no reply is a prompt failure. A missing or badly corrupted transcript is a
VAD/ASR failure and must not be counted as personality failure.

The prompt cannot measure five seconds or distinguish an attempted utterance
from genuine silence by itself. The ElevenLabs/app voice layer must trigger a
turn only after it detected speech but could not produce usable words. Do not set
a global five-second silence prompt: that would interrupt the cook every five
seconds while they are working normally.
