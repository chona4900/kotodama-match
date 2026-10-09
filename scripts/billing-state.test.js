const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyNativeState, canPurchase, hasAccess } = require('../billing-state');
const initial = { owned: false, price: '' };
test('price loading or pending purchases cannot unlock or be bought again', () => {
    assert.equal(canPurchase(initial), false);
    const pending = applyNativeState(initial, { pending: true, owned: false, price: '￥500' });
    assert.equal(pending.owned, false); assert.equal(canPurchase(pending), false);
});
test('only a verified native true value unlocks access', () => {
    for (const owned of [undefined, null, 1, 'true', false]) {
        assert.equal(applyNativeState(initial, { owned }).owned, false);
    }
    assert.equal(applyNativeState(initial, { owned: true }).owned, true);
});
test('revoked ownership relocks but leaves game saves outside billing state', () => {
    const bought = applyNativeState(initial, { owned: true, price: '￥500' });
    assert.equal(canPurchase(bought), false);
    const revoked = applyNativeState(bought, { owned: false });
    assert.equal(revoked.owned, false); assert.equal(revoked.price, '￥500');
    assert.equal(canPurchase(revoked), true);
});
test('an active purchase cannot be launched twice', () => {
    assert.equal(canPurchase(applyNativeState(initial, { price: '￥500', busy: true })), false);
    assert.equal(canPurchase(applyNativeState(initial, { price: '￥500', busy: false })), true);
});
test('review access is strict, separate from ownership and never offers another purchase', () => {
    for (const reviewAccess of [undefined, null, 1, 'true', false]) {
        assert.equal(hasAccess(applyNativeState(initial, { reviewAccess })), false);
    }
    const reviewer = applyNativeState(initial, { owned: false, reviewAccess: true, price: '￥500' });
    assert.equal(reviewer.owned, false);
    assert.equal(hasAccess(reviewer), true);
    assert.equal(canPurchase(reviewer), false);
    assert.equal(hasAccess(applyNativeState(reviewer, { owned: false, reviewAccess: true })), true);
});
