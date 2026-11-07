// Owner: Ahmed
// REAL REMY: the live call to OpenAI (voice in/out + ~1 camera picture per second).
// Same interface as mock.js: { on, send, start, stop }. See docs/CONTRACT.md.
//
// STARTER CODE, NOT YET TESTED against OpenAI. Ahmed: check every step against
// OpenAI's current Realtime (WebRTC) docs, since names and URLs changed in 2026.
//
// Flow:
//   1. POST /api/session {recipe_id, mode}       -> short-lived pass (client_secret)
//   2. WebRTC: send mic track, receive Remy's voice track, open a data channel
//   3. Data channel: send camera pictures as image input every ~1s
//   4. Remy calls "tools" (actions.json) -> we turn them into screen events
//   5. Screen events (timer_check/timer_done) -> sent to Remy as messages

const FRAME_EVERY_MS = 1000;
const FRAME_WIDTH = 512;

export function createLiveRemy({ recipe, mode, stream, video, canvas }) {
  const handlers = {};
  const emit = (type, data) => (handlers[type] || []).forEach((h) => h(data));
  let pc, dc, frameTimer, stopTimer, audioEl;

  function sendEvent(obj) {
    if (dc?.readyState === "open") dc.send(JSON.stringify(obj));
  }

  function sendText(text) {
    sendEvent({ type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    sendEvent({ type: "response.create" });
  }

  function captureFrame() {
    if (!video.videoWidth) return null;
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.round(FRAME_WIDTH * video.videoHeight / video.videoWidth);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  }

  function sendFrame() {
    if (document.hidden) return; // save money when the app isn't on screen
    const image = captureFrame();
    if (!image) return;
    // TODO(Ahmed): confirm the image input format in the Realtime docs.
    sendEvent({ type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_image", image_url: image }] } });
  }

  // Remy's actions (tools in actions.json) -> screen events
  function handleToolCall(name, args, callId) {
    const map = {
      show_tip: () => emit("tip", { text: args.text, severity: args.severity || "info" }),
      roast: () => emit("roast", { text: args.text, level: args.level || 1 }),
      safety_alert: () => emit("alert", { text: args.text }),
      update_step: () => emit("step", args),
      start_timer: () => emit("timer_start", {
        id: args.id || args.label, label: args.label,
        seconds: Math.round(args.minutes * 60),
        check_at: args.check_at_minutes ? Math.round(args.check_at_minutes * 60) : undefined }),
      cancel_timer: () => emit("timer_cancel", { id: args.id }),
    };
    (map[name] || (() => console.warn("unknown tool", name)))();
    sendEvent({ type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify({ ok: true }) } });
  }

  function onServerEvent(e) {
    const ev = JSON.parse(e.data);
    // TODO(Ahmed): confirm event names in the docs.
    if (ev.type === "response.function_call_arguments.done") {
      handleToolCall(ev.name, JSON.parse(ev.arguments || "{}"), ev.call_id);
    } else if (ev.type === "error") {
      emit("status", { status: "error", message: "⚠️ " + (ev.error?.message || "Remy error") });
    }
  }

  return {
    on(type, fn) { (handlers[type] ||= []).push(fn); },

    // Messages from the screen (timers etc.) -> tell Remy
    send(type, data) {
      if (type === "timer_check") sendText(`[TIMER CHECK] ${data.label}: tell the cook to check it now.`);
      if (type === "timer_done") sendText(`[TIMER DONE] ${data.label} has finished. React now.`);
      if (type === "mode_changed") sendText(`[MODE] Switch personality to ${data.mode}.`);
    },

    async start() {
      emit("status", { status: "connecting", message: "connecting to Remy…" });
      try {
        const res = await fetch("/api/session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: recipe.id, mode }),
        });
        const session = await res.json();
        if (!res.ok) throw new Error(session.detail || "Could not start a session");

        pc = new RTCPeerConnection();
        audioEl = new Audio();
        audioEl.autoplay = true;
        pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };
        stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));

        dc = pc.createDataChannel("oai-events");
        dc.onmessage = onServerEvent;
        dc.onopen = () => {
          emit("status", { status: "live", message: "🟢 Remy is watching" });
          sendText("[START] The cook has just started. Greet them in character and check you can see the hob.");
          frameTimer = setInterval(sendFrame, FRAME_EVERY_MS);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // TODO(Ahmed): confirm this URL in the docs.
        const sdp = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST", body: offer.sdp,
          headers: { Authorization: `Bearer ${session.client_secret}`, "Content-Type": "application/sdp" },
        });
        if (!sdp.ok) throw new Error("OpenAI refused the call: " + (await sdp.text()));
        await pc.setRemoteDescription({ type: "answer", sdp: await sdp.text() });

        stopTimer = setTimeout(() => {
          sendText("[SESSION ENDING] Say a quick sign-off.");
          setTimeout(() => this.stop(), 8000);
        }, (session.max_minutes || 10) * 60 * 1000);
      } catch (err) {
        emit("status", { status: "error", message: "⚠️ " + err.message });
      }
    },

    stop() {
      clearInterval(frameTimer);
      clearTimeout(stopTimer);
      dc?.close();
      pc?.close();
      if (audioEl) audioEl.srcObject = null;
    },
  };
}
