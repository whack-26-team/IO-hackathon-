import test from 'node:test';
import assert from 'node:assert/strict';
import { createActions } from './actions.js';
import { readFileSync } from 'node:fs';

const tools = JSON.parse(readFileSync(new URL('../../remy-brain/actions.json', import.meta.url))).tools;
const lesson = { id: 'lesson-claw-grip', lesson: true, steps: [{ instruction: 'Practise the claw.' }] };
const make = (recipe) => {
  const events = [];
  const actions = createActions({ emit: (type, data) => events.push({ type, data }), alive: () => true });
  actions.configure({ tools, recipe });
  return { actions, events };
};

test('lesson_score awards stars directly and rejects an old /10 score', async () => {
  const f = make(lesson);
  assert.equal((await f.actions.call('lesson_score', { score: 7, comment: 'Good grip.' })).ok, false);
  const result = await f.actions.call('lesson_score', { score: 4, comment: 'Good grip.' });
  assert.match(result.message, /4 out of 5 stars/);
  assert.deepEqual(f.events.filter(e => e.type === 'lesson_score').map(e => e.data.score), [4]);
});

test('lesson_score cannot mark a normal recipe', async () => {
  const f = make({ id: 'toast', steps: [{ instruction: 'Toast bread.' }] });
  assert.equal((await f.actions.call('lesson_score', { score: 5, comment: 'Great.' })).ok, false);
});
