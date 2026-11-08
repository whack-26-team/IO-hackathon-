// Judge mode + highlights reel (#117).
// ?judge=1: judges get Honest and real Remy (Pretend unticked). The judge page's QR link also
// adds &backup=1, so they use the low-cost backup voice. /judge shows that QR code.
export function initJudgeMode() {
  if (!new URLSearchParams(location.search).has("judge")) return;
  const mock = document.getElementById("use-mock");
  if (mock) mock.checked = false;
  const honest = document.querySelector('input[name="mode"][value="honest"]');
  if (honest && !honest.checked) honest.click();
  const tag = document.createElement("div");
  tag.className = "x-judge-tag"; tag.textContent = "🧑‍⚖️ Judge mode";
  document.getElementById("start-screen")?.append(tag);
}

// Highlights: on the goodbye screen, the session's best moments play one at a time (text only).
const ICON = { roast: "🔥", alert: "🛟", timer: "⏱" };
export function initHighlights(app) {
  let ticker = null;
  app.on("goodbye", ({ stats }) => {
    const slot = document.getElementById("slot-goodbye");
    slot.querySelector(".x-highlights")?.remove();
    clearInterval(ticker);
    // the best bits: safety saves and roasts first, then timers; at most 6
    const lines = [...stats.highlights].sort((a, b) => "alert roast timer".indexOf(a.kind) - "alert roast timer".indexOf(b.kind)).slice(0, 6);
    if (!lines.length) return;
    const box = document.createElement("div"); box.className = "x-highlights";
    const label = document.createElement("small"); label.textContent = "Highlights";
    const line = document.createElement("div"); line.className = "x-highlight";
    box.append(label, line);
    slot.prepend(box);
    let i = 0;
    const show = () => {
      const h = lines[i++ % lines.length];
      line.textContent = `${ICON[h.kind] || "•"} ${h.text}`;
      line.classList.remove("x-in"); void line.offsetWidth; line.classList.add("x-in");
    };
    show();
    ticker = setInterval(show, 1800);
  });
  app.on("start", () => clearInterval(ticker));
}
