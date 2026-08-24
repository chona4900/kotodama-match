const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getNextEvolutionStage,
  getUltimateAttemptGoal,
  getUltimateProgressStart,
  isUltimateAttemptDue,
} = require('../progression.js');

test('通常進化は回数を飛び越えても必ず1段ずつ進む', () => {
  assert.equal(getNextEvolutionStage(0, 4900), 1);
  assert.equal(getNextEvolutionStage(1, 4900), 2);
  assert.equal(getNextEvolutionStage(2, 4900), 3);
  assert.equal(getNextEvolutionStage(3, 4900), null);
});

test('究極進化は初回4900回、以後4900回ごとに再挑戦する', () => {
  assert.equal(getUltimateAttemptGoal(0), 4900);
  assert.equal(getUltimateAttemptGoal(1), 9800);
  assert.equal(getUltimateAttemptGoal(2), 14700);
  assert.equal(getUltimateProgressStart(0), 3000);
  assert.equal(getUltimateProgressStart(1), 4900);
  assert.equal(getUltimateProgressStart(2), 9800);
});

test('究極進化の判定は第4段階かつ次の目標到達時だけ発火する', () => {
  assert.equal(isUltimateAttemptDue(3, 4899, 0), false);
  assert.equal(isUltimateAttemptDue(3, 4900, 0), true);
  assert.equal(isUltimateAttemptDue(3, 9799, 1), false);
  assert.equal(isUltimateAttemptDue(3, 9800, 1), true);
  assert.equal(isUltimateAttemptDue(2, 9800, 1), false);
  assert.equal(isUltimateAttemptDue(4, 9800, 1), false);
});
