// Share card (#116): turn the recap into an image and open the phone's share sheet.
// Only made when the cook taps Share; nothing is saved automatically.
const BG = { gentle: "#eaf3fb", honest: "#fff4e0", savage: "#2a1714" };
const FG = { gentle: "#1a1a1a", honest: "#1a1a1a", savage: "#fff4e0" };

function loadImage(src) {
  return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(" "); const lines = []; let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function makeCard(app) {
  const s = app.stats(); const mode = app.mode;
  const score = document.getElementById("recap-score")?.textContent || `${s.stars}/5 stars`;
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const ctx = c.getContext("2d");
  ctx.fillStyle = BG[mode] || BG.honest; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = FG[mode] || FG.honest; ctx.textAlign = "center";
  ctx.font = "800 120px system-ui, sans-serif"; ctx.fillText("REMY", 540, 190);
  ctx.font = "600 44px system-ui, sans-serif"; ctx.fillText("your live AI chef", 540, 255);
  const face = await loadImage("icon.png");
  if (face) ctx.drawImage(face, 340, 310, 400, 400);
  ctx.font = "800 64px system-ui, sans-serif";
  wrapText(ctx, s.dish || "Freestyle cook", 940).slice(0, 2).forEach((l, i) => ctx.fillText(l, 540, 800 + i * 76));
  ctx.font = "600 46px system-ui, sans-serif";
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  ctx.fillText(`⏱ ${n(s.timers, "timer", "timers")}   🛟 ${n(s.alerts, "save", "saves")}   🔥 ${n(s.roasts, "roast", "roasts")}`, 540, 990);
  ctx.font = "800 72px system-ui, sans-serif";
  wrapText(ctx, score, 960).slice(0, 2).forEach((l, i) => ctx.fillText(l, 540, 1120 + i * 84));
  ctx.font = "500 36px system-ui, sans-serif"; ctx.globalAlpha = 0.7;
  ctx.fillText("remy-2wc2.onrender.com", 540, 1300);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

export function initShare(app) {
  app.on("goodbye", () => {
    const slot = document.getElementById("slot-goodbye");
    slot.querySelector(".x-share")?.remove();
    const btn = document.createElement("button");
    btn.className = "x-share"; btn.textContent = "📤 Share";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();              // the goodbye screen goes back to start on tap
      app.keepGoodbye();                // and stays put while sharing
      const blob = await makeCard(app);
      if (!blob) return;
      const file = new File([blob], "remy-score.png", { type: "image/png" });
      try {
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "My REMY score" }); return; }
      } catch { return; /* cancelled */ }
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "remy-score.png" });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    slot.append(btn);
  });
}
