// Owner: Ahmed. C1 voice prototype; camera perception is not connected yet.
// SDK is loaded only after Start, so the mock and existing live route stay independent.
export const SDK_URL = "https://esm.sh/@elevenlabs/client@1.35.0?bundle";

export function createElevenLabsRemy({
  agentId, recipe, mode = "honest", maxMinutes = 2,
  onTranscript = () => {},
  loadSDK = () => import(SDK_URL),
  page = document,
}) {
  const handlers = {};
  let conversation = null;
  let generation = 0;
  let active = false;
  let limitTimer;
  const emit = (type, data) => (handlers[type] || []).forEach(fn => fn(data));
  const status = (value, message) => emit("status", { status: value, message });

  async function close(value, message) {
    active = false;
    generation++;
    clearTimeout(limitTimer);
    page.removeEventListener("visibilitychange", onHidden);
    const old = conversation;
    conversation = null;
    try { await old?.endSession(); }
    catch { /* Still let the user restart after a disconnected transport. */ }
    status(value, message);
  }

  function onHidden() {
    // End rather than silently consume call minutes while the phone is locked.
    if (page.hidden) void close("stopped", "Stopped while the page was hidden. Tap Start to reconnect.");
  }

  function sendText(text) {
    if (!conversation) return false;
    conversation.sendUserMessage(text);
    return true;
  }

  return {
    on(type, handler) { (handlers[type] ||= []).push(handler); },
    async start() {
      if (active) return;
      if (!agentId || !/^agent_[a-zA-Z0-9]+$/.test(agentId)) {
        status("error", "Enter an ElevenLabs agent ID, not an API key.");
        return;
      }
      active = true;
      const run = ++generation;
      status("connecting", "Connecting to Remy…");
      page.addEventListener("visibilitychange", onHidden);
      const minutes = Number.isFinite(maxMinutes) ? Math.min(10, Math.max(0.1, maxMinutes)) : 2;
      limitTimer = setTimeout(() => void close("stopped", "Test time limit reached."), minutes * 60000);
      try {
        const { Conversation } = await loadSDK();
        if (run !== generation) return;
        const session = await Conversation.startSession({
          agentId,
          connectionType: "webrtc",
          onMessage: ({ source, message }) => {
            if (run !== generation || typeof message !== "string") return;
            onTranscript({ source, message });
            if (source === "ai") emit("tip", { text: message, severity: "info" });
          },
          onModeChange: ({ mode: speechMode }) => {
            if (run === generation) status(speechMode === "speaking" ? "remy-speaking" : "live",
              speechMode === "speaking" ? "Remy is speaking" : "Listening — camera not connected");
          },
          onDisconnect: () => {
            if (run === generation) void close("stopped", "Call ended. Tap Start to reconnect.");
          },
          onError: () => {
            if (run === generation) void close("error", "Voice connection failed. Check microphone access, agent settings, and your connection.");
          },
        });
        // Stop may have been pressed while the SDK was still connecting.
        if (run !== generation) { await session.endSession(); return; }
        conversation = session;
        session.sendContextualUpdate(JSON.stringify({
          source: "remy_app", session: "voice_test", camera_connected: false,
          selected_personality: mode, selected_recipe: recipe || null,
          note: "No camera or action tools are connected in this test. Do not claim to see food, start timers, or persist changes. Guide the selected recipe conversationally.",
        }));
        status("live", "Listening — camera not connected");
      } catch {
        if (run === generation) await close("error", "Could not connect. Check microphone permission, internet, and that this agent permits public connections.");
      }
    },
    send(type, data = {}) {
      if (type === "mode_changed" && ["gentle", "honest", "savage"].includes(data.mode)) {
        return sendText(`[APP SETTING] The user selected ${data.mode} personality. Apply it to future replies.`);
      }
      if (["timer_check", "timer_done"].includes(type) && typeof data.label === "string") {
        return sendText(`[APP TIMER EVENT: ${type}] ${data.label.slice(0, 120)}. Give a brief relevant instruction.`);
      }
      return false;
    },
    stop() { return close("stopped", "Stopped. Microphone session closed."); },
  };
}
