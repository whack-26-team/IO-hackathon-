import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleIngredient as s } from './servings.js';
test('scales main amounts, leaves notes, sizes and times alone', () => {
  assert.equal(s('200g dried pasta, any shape (about 100g per person)', 2), '400g dried pasta, any shape (about 100g per person)');
  assert.equal(s('2 litres water + 20g (about 1 heaped tbsp) salt', 2), '4 litres water + 40g (about 1 heaped tbsp) salt');
  assert.equal(s('2 tbsp olive oil', 1.5), '3 tbsp olive oil');
  assert.equal(s('3 eggs', 2), '6 eggs');
  assert.equal(s('1 tbsp butter', 0.5), '½ tbsp butter');
  assert.equal(s('About 40g cheddar (or any cheese)', 3), 'About 120g cheddar (or any cheese)');
  assert.equal(s('1 sirloin, ribeye or rump steak, about 2.5cm thick, out of the fridge for 20–30 minutes', 2), '2 sirloin, ribeye or rump steak, about 2.5cm thick, out of the fridge for 20–30 minutes');
  assert.equal(s('Pinch of chilli flakes (optional)', 2), 'Pinch of chilli flakes (optional)');
  assert.equal(s('400g tin chopped tomatoes', 2), '800g tin chopped tomatoes');
  assert.equal(s('About 150ml cold milk (or a plant milk)', 2), 'About 300ml cold milk (or a plant milk)');
  assert.equal(s('3 eggs', 1), '3 eggs');
});
