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
The iPhone only allows the camera on **https** links:
```bash
cloudflared tunnel --url http://localhost:8000
```
(Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
It prints a `https://….trycloudflare.com` link. Open that in **Safari** on the iPhone.
To install it as an app: **Share → Add to Home Screen**.

## 5. Daily git routine
```bash
git checkout main && git pull            # get everyone's latest work
git checkout -b yourname/your-task       # your own branch (first time only)
# …work…
git add -A && git commit -m "What I changed"
git push -u origin yourname/your-task    # at least every hour
```
Then open a **pull request** on GitHub. Codex and Claude Code can do all of this for
you: just ask "commit and push my work, then open a PR".
