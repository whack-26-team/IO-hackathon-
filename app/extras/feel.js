// Look & feel (#119): make the cooking screen feel alive, using only the app's events and CSS
// classes on <body> (styles in extras.css).
const PRAISE = /\b(perfect|beautiful|lovely|excellent|great job|nailed|proud|gorgeous|magnificent|flawless|competent|well done|nice one)\b/i;

function pulse(cls, ms) {
  document.body.classList.remove(cls); void document.body.offsetWidth;
  document.body.classList.add(cls);
  clearTimeout(pulse[cls]); pulse[cls] = setTimeout(() => document.body.classList.remove(cls), ms);
}

function confetti(count = 40) {
  const host = document.createElement("div"); host.className = "x-confetti";
  const colours = ["#e8442e", "#ffd166", "#5ec2a0", "#7db7e8", "#fff4e0"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colours[i % colours.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.setProperty("--drift", `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    host.append(p);
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 2600);
}

function steam() {
  const face = document.getElementById("cook-face");
  if (!face) return;
  const r = face.getBoundingClientRect();
  for (const side of [-1, 1]) {
    const puff = document.createElement("span"); puff.className = "x-steam"; puff.textContent = "💨";
    puff.style.left = `${r.left + r.width / 2 + side * r.width * 0.45}px`;
    puff.style.top = `${r.top + r.height * 0.25}px`;
    puff.style.setProperty("--dir", side);
    document.body.append(puff);
    setTimeout(() => puff.remove(), 1200);
  }
}

export function initFeel(app) {
  app.on("status", (d) => document.body.classList.toggle("x-speaking", d?.status === "remy-speaking"));
  app.on("roast", () => { pulse("x-shake", 500); if (app.mode === "savage") steam(); });
  app.on("alert", () => pulse("x-alert-edge", 7000));
  app.on("tip", (d) => { if (d?.severity === "info" && PRAISE.test(d.text || "")) confetti(30); });
  app.on("start", () => pulse("x-slide-in", 500));
  app.on("goodbye", ({ stats }) => { document.body.classList.remove("x-speaking", "x-alert-edge"); if (stats.score >= 8) confetti(60); });
}
