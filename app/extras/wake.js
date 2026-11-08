// Keep the screen awake while cooking (#112): a phone that dims and locks mid-cook drops Remy.
// Uses the Screen Wake Lock API; older iPhones get a tiny silent looping video instead.
export function initWakeLock(app) {
  let lock = null, video = null, cooking = false;

  async function hold() {
    if (!cooking) return;
    try {
      if ("wakeLock" in navigator) {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener?.("release", () => { lock = null; });
        return;
      }
    } catch { /* not allowed right now: try the video trick */ }
    try {
      if (!video) {
        video = Object.assign(document.createElement("video"), { src: "extras/keep-awake.mp4", muted: true, loop: true, playsInline: true });
        video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
        Object.assign(video.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", pointerEvents: "none", bottom: "0", left: "0" });
        document.body.append(video);
      }
      await video.play();
    } catch { /* can't keep it awake on this phone */ }
  }
  function release() {
    try { lock?.release(); } catch { /* already released */ }
    lock = null;
    video?.pause();
  }

  app.on("start", () => { cooking = true; hold(); });
  app.on("stop", () => { cooking = false; release(); });
  // the lock is dropped when the app is hidden; take it again when it comes back
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && cooking && !lock) hold(); });
}
