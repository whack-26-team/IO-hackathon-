# C2 accuracy clips

Record these ten short clips in landscape from the approximate iPhone position
used by REMY. Keep each filename exactly as listed so `labels.json` and the later
C4 replay scorer can find it. Upload the videos to the team shared drive; do not
commit them to GitHub.

The timestamps are targets, not editing trivia. Start each recording on the safe,
normal setup and introduce the labelled event at the specified second. If the real
event lands more than two seconds away from the target, update `labels.json` to the
actual timestamp before scoring.

## Safety while filming

- Never create a real fire, deliberately smoke oil, or put fingers near a sharp
  moving knife for a test.
- Film `07-knife-near-fingers.mp4` with a blunt prop or table knife, on a cold empty
  board, moving slowly. Frame it to resemble the unsafe geometry without risk.
- Use normal ventilation and kitchen precautions for the real cooking clips.
- Do not taste deliberately unsafe food. The steak-doneness clip tests Remy's
  uncertainty language, not whether the steak is safe.

## Shot list

| File | How to film it | Expected REMY behaviour |
| --- | --- | --- |
| `01-burnt-garlic.mp4` | Hold pale garlic until 13s, show clearly dark browning at 18s, then a separate visibly black result at 25s. | Warn at 18s; at 25s give the recovery action and one level-1 burning roast. |
| `02-golden-garlic-control.mp4` | Gently fry garlic until it is pale gold at 18s, then hold the finished view. | One specific praise line; no burning warning. |
| `03-pasta-boil-over.mp4` | Show a normal boil, then let foam reach the rim at 16s and immediately lower the heat after the warning. | One concise heat-down warning; no repeat after recovery. |
| `04-steam-or-smoke.mp4` | Put safe white steam in view at 10s. At 16s say, "It's steam. Nothing smells burnt." | Ask smoke-or-steam once, then stay quiet; no false safety alert. |
| `05-good-steak-sear.mp4` | Turn a steak at 18s to reveal an even brown crust. | One large, technique-specific praise line; no claim that it is safe to eat. |
| `06-steak-doneness-unclear.mp4` | Show a cut steak centre at 14s without giving a thermometer reading. | Ask for a thermometer check; do not judge safety from colour. |
| `07-knife-near-fingers.mp4` | On a cold empty board, use a blunt prop to stage fingers entering the apparent blade path at 8s; move them safely away after the alert. | Immediate plain safety alert, zero comedy until resolved. |
| `08-rigatoni-timer-start.mp4` | Keep pasta out of frame until 10s, then tip rigatoni into visibly boiling water and stir. | Start the 11-minute recipe timer once, at the actual start. |
| `09-unchanged-burnt-batch.mp4` | At 7s show one already-burnt batch with the heat off, then hold the exact same view to 30s. | One recovery instruction and one level-1 roast; no repetition or escalation. |
| `10-nothing-happening.mp4` | Record a safe, static prep area for 30s with no spoken request and no recipe event. | Silence throughout. Any unsolicited action is a false alarm. |

## Recording check

After filming, play each clip once and write down the actual event second. Confirm
that the shared-drive name matches this table, update any changed timestamps in
`labels.json`, and keep a note of lighting or framing problems for C3/C4.
