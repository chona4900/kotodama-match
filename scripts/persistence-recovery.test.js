const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const migrations = require('../state-migrations.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const loadSource = source.slice(source.indexOf('        function loadState() {'), source.indexOf('        function getRebirthDeadline() {'));
const validSave = JSON.stringify({
  saveDataVersion: 3, currentStage: 2, currentForm: 'childB_1',
  totalCount: 2500, ultimateAttemptCount: 0, cycleWordCounts: {},
  wordCounts: {}, unlockedForms: ['egg', 'childB_1'], unlockedItems: [],
  lastInteractionTimestamp: Date.now(),
});

function load(primary, backup) {
  const entries = new Map();
  if (primary !== undefined) entries.set('kotodama_state', primary);
  if (backup !== undefined) entries.set('kotodama_state_backup', backup);
  const errors = [];
  const context = vm.createContext({
    localStorage: {
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: key => entries.delete(key),
    },
    window: { KotodamaStateMigrations: migrations },
    console: { warn() {}, info() {}, error: (...args) => errors.push(args) },
    allWords: [], wordCounts: {}, cycleWordCounts: {},
    currentStage: 0, totalCount: 0, SICKNESS_DELAY_MS: 72 * 60 * 60 * 1000,
  });
  vm.runInContext(`${loadSource}\nloadState();`, context);
  return { context, entries, errors };
}

for (const primary of [undefined, 'null', '[]', '42', '{broken']) {
  test(`invalid or absent primary ${String(primary)} restores valid backup`, () => {
    const result = load(primary, validSave);
    assert.equal(result.context.currentStage, 2);
    assert.equal(result.context.totalCount, 2500);
    assert.equal(result.entries.get('kotodama_state'), validSave);
    assert.equal(result.entries.get('kotodama_state_backup'), validSave);
    assert.equal(result.errors.length, 0);
  });
}

for (const backup of ['{broken', 'null', '[]']) {
  test(`invalid backup ${backup} is not promoted or erased`, () => {
    const result = load('null', backup);
    assert.equal(result.context.currentStage, 0);
    assert.equal(result.entries.get('kotodama_state'), 'null');
    assert.equal(result.entries.get('kotodama_state_backup'), backup);
    assert.equal(result.errors.length, 1);
  });
}

test('valid primary wins over corrupt backup', () => {
  const result = load(validSave, '{broken');
  assert.equal(result.context.totalCount, 2500);
  assert.equal(result.entries.get('kotodama_state_backup'), '{broken');
  assert.equal(result.errors.length, 0);
});

test('fresh install does not create or report corrupt save data', () => {
  const result = load();
  assert.equal(result.context.currentStage, 0);
  assert.equal(result.entries.size, 0);
  assert.equal(result.errors.length, 0);
});
