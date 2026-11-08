// Owner: Matthew. Backup Remy (Gemini) and the automatic switch from ElevenLabs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLiveRemy } from './live.js';
import { createGeminiRemy } from './gemini-backup.js';

const tools = JSON.parse(await readFile(new URL('../../remy-brain/actions.json', import.meta.url), 'utf8')).tools;
const tick = () => new Promise(r => setImmediate(r));
const fakeRemy = () => { const h = {}; const r = { started: 0, stopped: 0, sent: [],
  on: (t, f) => (h[t] ||= []).push(f), emit: (t, d) => (h[t] || []).forEach(f => f(d)),
  start() { r.started++; }, stop() { r.stopped++; }, send(t, d) { r.sent.push([t, d]); return true; } }; return r; };

test('ElevenLabs failing switches to the backup; its error is not shown; events flow from the backup', async () => {
  const p = fakeRemy(), b = fakeRemy(); const seen = [];
  const remy = createLiveRemy({ mode: 'honest' }, { primary: () => p, backup: () => b, forceBackup: false });
  for (const t of ['status', 'tip', 'timer_start']) remy.on(t, d => seen.push([t, d]));
  remy.start();
  p.emit('status', { status: 'live', message: 'Listening' });
  p.emit('status', { status: 'error', message: 'Could not connect Remy (quota)' });
  assert.equal(p.stopped, 1); assert.equal(b.started, 1);
  assert.ok(!seen.some(([t, d]) => t === 'status' && d.status === 'error'));
  assert.ok(seen.some(([t, d]) => t === 'tip' && /backup voice/.test(d.text)));
  p.emit('timer_start', { id: 'old' }); b.emit('timer_start', { id: 'new' });
  assert.deepEqual(seen.filter(([t]) => t === 'timer_start').map(([, d]) => d.id), ['new']);
  assert.equal(remy.send('goodbye', { text: 'Bye' }), true); assert.deepEqual(b.sent[0], ['goodbye', { text: 'Bye' }]);
});

test('?backup forces the backup and never starts ElevenLabs', () => {
  const p = fakeRemy(), b = fakeRemy();
  createLiveRemy({ mode: 'savage' }, { primary: () => p, backup: () => b, forceBackup: true }).start();
  assert.equal(p.started, 0); assert.equal(b.started, 1);
});

test('backup Remy: greets, finds the recipe, speaks, and starts the timer when the cook says pasta is in', async () => {
  const said = [], calls = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = { getVoices: () => [], cancel() {}, speak(u) { said.push(u.text); setImmediate(() => u.onend?.()); } };
  const recipe = { id: 'rigatoni', title: 'Rigatoni', steps: [{ instruction: 'Boil' }, { instruction: 'In', timer: { label: 'Rigatoni', minutes: 11, check_at: 10, from: 'pasta_dried_minutes_al_dente/rigatoni/default' } }] };
  const replies = [
    { say: 'Evening, chef. What are we cooking?', actions: [] },
    { say: 'Rigatoni, lovely.', actions: [{ name: 'find_recipe', args: { dish: 'rigatoni' } }] },
    { say: 'Got the recipe. Get the water boiling.', actions: [] },
    { say: '11-minute timer for the rigatoni pasta.', actions: [] },
  ];
  const fetcher = async (path, init) => {
    const body = init?.body ? JSON.parse(init.body) : null; calls.push([path, body]);
    const json = path === '/api/brain' ? { instructions: 'x', tools }
      : path.startsWith('/api/recipes/find') ? { found: true, source: 'remy', checked_by_human: true, recipe }
      : replies.shift() || { say: '', actions: [] };
    return { ok: true, json: async () => json };
  };
  let rec = null;
  globalThis.SpeechRecognition = class { constructor() { rec = this; } start() {} abort() {} };
  const speak = text => rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  const events = [];
  const remy = createGeminiRemy({ mode: 'honest', fetcher });
  for (const t of ['status', 'recipe', 'timer_start', 'tip']) remy.on(t, d => events.push([t, d]));
  await remy.start(); for (let i = 0; i < 10; i++) await tick();
  assert.equal(said[0], 'Evening, chef. What are we cooking?');
  assert.ok(rec, 'listening after speaking');
  speak("I'm making rigatoni"); for (let i = 0; i < 20; i++) await tick();
  assert.ok(events.some(([t]) => t === 'recipe'), 'recipe shown');
  assert.deepEqual(said.slice(1, 3), ['Rigatoni, lovely.', 'Got the recipe. Get the water boiling.']);
  const followUp = calls.filter(([p]) => p === '/api/chat')[2][1];
  assert.match(followUp.note, /ACTION RESULTS/); assert.equal(followUp.recipe_id, 'rigatoni');
  speak("Pasta's in"); for (let i = 0; i < 20; i++) await tick();
  assert.equal(events.find(([t]) => t === 'timer_start')[1].seconds, 660);
  assert.match(calls.filter(([p]) => p === '/api/chat')[3][1].note, /TIMER STARTED BY APP/);
  assert.equal(said[3], '11-minute timer for the rigatoni pasta.');
  speak('Remy?'); for (let i = 0; i < 4; i++) await tick();
  assert.equal(said.at(-1), 'Yes, chef?');
  assert.equal(calls.filter(([p]) => p === '/api/chat').length, 4, 'wake call needs no Gemini request');
  assert.equal(remy.send('goodbye', { text: 'Plate it.' }), true); await tick();
  assert.equal(said.at(-1), 'Plate it.');
  await remy.stop();
});
