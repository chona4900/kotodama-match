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
  assert.equal(result.state.ultimateAttemptCount, 0);
  assert.equal(result.state.battleWins, 0);
  assert.equal(result.state.intokuPower, 0);
  assert.deepEqual(result.state.wordCounts, { ありがとう: 0, 愛してます: 0 });
  assert.deepEqual(result.state.cycleWordCounts, { ありがとう: 0, 愛してます: 0 });
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
  assert.deepEqual(result.state.cycleWordCounts, { ありがとう: 0, 愛してます: 0 });
});

test('旧版の究極進化失敗で巻き戻された100回を復元する', () => {
  const result = migrateSavedState({
    saveDataVersion: 2,
    currentStage: 3,
    currentForm: 'childA_1_1',
    totalCount: 4800,
    wordCounts: { ありがとう: 4900, 愛してます: 0 },
    unlockedForms: ['egg', 'childA', 'childA_1', 'childA_1_1'],
  }, words, 123456);

  assert.equal(result.state.totalCount, 4900);
  assert.equal(result.state.ultimateAttemptCount, 1);
  assert.deepEqual(result.state.cycleWordCounts, { ありがとう: 4900, 愛してます: 0 });
});

test('既存の言霊別回数を転生サイクル用回数へ安全に引き継ぐ', () => {
  const result = migrateSavedState({
    saveDataVersion: 2,
    currentStage: 2,
    currentForm: 'childB_1',
    totalCount: 2500,
    wordCounts: { ありがとう: 1400, 愛してます: 1100 },
  }, words, 123456);

  assert.deepEqual(result.state.wordCounts, { ありがとう: 1400, 愛してます: 1100 });
  assert.deepEqual(result.state.cycleWordCounts, { ありがとう: 1400, 愛してます: 1100 });
  assert.equal(result.state.totalCount, 2500);
  assert.equal(result.state.ultimateAttemptCount, 0);
});
