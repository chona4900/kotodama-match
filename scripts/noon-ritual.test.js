const test = require('node:test');
const assert = require('node:assert/strict');
const ritual = require('../noon-ritual.js');

const DAY_ONE = new Date(2026, 7, 20, 12, 0, 0);
const DAY_TWO = new Date(2026, 7, 21, 9, 0, 0);
const [THANKS, FUTURE] = ritual.PHRASES;

test('2つの言霊をそれぞれ3回まで数える', () => {
    let state = ritual.createState(DAY_ONE);
    state = ritual.recordPhrase(state, THANKS, 5, DAY_ONE);
    state = ritual.recordPhrase(state, FUTURE, 2, DAY_ONE);

    assert.equal(state.counts[THANKS], 3);
    assert.equal(state.counts[FUTURE], 2);
    assert.equal(ritual.isComplete(state, DAY_ONE), false);

    state = ritual.recordPhrase(state, FUTURE, 1, DAY_ONE);
    assert.equal(ritual.isComplete(state, DAY_ONE), true);
});

test('徳の報酬は同じ日に一度だけ受け取れる', () => {
    let state = ritual.createState(DAY_ONE);
    state = ritual.recordPhrase(state, THANKS, 3, DAY_ONE);
    state = ritual.recordPhrase(state, FUTURE, 3, DAY_ONE);

    const first = ritual.claimReward(state, DAY_ONE);
    const second = ritual.claimReward(first.state, DAY_ONE);

    assert.equal(first.didReward, true);
    assert.equal(second.didReward, false);
    assert.equal(second.state.rewarded, true);
});

test('日付が変わると進捗と報酬状態をリセットする', () => {
    let state = ritual.createState(DAY_ONE);
    state = ritual.recordPhrase(state, THANKS, 3, DAY_ONE);
    state = ritual.recordPhrase(state, FUTURE, 3, DAY_ONE);
    state = ritual.claimReward(state, DAY_ONE).state;

    const nextDay = ritual.normalizeState(state, DAY_TWO);
    assert.equal(nextDay.date, '2026-08-21');
    assert.equal(nextDay.counts[THANKS], 0);
    assert.equal(nextDay.counts[FUTURE], 0);
    assert.equal(nextDay.rewarded, false);
});
