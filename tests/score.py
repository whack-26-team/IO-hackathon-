"""Accuracy scorer (Owner: Pranav, checkpoint C4).

Goal: replay labelled cooking clips (tests/labels.json) through Remy and count:
  * catches      - Remy reacted to an expected event within ~5 seconds
  * misses       - an expected event with no reaction
  * false alarms - Remy warned/roasted during a quiet period or with no matching event

Report the three numbers in every pull request that changes Remy's instructions,
so we can see if a change made Remy better or worse.

Suggested approach:
  1. Extract ~1 frame per second from each clip (e.g. with ffmpeg).
  2. Send frames in order to OpenAI with Remy's instructions + recipe (same as the
     live app), and record each tool call (show_tip / roast / safety_alert) + time.
  3. Compare against labels.json and print the score.

Not built yet.
"""


def score(expected: list[dict], reactions: list[dict], window: float = 5.0) -> dict:
    """Pure scoring logic, usable now. Each item has 'at_seconds'."""
    caught, used = 0, set()
    for ev in expected:
        for i, r in enumerate(reactions):
            if i not in used and 0 <= r["at_seconds"] - ev["at_seconds"] <= window:
                caught += 1
                used.add(i)
                break
    return {
        "catches": caught,
        "misses": len(expected) - caught,
        "false_alarms": len(reactions) - len(used),
    }


if __name__ == "__main__":
    demo = score([{"at_seconds": 42}, {"at_seconds": 70}],
                 [{"at_seconds": 44}, {"at_seconds": 20}])
    print(demo)  # {'catches': 1, 'misses': 1, 'false_alarms': 1}
