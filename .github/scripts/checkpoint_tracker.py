"""Rebuilds the "📍 Checkpoint tracker" issue from the repo's milestones, issues,
pull requests and check-in comments. Run by .github/workflows/checkpoint-tracker.yml
(on issue/PR/comment activity + hourly). Uses the `gh` CLI, so it also runs locally:

    python .github/scripts/checkpoint_tracker.py            # update the tracker issue
    python .github/scripts/checkpoint_tracker.py --print    # just print it

A check-in is any comment on your issue containing "Done:", e.g.
    Done: camera works on iPhone
    Next: personality picker
    Blocked: nothing
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

REPO = os.getenv("GITHUB_REPOSITORY", "whack-26-team/IO-hackathon-")
TRACKER_LABEL = "tracker"
TRACKER_TITLE = "📍 Checkpoint tracker"
PEOPLE = ["matthew", "felix", "ahmed", "pranav"]
NOT_BLOCKED = {"", "-", "no", "none", "nothing", "n/a", "na", "nope", "not blocked"}


def gh(path: str, method: str = "GET", body: dict | None = None):
    """Call the GitHub REST API through the gh CLI. (One page of 100 is plenty for a hackathon.)"""
    cmd = ["gh", "api", "-X", method, path]
    if body is not None:
        cmd += ["--input", "-"]
    out = subprocess.run(cmd, input=json.dumps(body) if body is not None else None,
                         capture_output=True, text=True)
    if out.returncode:
        raise SystemExit(f"gh api {path} failed: {out.stderr.strip()}")
    return json.loads(out.stdout or "null")


def field(text: str, name: str) -> str:
    m = re.search(rf"^\W*{name}\s*:\s*(.*)$", text, re.I | re.M)
    return m.group(1).strip() if m else ""


def short(text: str, n: int = 70) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def ago(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    mins = int((datetime.now(timezone.utc) - dt).total_seconds() // 60)
    if mins < 60:
        return f"{mins}m ago"
    if mins < 48 * 60:
        return f"{mins // 60}h ago"
    return f"{mins // 1440}d ago"


def bar(done: int, total: int, width: int = 10) -> str:
    filled = round(width * done / total) if total else 0
    return "🟩" * filled + "⬜" * (width - filled)


def build() -> str:
    milestones = sorted(gh(f"repos/{REPO}/milestones?state=all&per_page=100"),
                        key=lambda m: m["title"])
    issues = [i for i in gh(f"repos/{REPO}/issues?state=all&per_page=100")
              if "pull_request" not in i]
    prs = gh(f"repos/{REPO}/pulls?state=open&per_page=100")

    pr_for: dict[int, dict] = {}
    for pr in prs:
        # Only explicit links count ("Closes #9", "Fixes #9", "Part of #9"), not any "#9"
        text = f"{pr['title']} {pr.get('body') or ''}"
        for num in re.findall(r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|part of|refs?)\s+#(\d+)", text, re.I):
            pr_for.setdefault(int(num), pr)

    rows_by_ms: dict[int, list[str]] = {}
    blocked: list[str] = []
    latest: dict[str, tuple[str, str, str]] = {}  # person -> (when, issue, text)

    for issue in sorted(issues, key=lambda i: i["number"]):
        labels = {l["name"] for l in issue["labels"]}
        if TRACKER_LABEL in labels:
            continue
        if not issue.get("milestone"):
            # e.g. a "🚧 I'm blocked" help request: list it, but it isn't a checkpoint task
            if "blocked" in labels and issue["state"] == "open":
                blocked.append(f"- #{issue['number']} **{issue['user']['login']}** asked for help: "
                               f"{short(issue['title'], 100)}")
            continue
        person = next((p for p in PEOPLE if p in labels), "?")
        num, link = issue["number"], f"#{issue['number']}"

        checkin = None
        if issue["comments"]:
            for c in reversed(gh(f"repos/{REPO}/issues/{num}/comments?per_page=100")):
                if re.search(r"^\W*done\s*:", c["body"], re.I | re.M):
                    checkin = c
                    break

        is_blocked = "blocked" in labels
        blocked_text = ""
        if checkin:
            blocked_text = field(checkin["body"], "blocked")
            if blocked_text.lower().rstrip(".!") not in NOT_BLOCKED:
                is_blocked = issue["state"] == "open"
            prev = latest.get(person)
            if not prev or checkin["created_at"] > prev[0]:
                latest[person] = (checkin["created_at"], link, checkin["body"])

        if issue["state"] == "closed":
            status = "✅ Done"
        elif is_blocked:
            status = "🚧 Blocked"
        elif num in pr_for:
            status = f"👀 In review ([PR]({pr_for[num]['html_url']}))"
        elif checkin:
            status = "🔨 In progress"
        else:
            status = "⬜ To do"

        last = (f"{ago(checkin['created_at'])}: {short(field(checkin['body'], 'next') or field(checkin['body'], 'done'))}"
                if checkin else "no check-in yet")
        title = re.sub(r"^\[[^\]]*\]\s*", "", issue["title"])
        rows_by_ms.setdefault(issue["milestone"]["number"], []).append(
            f"| {person.title()} | {link} {short(title, 55)} | {status} | {last} |")
        if is_blocked:
            blocked.append(f"- {link} **{person.title()}**: {short(blocked_text or 'labelled blocked', 120)}")

    now = datetime.now(timezone.utc).strftime("%a %d %b %H:%M UTC")
    out = [
        "> 🤖 This issue updates itself automatically. Don't edit it, because changes get overwritten.",
        f"> Last updated: **{now}**",
        "",
        "## How to check in",
        "At each checkpoint, comment on **your own issue** for that checkpoint:",
        "```",
        "Done: what you finished",
        "Next: what you're doing next",
        "Blocked: what's stopping you (or 'nothing')",
        "```",
        "It shows up here within a minute. Anything other than 'nothing' after `Blocked:` (or the `blocked` label) puts you on the 🚧 list.",
        "",
        "## 🚧 Blocked right now",
        *(blocked or ["Nobody 🎉"]),
        "",
        "## 💬 Latest check-in per person",
        "| Who | When | Issue | Done | Next | Blocked |",
        "|---|---|---|---|---|---|",
    ]
    for p in PEOPLE:
        if p in latest:
            when, link, body = latest[p]
            out.append(f"| {p.title()} | {ago(when)} | {link} | {short(field(body, 'done'), 45)} | "
                       f"{short(field(body, 'next'), 45)} | {short(field(body, 'blocked'), 35) or 'nothing'} |")
        else:
            out.append(f"| {p.title()} | – | – | no check-in yet | | |")
    out.append("")
    out.append("## 📍 Checkpoints")
    for m in milestones:
        total = m["open_issues"] + m["closed_issues"]
        done = m["closed_issues"]
        out += [
            "",
            f"### {m['title']}: {bar(done, total)} {done}/{total}",
            "| Who | Task | Status | Last check-in |",
            "|---|---|---|---|",
            *rows_by_ms.get(m["number"], ["| | (no tasks) | | |"]),
        ]
    out += ["", "Full plan: [docs/PLAN.md](https://github.com/" + REPO + "/blob/main/docs/PLAN.md) · "
            "Roles: [ROLES/](https://github.com/" + REPO + "/tree/main/ROLES)"]
    return "\n".join(out)


def main() -> None:
    body = build()
    if "--print" in sys.argv:
        print(body)
        return
    existing = gh(f"repos/{REPO}/issues?labels={TRACKER_LABEL}&state=open&per_page=10")
    if existing:
        num = existing[0]["number"]
        if existing[0]["body"] != body:
            gh(f"repos/{REPO}/issues/{num}", "PATCH", {"body": body})
    else:
        num = gh(f"repos/{REPO}/issues", "POST",
                 {"title": TRACKER_TITLE, "body": body, "labels": [TRACKER_LABEL]})["number"]
    print(f"Tracker updated: https://github.com/{REPO}/issues/{num}")


if __name__ == "__main__":
    main()
