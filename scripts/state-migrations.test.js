const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CURRENT_SAVE_DATA_VERSION,
  migrateSavedState,
} = require('../state-migrations.js');

const words = ['ありがとう', '愛してます'];

test('公開前の既知テストデータだけを初期状態へ戻す', () => {
  const result = migrateSavedState({
    currentStage: 0,
    currentForm: 'egg',
    totalCount: 57,
    wordCounts: { ありがとう: 15, 愛してます: 12 },
    intokuPower: 49,
    battleWins: 100,
    battleLosses: 0,
    unlockedForms: ['egg', 'childA_1', 'childA_1_1'],
    unlockedItems: ['yata_no_kagami'],
  }, words, 123456);

  assert.equal(result.didResetKnownTestState, true);
  assert.equal(result.state.saveDataVersion, CURRENT_SAVE_DATA_VERSION);
  assert.equal(result.state.totalCount, 0);
  assert.equal(result.state.battleWins, 0);
  assert.equal(result.state.intokuPower, 0);
  assert.deepEqual(result.state.wordCounts, { ありがとう: 0, 愛してます: 0 });
  assert.deepEqual(result.state.unlockedForms, ['egg']);
  assert.deepEqual(result.state.unlockedItems, []);
});

test('通常のプレイデータは消さず、保存形式だけ更新する', () => {
  const original = {
    currentStage: 2,
    currentForm: 'childB_1',
    totalCount: 2500,
    intokuPower: 8,
    battleWins: 34,
    battleLosses: 12,
    unlockedForms: ['egg', 'childB', 'childB_1'],
  };
  const result = migrateSavedState(original, words, 123456);

  assert.equal(result.didResetKnownTestState, false);
  assert.equal(result.state.saveDataVersion, CURRENT_SAVE_DATA_VERSION);
  assert.equal(result.state.totalCount, 2500);
  assert.equal(result.state.battleWins, 34);
  assert.deepEqual(result.state.unlockedForms, original.unlockedForms);
});
