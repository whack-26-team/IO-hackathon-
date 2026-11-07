import { createElevenLabsRemy } from "./elevenlabs-c1.js";
const $ = id => document.getElementById(id);
let remy;
let generation = 0;
let lastUserAt;

async function loadRecipes() {
  try {
    const response = await fetch("/api/recipes");
    if (!response.ok) return;
    for (const recipe of await response.json()) {
      $("recipe").add(new Option(recipe.title, recipe.id));
    }
  } catch { /* General voice testing also works from a simple static server. */ }
}
void loadRecipes();

function controls(busy) {
  $("start").disabled = busy;
  $("stop").disabled = !busy;
  for (const id of ["agent", "recipe", "mode"]) $(id).disabled = busy;
}

$("start").addEventListener("click", async () => {
  const agentId = $("agent").value.trim();
  if (!/^agent_[a-zA-Z0-9]+$/.test(agentId)) {
    $("status").textContent = "Enter the agent ID from ElevenLabs, not an API key.";
    return;
  }
  const mode = $("mode").value;
  if (mode === "savage" && !confirm("Are you 18+ and happy with swearing and playful cooking roasts?")) return;
  const run = ++generation;
  controls(true);
  $("transcript").replaceChildren();
  $("timing").textContent = "";
  lastUserAt = null;
  $("status").textContent = "Preparing voice test…";
  try {
    let recipe = null;
    if ($("recipe").value) {
      const response = await fetch(`/api/recipes/${encodeURIComponent($("recipe").value)}`);
      if (!response.ok) throw new Error("Could not load the selected recipe.");
      recipe = await response.json();
    }
    if (run !== generation) return;
    remy = createElevenLabsRemy({ agentId, recipe, mode, onTranscript: ({ source, message }) => {
      if (run !== generation) return;
      const line = document.createElement("li");
      line.textContent = `${source === "ai" ? "Remy" : "You"}: ${message}`;
      $("transcript").append(line);
      if (source === "user") lastUserAt = performance.now();
      else if (source === "ai" && lastUserAt !== null) {
        $("timing").textContent = `Transcript response gap: ${((performance.now() - lastUserAt) / 1000).toFixed(1)}s. This is not an audio-latency measurement.`;
        lastUserAt = null;
      }
    }});
    remy.on("status", ({ status, message }) => {
      if (run !== generation) return;
      $("status").textContent = message;
      if (["error", "stopped"].includes(status)) controls(false);
    });
    await remy.start();
  } catch (error) {
    if (run === generation) { $("status").textContent = error.message; controls(false); }
  }
});

$("stop").addEventListener("click", async () => {
  generation++;
  const old = remy;
  remy = null;
  await old?.stop();
  $("status").textContent = "Stopped.";
  controls(false);
});
window.addEventListener("pagehide", () => { generation++; void remy?.stop(); });
