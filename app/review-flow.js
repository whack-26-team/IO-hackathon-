// Wait for the voice route's speaking -> listening signal before replacing the cook screen.
// A short no-start timeout handles a disconnected voice; the longer cap handles a stuck SDK.
export function waitForVoice(remy, currentStatus, expectSpeech = false, {
  schedule = setTimeout, cancel = clearTimeout, startMs = 5000, maxMs = 30000,
} = {}) {
  if (!remy || currentStatus === 'error' || currentStatus === 'stopped') return Promise.resolve();
  return new Promise(resolve => {
    let speaking = currentStatus === 'remy-speaking', settled = false, startTimer;
    const finish = () => {
      if (settled) return;
      settled = true;
      cancel(startTimer); cancel(maxTimer);
      resolve();
    };
    const maxTimer = schedule(finish, maxMs);
    if (!speaking && expectSpeech) startTimer = schedule(finish, startMs);
    remy.on('status', ({ status }) => {
      if (settled) return;
      if (status === 'remy-speaking') { speaking = true; cancel(startTimer); }
      else if (status === 'error' || status === 'stopped' || (speaking && status === 'live')) finish();
    });
    if (!speaking && !expectSpeech) finish();
  });
}
