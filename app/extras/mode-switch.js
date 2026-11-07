// Owner: Felix. Change Remy's attitude MID-COOK by tapping the attitude badge (#83).
//
// app.js calls initModeSwitch() once. You get:
//   badge   - the "Honest" chip on the cooking screen (#mode-badge)
//   getMode - () => "gentle" | "honest" | "savage"
//   setMode - (mode) => switches everything: badge text, Remy's face, and tells Remy
//             (sends `mode_changed`, docs/CONTRACT.md). Call it after the user picks.
//
// Rules: Savage needs the 18+ "yes" first (like the start screen), and safety alerts
// still beat everything. Keep it to one tap to open, one tap to pick.
//
// STARTER: does nothing yet.
export function initModeSwitch({ badge, getMode, setMode }) {
  void badge; void getMode; void setMode;
}
