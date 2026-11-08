import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForVoice } from './review-flow.js';

function fixture() {
  const handlers = [];
  const remy = { on(type, fn) { if (type === 'status') handlers.push(fn); } };
  return { remy, status: (status) => handlers.forEach(fn => fn({ status })) };
}

test('review waits for a line already being spoken', async () => {
  const f = fixture(); let finished = false;
  const wait = waitForVoice(f.remy, 'remy-speaking').then(() => { finished = true; });
  await Promise.resolve(); assert.equal(finished, false);
  f.status('live'); await wait; assert.equal(finished, true);
});

test('automatic finish waits for a response that starts after the action', async () => {
  const f = fixture(); let finished = false;
  const wait = waitForVoice(f.remy, 'live', true).then(() => { finished = true; });
  f.status('remy-speaking'); await Promise.resolve(); assert.equal(finished, false);
  f.status('live'); await wait; assert.equal(finished, true);
});

test('manual stop with no active reply can proceed to goodbye', async () => {
  const f = fixture();
  await waitForVoice(f.remy, 'live');
});
