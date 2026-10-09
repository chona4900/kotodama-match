(function (root) {
    'use strict';
    function applyNativeState(previous, value) {
        return {
            owned: value?.owned === true,
            reviewAccess: value?.reviewAccess === true,
            pending: value?.pending === true,
            busy: value?.busy === true,
            price: typeof value?.price === 'string' ? value.price : previous.price,
            message: typeof value?.message === 'string' ? value.message : '',
        };
    }
    function canPurchase(state) {
        return !hasAccess(state) && !state.pending && !state.busy && Boolean(state.price);
    }
    function hasAccess(state) { return state.owned === true || state.reviewAccess === true; }
    const api = { applyNativeState, canPurchase, hasAccess };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.KotodamaBillingState = api;
})(typeof window !== 'undefined' ? window : globalThis);
