const test = require('node:test');
const assert = require('node:assert/strict');
const ritual = require('../noon-ritual.js');

const DAY_ONE = new Date(2026, 7, 1, 12, 0, 0);
const DAY_TWO = new Date(2026, 7, 2, 9, 0, 0);
const [THANKS, FUTURE] = ritual.PHRASES;

test('正午のことだまは12時00分から12時00分59秒までだけ開始できる', () => {
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 20, 11, 59, 59)), null);
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 20, 12, 0, 0)), ritual.NOON_SLOT);
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 20, 12, 0, 59)), ritual.NOON_SLOT);
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 20, 12, 1, 0)), null);
});

test('1日と15日は19時00分から19時00分59秒まで祈り合わせができる', () => {
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 1, 19, 0, 0)), ritual.PRAYER_SLOT);
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 15, 19, 0, 59)), ritual.PRAYER_SLOT);
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 1, 19, 1, 0)), null);
    assert.equal(ritual.getAvailableSlot(new Date(2026, 7, 2, 19, 0, 0)), null);
});

test('各時間の2つの言霊をそれぞれ3回まで数え、報酬もそれぞれ一度だけ受け取れる', () => {
    const evening = new Date(2026, 7, 1, 19, 0, 0);
    let state = ritual.createState(DAY_ONE);
    state = ritual.recordPhrase(state, THANKS, 5, DAY_ONE);
    state = ritual.recordPhrase(state, FUTURE, 3, DAY_ONE);
    const noonReward = ritual.claimReward(state, DAY_ONE);

    assert.equal(noonReward.didReward, true);
    state = ritual.recordPhrase(noonReward.state, THANKS, 3, evening);
    state = ritual.recordPhrase(state, FUTURE, 3, evening);
    const eveningReward = ritual.claimReward(state, evening);

    assert.equal(ritual.getSlotState(eveningReward.state, ritual.NOON_SLOT, evening).rewarded, true);
    assert.equal(eveningReward.didReward, true);
    assert.equal(ritual.claimReward(eveningReward.state, evening).didReward, false);
});

test('旧版の正午進捗を新しい言霊表記へ引き継ぐ', () => {
    const legacyState = {
        date: '2026-08-01',
        counts: {
            [THANKS]: 2,
            'だんだんよくなる未来はあかるい': 3
        },
        rewarded: false
    };
    const state = ritual.normalizeState(legacyState, DAY_ONE);

    assert.equal(ritual.getSlotState(state, ritual.NOON_SLOT, DAY_ONE).counts[THANKS], 2);
    assert.equal(ritual.getSlotState(state, ritual.NOON_SLOT, DAY_ONE).counts[FUTURE], 3);
});

test('日付が変わると各時間の進捗と報酬状態をリセットする', () => {
    let state = ritual.createState(DAY_ONE);
    state = ritual.recordPhrase(state, THANKS, 3, DAY_ONE);
    state = ritual.recordPhrase(state, FUTURE, 3, DAY_ONE);
    state = ritual.claimReward(state, DAY_ONE).state;

    const nextDay = ritual.normalizeState(state, DAY_TWO);
    assert.equal(nextDay.date, '2026-08-02');
    assert.equal(ritual.getSlotState(nextDay, ritual.NOON_SLOT, DAY_TWO).counts[THANKS], 0);
    assert.equal(ritual.getSlotState(nextDay, ritual.NOON_SLOT, DAY_TWO).rewarded, false);
});
