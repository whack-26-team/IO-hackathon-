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

// A sticker icon from the app's SVG pieces (timer, life ring, flame), as an image for the canvas
function iconImage(id) {
  const defs = document.querySelector("svg defs");
  if (!defs) return Promise.resolve(null);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" width="200" height="200"><defs>${defs.innerHTML}</defs><use href="#${id}" xlink:href="#${id}"/></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  return loadImage(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
}
// Remy's face for the card, drawn from the app's own cartoon (the same SVG pieces as on screen)
function faceImage(id, wide) {
  const defs = document.querySelector("svg defs");
  if (!defs) return Promise.resolve(null);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${wide ? "-32 -14 164 120" : "-18 -12 136 116"}" width="820" height="${wide ? 600 : 700}"><defs>${defs.innerHTML}</defs><use href="#${id}" xlink:href="#${id}"/></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  return loadImage(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
}
// A chunky cartoon star (ink outline, butter fill; empty ones faded)
function star(ctx, x, y, r, on, mode) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.lineJoin = "round";
  if (on) { ctx.save(); ctx.translate(6, 6); ctx.fillStyle = "#1a1a1a"; ctx.fill(); ctx.restore(); }
  ctx.fillStyle = on ? "#ffd166" : (mode === "savage" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.1)"); ctx.fill();
  if (on) { ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 7; ctx.stroke(); }
}
const FACE = { gentle: "f-gentle", honest: "f-proud", savage: "f-savage" };

export async function makeCard(app) {
  const s = app.stats(); const mode = app.mode;
  const line = document.getElementById("recap-line")?.textContent || "";
  // the card uses the app's fonts: make sure they're loaded before drawing
  await Promise.all(['150px "Leckerli One"', '52px "Caveat Brush"', '700 60px "Baloo 2"'].map((f) => document.fonts?.load(f).catch(() => {})));
  const BOX = '"Baloo 2", system-ui, sans-serif';
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const ctx = c.getContext("2d");
  ctx.fillStyle = BG[mode] || BG.honest; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = FG[mode] || FG.honest; ctx.textAlign = "center";
  ctx.font = '150px "Leckerli One", system-ui, sans-serif'; ctx.fillText("REMY", 540, 200);
  ctx.font = '56px "Caveat Brush", system-ui, sans-serif'; ctx.globalAlpha = 0.75; ctx.fillText("your live AI chef", 540, 275); ctx.globalAlpha = 1;
  const shocked = mode === "savage" && s.stars === 5;
  const faceId = shocked ? "f-shock" : (FACE[mode] || FACE.honest);
  const face = (await faceImage(faceId, mode === "savage")) || (await loadImage("icon.png"));
  if (face) { const w = 420, h = w * face.height / face.width; ctx.drawImage(face, 540 - w / 2, 300, w, h); }
  ctx.font = `700 60px ${BOX}`;
  wrapText(ctx, s.dish || "Freestyle cook", 940).slice(0, 2).forEach((l, i) => ctx.fillText(l, 540, 760 + i * 70));
  for (let i = 0; i < 5; i++) star(ctx, 540 + (i - 2) * 130, 900, 56, i < s.stars, mode);
  ctx.fillStyle = FG[mode] || FG.honest;
  ctx.font = `700 64px ${BOX}`;
  wrapText(ctx, line, 960).slice(0, 2).forEach((l, i) => ctx.fillText(l, 540, 1060 + i * 74));
  // timer / life ring / flame stickers with their counts
  ctx.font = `700 52px ${BOX}`;
  const icons = await Promise.all(["i-timer", "i-buoy", "i-flame"].map(iconImage));
  [s.timers, s.alerts, s.roasts].forEach((k, i) => {
    const x = 540 + (i - 1) * 230;
    if (icons[i]) ctx.drawImage(icons[i], x - 92, 1160, 84, 84);
    ctx.textAlign = "left"; ctx.fillText(String(k), x + 2, 1222); ctx.textAlign = "center";
  });
  ctx.font = '38px "Caveat Brush", system-ui, sans-serif'; ctx.globalAlpha = 0.65;
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
