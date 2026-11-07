import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Load the plain browser ES module without adding a repository-wide package.json.
const source = await readFile(new URL('./elevenlabs.js', import.meta.url), 'utf8');
const { createElevenLabsRemy } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(startSession) {
  const page = new EventTarget();
  page.hidden = false;
  const calls = { closed: 0, contexts: [], messages: [], options: null };
  const session = {
    endSession: async () => { calls.closed++; },
    sendContextualUpdate: text => calls.contexts.push(JSON.parse(text)),
    sendUserMessage: text => calls.messages.push(text),
  };
  const remy = createElevenLabsRemy({ agentId: 'agent_test', page,
    loadSDK: async () => ({ Conversation: { startSession: async options => {
      calls.options = options;
      return startSession ? startSession(session, options) : session;
    } } }),
  });
  const statuses = [];
  remy.on('status', value => statuses.push(value));
  return { remy, calls, page, statuses };
}

test('connection supplies honest context and forwards timer messages', async () => {
  const { remy, calls } = fixture();
  await remy.start();
  try {
    assert.equal(calls.options.connectionType, 'webrtc');
    assert.equal(calls.contexts[0].camera_connected, false);
    assert.equal(remy.send('timer_done', { label: 'Pasta' }), true);
    assert.match(calls.messages[0], /APP TIMER EVENT: timer_done/);
    assert.equal(remy.send('mode_changed', { mode: 'unknown' }), false);
  } finally { await remy.stop(); }
  assert.equal(calls.closed, 1);
  assert.equal(remy.send('timer_done', { label: 'Pasta' }), false);
});

test('Stop while connecting closes the late session without reviving it', async () => {
  let resolve;
  const { remy, calls, statuses } = fixture(session => new Promise(done => { resolve = () => done(session); }));
  const pending = remy.start();
  await new Promise(done => setImmediate(done));
  await remy.stop();
  resolve();
  await pending;
  assert.equal(calls.closed, 1);
  assert.equal(calls.contexts.length, 0);
  assert.equal(statuses.at(-1).status, 'stopped');
});

test('hidden page ends the call and ignores late callbacks', async () => {
  const { remy, calls, page, statuses } = fixture();
  await remy.start();
  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  await new Promise(done => setImmediate(done));
  calls.options.onModeChange({ mode: 'speaking' });
  assert.equal(calls.closed, 1);
  assert.equal(statuses.at(-1).status, 'stopped');
});

test('failed connection reports an error and allows a new attempt', async () => {
  let attempts = 0;
  const { remy, statuses } = fixture(session => {
    if (++attempts === 1) throw new Error('permission denied');
    return session;
  });
  await remy.start();
  assert.equal(statuses.at(-1).status, 'error');
  await remy.start();
  try { assert.equal(statuses.at(-1).status, 'live'); }
  finally { await remy.stop(); }
});

test('duplicate Start does not open two calls', async () => {
  let attempts = 0;
  const { remy } = fixture(session => { attempts++; return session; });
  await Promise.all([remy.start(), remy.start()]);
  await remy.stop();
  assert.equal(attempts, 1);
});

test('SDK errors release the active session', async () => {
  const { remy, calls, statuses } = fixture();
  await remy.start();
  calls.options.onError('connection lost');
  await new Promise(done => setImmediate(done));
  assert.equal(calls.closed, 1);
  assert.equal(statuses.at(-1).status, 'error');
});
