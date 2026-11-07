"""Share REMY with an https link + QR code, so teammates can open it on their iPhones.

    python tools/share.py              # start the server + an https tunnel
    python tools/share.py --port 8001  # use another port

What it does:
  1. Starts the REMY server (uvicorn) on your laptop, unless one is already running.
  2. Starts a free Cloudflare quick tunnel -> gives a https://….trycloudflare.com link
     (iPhones only allow the camera on https links).
  3. Checks the link really reaches REMY, then prints it big, with a QR code.
  Press Ctrl+C to stop everything.

Needs `cloudflared` installed (free, no account):
  Mac:      brew install cloudflared
  Windows:  winget install --id Cloudflare.cloudflared
  Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Notes:
  * The link changes every time you restart this script. Post the new one in the team chat.
  * The link only works while your laptop is on and this script is running.
    For a permanent link, we deploy to Render at checkpoint C4 (issue #5).
  * Anyone with the link can use REMY (and spend our AI credits). Only share it with the team.
"""

from __future__ import annotations

import argparse
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")

INSTALL_HELP = """
❌ cloudflared isn't installed. It's free and needs no account:
   Mac:      brew install cloudflared
   Windows:  winget install --id Cloudflare.cloudflared
   Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
Then run this again.
"""


def is_up(url: str, timeout: float = 3) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/api/health", timeout=timeout) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def print_qr(url: str) -> None:
    try:
        import qrcode  # optional: pip install qrcode
    except ImportError:
        print("   (Tip: `pip install qrcode` to also get a QR code here.)")
        return
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)


def banner(url: str, verified: bool) -> None:
    line = "═" * (len(url) + 8)
    print(f"\n╔{line}╗\n║    {url}    ║\n╚{line}╝")
    print("✅ Checked: the link reaches REMY." if verified
          else "⚠️  Couldn't confirm the link yet. Give it ~30s, then open it.")
    print_qr(url)
    print("""
📱 On an iPhone: open the link in Safari → allow camera + mic.
   To install it like an app: Share → Add to Home Screen.
🔁 The link changes each restart. Post the new one in the team chat.
🛑 Ctrl+C to stop.
""")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    local = f"http://localhost:{args.port}"

    cloudflared = shutil.which("cloudflared")
    if not cloudflared:
        print(INSTALL_HELP)
        return 1

    procs: list[subprocess.Popen] = []

    def stop(*_):
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        print("\n👋 Stopped the server and the tunnel.")
        sys.exit(0)

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    # 1. server
    if is_up(local, timeout=1):
        print(f"ℹ️  REMY is already running at {local}, reusing it.")
    else:
        print(f"▶️  Starting REMY at {local} …")
        procs.append(subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "server.main:app", "--port", str(args.port)],
            cwd=ROOT))
        for _ in range(40):
            if is_up(local, timeout=1):
                break
            if procs[-1].poll() is not None:
                print("❌ The server crashed while starting. See the error above "
                      "(did you run `pip install -r server/requirements.txt`?).")
                return 1
            time.sleep(0.5)
        else:
            print("❌ The server didn't start within 20s.")
            stop()

    # 2. tunnel (cloudflared prints the link on its log output)
    print("🌐 Opening an https tunnel …")
    tunnel = subprocess.Popen([cloudflared, "tunnel", "--no-autoupdate", "--url", local],
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    procs.append(tunnel)

    found: dict[str, str] = {}

    def read_logs():
        for line in tunnel.stdout:  # keep draining so cloudflared never blocks
            m = URL_RE.search(line)
            if m and "url" not in found:
                found["url"] = m.group(0)

    threading.Thread(target=read_logs, daemon=True).start()
    for _ in range(60):
        if "url" in found or tunnel.poll() is not None:
            break
        time.sleep(0.5)
    if "url" not in found:
        print("❌ cloudflared didn't give us a link. Check your internet connection and try again.")
        stop()

    # 3. verify + show
    url = found["url"]
    verified = any(is_up(url, timeout=5) or time.sleep(2) for _ in range(10))
    banner(url, verified)

    while all(p.poll() is None for p in procs):
        time.sleep(1)
    print("⚠️  The server or the tunnel stopped unexpectedly.")
    stop()
    return 1


if __name__ == "__main__":
    sys.exit(main())
