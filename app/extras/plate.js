// Rate my plate (#6): 📸 on the cooking screen takes a photo of the finished dish. Gemini scores
// it 1-10 on looks only (never "safe to eat") with a one-line verdict in Remy's attitude. The
// score counts for half the final recap score.
export function initRatePlate(app) {
  const btn = document.createElement("button");
  btn.className = "x-tool"; btn.textContent = "📸 Rate my plate";
  btn.setAttribute("aria-label", "Rate my plate");
  document.getElementById("slot-cook-tools")?.append(btn);

  let busy = false;
  btn.addEventListener("click", async () => {
    if (busy) return;
    const video = document.getElementById("camera");
    if (!video?.videoWidth) { app.say("I can't see anything yet. Point the camera at your plate."); return; }
    busy = true; btn.disabled = true; btn.textContent = "📸 Judging…";
    try {
      const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
      c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
      const r = await fetch("/api/vision/plate", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: c.toDataURL("image/jpeg", 0.75), dish: app.stats().dish || "", mode: app.mode }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
      if (data.retake || !data.score) {
        app.say(`${data.verdict || "I can't see the plate."} ${data.retake_tip || "Hold it closer, in good light."}`.trim());
        return;
      }
      app.setPlate(data.score, data.verdict);
      showCard(data.score, data.verdict);
      app.say(`${data.score} out of 10. ${data.verdict}`, { voice: true });
    } catch (e) {
      app.say(`Couldn't judge the plate (${String(e.message || e).slice(0, 60)}). Try again.`);
    } finally {
      busy = false; btn.disabled = false; btn.textContent = "📸 Rate my plate";
    }
  });

  function showCard(score, verdict) {
    document.querySelector(".x-plate-card")?.remove();
    const card = document.createElement("button");
    card.className = "x-plate-card";
    card.innerHTML = `<small>Plate score</small><b></b><span></span><em>Tap to close</em>`;
    card.querySelector("b").textContent = `${score}/10`;
    card.querySelector("span").textContent = verdict;
    card.addEventListener("click", () => card.remove());
    document.getElementById("cook-screen")?.append(card);
    setTimeout(() => card.remove(), 9000);
  }
  app.on("stop", () => document.querySelector(".x-plate-card")?.remove());
}
