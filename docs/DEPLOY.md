# Deploy REMY online (permanent https link)

Until now, the iPhone link came from `python tools/share.py` on a laptop. It changes every restart
and dies when the laptop sleeps. This puts REMY on **Render**, a free hosting site, so the team
gets **one link that always works**, e.g. `https://remy-xxxx.onrender.com`.

Owner: Matthew (issue #5). It takes about 10 minutes, once.

## One-time setup
1. Go to **https://render.com** → **Get Started** → sign up **with GitHub**.
2. When Render asks for GitHub access, choose the **whack-26-team** organisation and allow
   the `IO-hackathon-` repository.
3. In Render: **New + → Blueprint**, then pick `whack-26-team/IO-hackathon-`.
4. Render finds `render.yaml` and shows one service called **remy**. It asks for
   **OPENAI_API_KEY**: paste the team key (the voice route Ahmed picked, issue #13).
   No key yet? Leave it empty: pretend Remy still works, and you can add the key later under
   the service → **Environment**.
5. Click **Apply**. The first build takes a few minutes. When it says **Live**, the link is at
   the top of the page.
6. Open `<your link>/api/health` and check you see `"ok": true`, then post the link in the team chat
   and on issue #5.

## After that
- **Every merge into `main` redeploys automatically**, so the link always shows the latest version.
- **Add or change keys:** service → **Environment** → edit → **Save** (it restarts by itself).
  For Remy's eyes (vision): `GEMINI_API_KEY` (from aistudio.google.com/apikey).
  For Ahmed's ElevenLabs voice: `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` (get both from Ahmed privately).
  Check it worked: `<your link>/api/health` shows `"elevenlabs_key_set": true` (never the key itself).
- **Logs** (if something breaks): service → **Logs**.

## ⚠️ Things to know
| | |
|---|---|
| 😴 **It falls asleep** | On the free plan, after ~15 minutes with no visitors the first visit takes about a minute to wake up. **Open the link 5 minutes before the demo.** |
| 🔑 **The key stays secret** | It's stored in Render, not in GitHub. The phone still only gets short-lived passes. |
| 💸 **The link is public** | Anyone who has it can use REMY and spend AI credits. Share it only with the team and judges. The spending limit on the API key (issue #13) is the hard cap. |
| 🗑️ **Nothing is stored** | Render's disk resets on every deploy. That's fine, because REMY doesn't save anything. |
| 🧪 **Testing changes** | Branches aren't deployed, only `main`. To try a branch on an iPhone, use `python tools/share.py` on a laptop. |
