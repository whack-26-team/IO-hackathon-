// Judge mode + highlights reel (#117).
// ?judge=1: judges get Honest and real Remy. The judge page's QR link also
// adds &backup=1, so they use the low-cost backup voice. /judge shows that QR code.
export function initJudgeMode() {
  if (!new URLSearchParams(location.search).has("judge")) return;
  const honest = document.querySelector('input[name="mode"][value="honest"]');
  if (honest && !honest.checked) honest.click();
  const tag = document.createElement("div");
  tag.className = "x-judge-tag"; tag.textContent = "Judge mode";
  document.getElementById("start-screen")?.append(tag);
}

// Highlights now live in 🏆 Your cooks (each past cook shows its best moment), so the goodbye
// page stays clean. Kept as a no-op so older callers don't break.
export function initHighlights() {}
