const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rules = require('../billing-state');
const source = fs.readFileSync(require('node:path').join(__dirname, '../android-billing.js'), 'utf8');

function harness(platform = 'android', native = {}) {
    const events = {}, elements = {}, listeners = {};
    function element(tagName = 'DIV') {
        return { tagName, inert: false, hidden: false, disabled: false, textContent: '',
            value: '', querySelector() { return { insertAdjacentHTML() {} }; },
            setAttribute() {}, addEventListener(name, callback) { this[name] = callback; }, focus() {} };
    }
    let purchases = 0;
    const plugin = {
        async addListener(name, callback) { listeners[name] = callback; },
        async getStatus() { return { owned: false, ...native }; },
        async restore() { return { owned: false, ...native }; },
        async getProduct() { return { owned: false, price: '￥500', ...native }; },
        async purchase() { purchases++; return { launched: true }; },
        async activateReviewAccess() { throw new Error('invalid review code'); },
    };
    const game = element();
    const document = {
        body: { children: [game], appendChild(item) { this.children.push(item); } },
        head: { appendChild() {} }, visibilityState: 'visible',
        createElement: element,
        getElementById(id) { return elements[id] ||= element(); },
        addEventListener(name, callback) { events[name] = callback; },
    };
    const window = { KotodamaBillingState: rules,
        Capacitor: { isNativePlatform: () => true, getPlatform: () => platform, Plugins: { KotodamaBilling: plugin } } };
    vm.runInNewContext(source, { window, document, setTimeout() { return 1; }, clearTimeout() {}, Promise });
    return { window, document, events, elements, listeners, plugin, game, purchases: () => purchases };
}
test('iOS never opens Android payment UI or waits for Play', async () => {
    const h = harness('ios');
    await h.window.KotodamaBilling.ready;
    assert.equal(h.window.KotodamaBilling.hasAccess(), true);
    assert.equal(h.events.DOMContentLoaded, undefined);
    assert.equal(h.purchases(), 0);
});
test('unpaid Android stays gated without automatically launching purchase', async () => {
    const h = harness();
    await h.events.DOMContentLoaded();
    assert.equal(h.window.KotodamaBilling.hasAccess(), false);
    assert.equal(h.game.inert, true);
    assert.equal(h.purchases(), 0);
    assert.equal(h.elements.kotodamaPurchase.disabled, false);
    h.listeners.purchaseState({ owned: true, price: '￥500' });
    await h.window.KotodamaBilling.ready;
    assert.equal(h.game.inert, false);
    assert.equal(h.window.KotodamaBilling.hasAccess(), true);
});
test('pending payment blocks access and repurchase', async () => {
    const h = harness('android', { pending: true });
    await h.events.DOMContentLoaded();
    assert.equal(h.window.KotodamaBilling.hasAccess(), false);
    assert.equal(h.elements.kotodamaPurchase.disabled, true);
    await h.elements.kotodamaPurchase.click();
    assert.equal(h.purchases(), 0);
});
test('restore errors do not grant access or erase game data', async () => {
    const h = harness();
    h.plugin.restore = async () => { throw new Error('offline'); };
    await h.events.DOMContentLoaded();
    assert.equal(h.window.KotodamaBilling.hasAccess(), false);
    assert.equal(h.game.inert, true);
    assert.equal(h.elements.kotodamaRestore.disabled, false);
    assert.equal(h.elements.kotodamaPurchaseStatus.textContent, 'offline');
});
test('revocation stops microphone and restores paywall', async () => {
    const h = harness('android', { owned: true });
    let stopped = 0; h.window.stopMic = () => stopped++;
    await h.events.DOMContentLoaded();
    h.listeners.purchaseState({ owned: false, price: '￥500' });
    assert.equal(stopped, 1);
    assert.equal(h.game.inert, true);
});
test('verified offline owner starts without a network restore', async () => {
    const h = harness('android', { owned: true });
    let restoreCalls = 0;
    h.plugin.restore = async () => { restoreCalls++; throw new Error('offline'); };
    await h.events.DOMContentLoaded();
    await h.window.KotodamaBilling.ready;
    assert.equal(h.window.KotodamaBilling.hasAccess(), true);
    assert.equal(restoreCalls, 0);
});
test('review credential opens the normal game without purchase even when Play restore fails', async () => {
    const h = harness();
    h.plugin.restore = async () => { throw new Error('offline'); };
    h.plugin.activateReviewAccess = async ({ code }) => {
        assert.equal(code, 'review-test-fixture');
        return { owned: false, reviewAccess: true };
    };
    await h.events.DOMContentLoaded();
    h.elements.kotodamaReviewCode.value = 'review-test-fixture';
    await h.elements.kotodamaReviewForm.submit({ preventDefault() {} });
    await h.window.KotodamaBilling.ready;
    assert.equal(h.window.KotodamaBilling.hasAccess(), true);
    assert.equal(h.game.inert, false);
    assert.equal(h.elements.kotodamaReviewCode.value, '');
    assert.equal(h.purchases(), 0);
    // A later billing callback with no receipt still carries the separate native review grant.
    h.listeners.purchaseState({ owned: false, reviewAccess: true });
    assert.equal(h.window.KotodamaBilling.hasAccess(), true);
});
test('incorrect review credential stays gated and leaves purchase available', async () => {
    const h = harness();
    await h.events.DOMContentLoaded();
    h.elements.kotodamaReviewCode.value = 'wrong';
    await h.elements.kotodamaReviewForm.submit({ preventDefault() {} });
    assert.equal(h.window.KotodamaBilling.hasAccess(), false);
    assert.equal(h.game.inert, true);
    assert.equal(h.elements.kotodamaPurchase.disabled, false);
    assert.equal(h.elements.kotodamaReviewSubmit.disabled, false);
    assert.equal(h.purchases(), 0);
});
test('persisted review access starts offline without waiting for Play or purchasing', async () => {
    const h = harness('android', { reviewAccess: true });
    h.plugin.restore = async () => { throw new Error('must not require Play restore'); };
    await h.events.DOMContentLoaded();
    await h.window.KotodamaBilling.ready;
    assert.equal(h.window.KotodamaBilling.hasAccess(), true);
    assert.equal(h.game.inert, false);
    assert.equal(h.purchases(), 0);
});
test('review entry remains usable while Play restore is still pending', async () => {
    const h = harness();
    h.plugin.restore = () => new Promise(() => {});
    h.plugin.activateReviewAccess = async () => ({ reviewAccess: true, owned: false });
    h.events.DOMContentLoaded();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(h.elements.kotodamaReviewSubmit.disabled, false);
    await h.elements.kotodamaReviewForm.submit({ preventDefault() {} });
    await h.window.KotodamaBilling.ready;
    assert.equal(h.game.inert, false);
    assert.equal(h.purchases(), 0);
});
