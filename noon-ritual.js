(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.KotodamaNoonRitual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const TARGET_COUNT = 3;
    const PHRASES = Object.freeze([
        '宇宙の調和に感謝します',
        'だんだんよくなる未来はあかるい'
    ]);

    function getDateKey(date = new Date()) {
        const value = date instanceof Date ? date : new Date(date);
        const pad = number => String(number).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }

    function createState(date = new Date()) {
        return {
            date: getDateKey(date),
            counts: Object.fromEntries(PHRASES.map(phrase => [phrase, 0])),
            rewarded: false
        };
    }

    function normalizeState(value, date = new Date()) {
        const today = getDateKey(date);
        if (!value || typeof value !== 'object' || value.date !== today) {
            return createState(date);
        }

        const normalized = createState(date);
        for (const phrase of PHRASES) {
            const count = Number(value.counts?.[phrase]) || 0;
            normalized.counts[phrase] = Math.max(0, Math.min(TARGET_COUNT, Math.floor(count)));
        }
        normalized.rewarded = value.rewarded === true;
        return normalized;
    }

    function recordPhrase(value, phrase, amount = 1, date = new Date()) {
        const state = normalizeState(value, date);
        if (!PHRASES.includes(phrase) || state.rewarded) return state;
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
        state.counts[phrase] = Math.min(TARGET_COUNT, state.counts[phrase] + safeAmount);
        return state;
    }

    function isComplete(value, date = new Date()) {
        const state = normalizeState(value, date);
        return PHRASES.every(phrase => state.counts[phrase] >= TARGET_COUNT);
    }

    function claimReward(value, date = new Date()) {
        const state = normalizeState(value, date);
        const didReward = isComplete(state, date) && !state.rewarded;
        if (didReward) state.rewarded = true;
        return { state, didReward };
    }

    return {
        TARGET_COUNT,
        PHRASES,
        getDateKey,
        createState,
        normalizeState,
        recordPhrase,
        isComplete,
        claimReward
    };
});
