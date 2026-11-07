"""Auto-merge a pull request once its checks pass, if it's safe to do without a human.

Run by the "automerge" job in .github/workflows/check.yml (after the checks pass).
A PR merges itself (squash) only when ALL of these are true:
  1. it's not a draft and has no `hold` / `needs-review` label
  2. its branch follows the naming rule (docs/BRANCHES.md): <name>/c<0-5>-...
  3. every changed file is inside that person's own folders (AGENTS.md ownership)
  4. no added line looks like a secret (API keys, tokens, private keys)
Otherwise it labels the PR `needs-review` and comments why, so Matthew can look.
To approve a flagged PR: add the `approved` label (skips rule 3; secrets are still checked).
To stop a PR merging itself: add the `hold` label, or open it as a draft.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

REPO = os.environ["GITHUB_REPOSITORY"]
PR = os.environ["PR_NUMBER"]

# Who may change what without a review. Matthew (team lead) and Claude (works for
# Matthew) may change anything, so their PRs only need passing checks + no secrets.
OWNERS = {
    "felix": ["app/"],
    "ahmed": ["app/remy/", "server/second_opinion.py"],
    "pranav": ["remy-brain/instructions.md", "remy-brain/actions.json",
               "remy-brain/personality/", "tests/"],
    "matthew": [""],
    "claude": [""],
}
NOT_FELIX = ["app/remy/"]  # inside app/ but Ahmed's

SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9_-]{20,}",                 # OpenAI-style keys
    r"AIza[0-9A-Za-z_-]{30,}",                # Google / Gemini keys
    r"gh[pousr]_[A-Za-z0-9]{30,}",            # GitHub tokens
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"(?i)(api[_-]?key|secret|token|password)\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{16,}",
]


def gh(*args: str, body: dict | None = None):
    cmd = ["gh", "api", *args]
    if body is not None:
        cmd += ["--input", "-"]
    out = subprocess.run(cmd, input=json.dumps(body) if body is not None else None,
                         capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr.strip())
    return json.loads(out.stdout or "null")


def flag(reasons: list[str]) -> None:
    labels = {l["name"] for l in gh(f"repos/{REPO}/issues/{PR}")["labels"]}
    if "needs-review" not in labels:
        gh(f"repos/{REPO}/issues/{PR}/labels", "-X", "POST", body={"labels": ["needs-review"]})
        gh(f"repos/{REPO}/issues/{PR}/comments", "-X", "POST", body={"body":
           "🔎 **Not auto-merged: needs Matthew's review.**\n\n- " + "\n- ".join(reasons) +
           "\n\nChecks passed. To merge it after a look, add the **`approved`** label (or press merge). "
           "(Auto-merge only handles PRs that stay inside their owner's folders. See docs/BRANCHES.md.)"})
    print("Needs review:", reasons)


def main() -> int:
    pr = gh(f"repos/{REPO}/pulls/{PR}")
    if pr["state"] != "open" or pr["draft"]:
        print("Draft or closed: not merging.")
        return 0
    labels = {l["name"] for l in pr["labels"]}
    approved = "approved" in labels
    if "hold" in labels:
        print("Labelled hold: not merging.")
        return 0
    if "needs-review" in labels and not approved:
        print("Waiting for review (add the 'approved' label to merge).")
        return 0
    if pr["head"]["repo"]["full_name"] != REPO:
        flag(["It comes from a fork."])
        return 0

    reasons: list[str] = []
    branch = pr["head"]["ref"]
    m = re.match(r"^(matthew|felix|ahmed|pranav|claude)/c[0-5]-[a-z0-9-]+$", branch)
    who = m.group(1) if m else None
    if not who:
        if not approved:
            reasons.append(f"Branch `{branch}` doesn't follow the naming rule `<name>/c<checkpoint>-<issue>-<description>`.")

    files = gh(f"repos/{REPO}/pulls/{PR}/files?per_page=100")
    if who and not approved:
        allowed = OWNERS[who]
        outside = [f["filename"] for f in files
                   if not any(f["filename"].startswith(a) for a in allowed)
                   or (who == "felix" and any(f["filename"].startswith(x) for x in NOT_FELIX))]
        if outside:
            reasons.append(f"It changes files outside {who.title()}'s folders: " +
                           ", ".join(f"`{f}`" for f in outside[:10]))

    for f in files:
        added = "\n".join(l[1:] for l in (f.get("patch") or "").splitlines()
                          if l.startswith("+") and not l.startswith("+++"))
        if any(re.search(p, added) for p in SECRET_PATTERNS):
            reasons.append(f"`{f['filename']}` contains something that looks like a secret/API key.")

    if reasons:
        flag(reasons)
        return 0

    gh(f"repos/{REPO}/pulls/{PR}/merge", "-X", "PUT", body={
        "merge_method": "squash",
        "commit_title": f"{pr['title']} (#{PR})",
        "sha": pr["head"]["sha"],  # only merge exactly what was checked
    })
    print(f"✅ Auto-merged #{PR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
