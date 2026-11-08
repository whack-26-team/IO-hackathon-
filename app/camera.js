// Pick the normal 1x back camera.
// Safari's facingMode "environment" lets the phone choose, and dual-camera iPhones (e.g. iPhone 14)
// often hand over the "Back Dual Wide Camera", which starts on the 0.5x ultra-wide lens: the picture
// looks zoomed out and small, and Remy sees less detail. iOS names its cameras "Back Camera" (1x),
// "Back Ultra Wide Camera", "Back Dual Wide Camera", "Back Triple Camera"... so once permission is
// given we switch to "Back Camera" if we didn't get it. Never throws: if anything fails, the
// original camera stays.
const PLAIN_BACK = (label) => /back/i.test(label) && !/ultra|dual|triple|telephoto|wide/i.test(label);

export async function pickMainCamera(stream, { width = 1280 } = {}) {
  let track = stream?.getVideoTracks?.()[0];
  if (!track) return null;
  const switched = { from: track.label || "" };
  if (!PLAIN_BACK(track.label || "")) {
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.label);
      const best = cams.find((d) => /^back camera$/i.test(d.label.trim())) || cams.find((d) => PLAIN_BACK(d.label));
      if (best && best.deviceId !== track.getSettings?.().deviceId) {
        const only = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: best.deviceId }, width: { ideal: width } }, audio: false });
        const next = only.getVideoTracks()[0];
        if (next) { stream.removeTrack(track); track.stop(); stream.addTrack(next); track = next; switched.to = next.label; }
      }
    } catch { /* keep the camera we have */ }
  }
  // Still on a multi-lens virtual camera at its widest (0.5x)? Zoom to 2, which is the 1x lens on those.
  try {
    const caps = track.getCapabilities?.(), now = track.getSettings?.();
    if (/dual wide|triple/i.test(track.label || "") && caps?.zoom && now?.zoom !== undefined && now.zoom <= caps.zoom.min) {
      await track.applyConstraints({ advanced: [{ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2)) }] });
      switched.zoomed = true;
    }
  } catch { /* zoom not supported: fine */ }
  const s = track.getSettings?.() || {};
  return { label: track.label || "?", width: s.width, height: s.height, zoom: s.zoom ?? "n/a", ...switched };
}
