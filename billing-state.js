(function (root) {
    'use strict';
    function applyNativeState(previous, value) {
        return {
            owned: value?.owned === true,
            pending: value?.pending === true,
            busy: value?.busy === true,
            price: typeof value?.price === 'string' ? value.price : previous.price,
            message: typeof value?.message === 'string' ? value.message : '',
        };
    }
    function canPurchase(state) {
        return !state.owned && !state.pending && !state.busy && Boolean(state.price);
    }
    const api = { applyNativeState, canPurchase };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.KotodamaBillingState = api;
})(typeof window !== 'undefined' ? window : globalThis);
