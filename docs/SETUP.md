# Setup: step by step (no experience needed)

## 1. Get the code on your laptop
1. Install **Git** and **Python 3.11+** (python.org).
2. Open a terminal and run:
   ```bash
   git clone https://github.com/whack-26-team/IO-hackathon-.git
   cd IO-hackathon-
   pip install -r server/requirements.txt
   ```

## 2. Run REMY
```bash
uvicorn server.main:app --reload --port 8000
```
Open **http://localhost:8000** in Chrome. Tick **Pretend Remy**, pick a recipe, press
**Start cooking**, and allow the camera. Fake tips, a roast, a timer and a red alert
should appear over the next ~25 seconds.

## 3. Turn on the real AI (needs the team OpenAI key)
1. Copy `server/.env.example` to `server/.env`.
2. Paste the key Ahmed sends you **privately** after `OPENAI_API_KEY=`.
3. Restart the server, then untick **Pretend Remy**.

⚠️ Never put the key anywhere else: not in GitHub, not in chat.

## 4. Open it on an iPhone
The iPhone only allows the camera on **https** links. One command gives you one, with a QR code:
1. Install **cloudflared** (free, no account): Mac `brew install cloudflared` ·
   Windows `winget install --id Cloudflare.cloudflared` ·
   [Linux](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Run:
   ```bash
   python tools/share.py
   ```
3. It prints a `https://….trycloudflare.com` link and a QR code. Scan it with the iPhone camera, or
   open the link in **Safari**. To install it as an app: **Share → Add to Home Screen**.

The link changes every restart, so post the new one in the team chat. It only works while your
laptop is on. (A permanent link comes at C4, issue #5.) Only share it with the team, because
anyone with the link can use our AI credits.

## 5. Daily git routine
```bash
git checkout main && git pull            # get everyone's latest work
git checkout -b felix/c2-9-app-screens  # one branch per issue, see docs/BRANCHES.md for your exact names
# …work…
git add -A && git commit -m "What I changed"
git push -u origin felix/c2-9-app-screens  # at least every hour
```
Then open a **pull request** on GitHub. Codex and Claude Code can do all of this for
you: just ask "commit and push my work, then open a PR".
