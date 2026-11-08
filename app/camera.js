// Open the back camera once, on the normal 1x lens when we can, and make sure the picture appears.
//
// Dual-camera iPhones (e.g. iPhone 14) can hand Safari the "Back Dual Wide Camera", which starts on
// the 0.5x ultra-wide lens (zoomed out, small). We used to close it and reopen the 1x "Back Camera",
// but asking an iPhone for the camera twice in a row sometimes failed and left the picture black.
// Now the camera opens ONCE: on the 1x lens if this phone told us its id before (remembered after
// the first time), otherwise the phone's default. If the picture still doesn't appear, one retry.
const PLAIN_BACK = (label) => /back/i.test(label) && !/ultra|dual|triple|telephoto|wide/i.test(label);
const KEY = "remy:mainCam";
const remembered = () => { try { return localStorage.getItem(KEY) || null; } catch { return null; } };
const remember = (id) => { try { if (id) localStorage.setItem(KEY, id); } catch { /* private mode */ } };

async function mainCameraId() {
  const saved = remembered();
  if (saved) return saved;
  try {   // labels are only known once camera permission was given on an earlier visit
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.label);
    return (cams.find((d) => /^back camera$/i.test(d.label.trim())) || cams.find((d) => PLAIN_BACK(d.label)))?.deviceId || null;
  } catch { return null; }
}

export async function openCamera({ width = 1280 } = {}) {
  const id = await mainCameraId();
  const video = { facingMode: { ideal: "environment" }, width: { ideal: width }, ...(id ? { deviceId: { ideal: id } } : {}) };
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
  catch (e) {
    if (!id) throw e;   // a remembered camera that no longer exists: plain back camera instead
    try { localStorage.removeItem(KEY); } catch { /* fine */ }
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: width } }, audio: true });
  }
  const track = stream.getVideoTracks()[0];
  const info = { label: track?.label || "?", tried: id ? "remembered 1x" : "default" };
  // Remember the 1x lens for next time (no switching now: that's what made pictures go black)
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.label);
    const best = cams.find((d) => /^back camera$/i.test(d.label.trim())) || cams.find((d) => PLAIN_BACK(d.label));
    if (best) remember(best.deviceId);
  } catch { /* fine */ }
  // On a multi-lens virtual camera at its widest (0.5x)? Zoom to 2, its 1x lens. Same camera, no reopen.
  try {
    const caps = track?.getCapabilities?.(), now = track?.getSettings?.();
    if (/dual wide|triple/i.test(track?.label || "") && caps?.zoom && now?.zoom !== undefined && now.zoom <= caps.zoom.min) {
      await track.applyConstraints({ advanced: [{ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2)) }] });
      info.zoomed = true;
    }
  } catch { /* zoom not supported: fine */ }
  const s = track?.getSettings?.() || {};
  return { stream, info: { ...info, width: s.width, height: s.height, zoom: s.zoom ?? "n/a" } };
}

// Resolves true once the video shows a picture, false after `ms` (black camera)
export function pictureReady(video, ms = 3500) {
  return new Promise((resolve) => {
    const ok = () => video.videoWidth > 0 && video.srcObject?.getVideoTracks?.()[0]?.readyState === "live";
    if (ok()) return resolve(true);
    const check = () => { if (ok()) { clean(); resolve(true); } };
    const clean = () => { clearInterval(poll); clearTimeout(timer); video.removeEventListener("loadedmetadata", check); video.removeEventListener("resize", check); };
    video.addEventListener("loadedmetadata", check); video.addEventListener("resize", check);
    const poll = setInterval(check, 200);
    const timer = setTimeout(() => { clean(); resolve(ok()); }, ms);
  });
}
