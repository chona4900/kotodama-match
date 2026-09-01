(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.KotodamaNoonRitual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const TARGET_COUNT = 3;
    const NOON_SLOT = 'noon';
    const PRAYER_SLOT = 'prayer';
    const NOON_WINDOW_HOUR = 12;
    const PRAYER_WINDOW_HOUR = 19;
    const SPECIAL_PRAYER_DAYS = Object.freeze([1, 15]);
    const PHRASES = Object.freeze([
        '宇宙の調和に感謝します',
        'だんだんよくなる明るい未来'
    ]);
    const LEGACY_FUTURE_PHRASE = 'だんだんよくなる未来はあかるい';

    function getDateKey(date = new Date()) {
        const value = date instanceof Date ? date : new Date(date);
        const pad = number => String(number).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }

    function isSpecialPrayerDay(date = new Date()) {
        const value = date instanceof Date ? date : new Date(date);
        return SPECIAL_PRAYER_DAYS.includes(value.getDate());
    }

    function getAvailableSlot(date = new Date()) {
        const value = date instanceof Date ? date : new Date(date);
        if (value.getHours() === NOON_WINDOW_HOUR && value.getMinutes() === 0) return NOON_SLOT;
        if (isSpecialPrayerDay(value) && value.getHours() === PRAYER_WINDOW_HOUR && value.getMinutes() === 0) return PRAYER_SLOT;
        return null;
    }

    function getDisplaySlot(date = new Date()) {
        const value = date instanceof Date ? date : new Date(date);
        return isSpecialPrayerDay(value) && value.getHours() >= 18 ? PRAYER_SLOT : NOON_SLOT;
    }

    function createSlotState() {
        return {
            counts: Object.fromEntries(PHRASES.map(phrase => [phrase, 0])),
            rewarded: false
        };
    }

    function createState(date = new Date()) {
        return {
            date: getDateKey(date),
            slots: {
                [NOON_SLOT]: createSlotState(),
                [PRAYER_SLOT]: createSlotState()
            }
        };
    }

    function normalizeSlot(value) {
        const normalized = createSlotState();
        for (const phrase of PHRASES) {
            const legacyCount = phrase === PHRASES[1] ? Number(value?.counts?.[LEGACY_FUTURE_PHRASE]) || 0 : 0;
            const count = Math.max(Number(value?.counts?.[phrase]) || 0, legacyCount);
            normalized.counts[phrase] = Math.max(0, Math.min(TARGET_COUNT, Math.floor(count)));
        }
        normalized.rewarded = value?.rewarded === true;
        return normalized;
    }

    function normalizeState(value, date = new Date()) {
        const today = getDateKey(date);
        if (!value || typeof value !== 'object' || value.date !== today) return createState(date);

        // v1 は正午分だけを counts / rewarded に保存していた。既存の達成状況を残す。
        const legacyNoonSlot = value.slots?.[NOON_SLOT] || value;
        return {
            date: today,
            slots: {
                [NOON_SLOT]: normalizeSlot(legacyNoonSlot),
                [PRAYER_SLOT]: normalizeSlot(value.slots?.[PRAYER_SLOT])
            }
        };
    }

    function getSlotState(value, slot, date = new Date()) {
        const state = normalizeState(value, date);
        return state.slots[slot] || createSlotState();
    }

    function recordPhrase(value, phrase, amount = 1, date = new Date()) {
        const state = normalizeState(value, date);
        const slot = getAvailableSlot(date);
        if (!slot || !PHRASES.includes(phrase) || state.slots[slot].rewarded) return state;
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
        state.slots[slot].counts[phrase] = Math.min(TARGET_COUNT, state.slots[slot].counts[phrase] + safeAmount);
        return state;
    }

    function isComplete(value, date = new Date(), slot = getAvailableSlot(date)) {
        if (!slot) return false;
        const state = getSlotState(value, slot, date);
        return PHRASES.every(phrase => state.counts[phrase] >= TARGET_COUNT);
    }

    function claimReward(value, date = new Date()) {
        const state = normalizeState(value, date);
        const slot = getAvailableSlot(date);
        if (!slot) return { state, didReward: false };
        const didReward = isComplete(state, date, slot) && !state.slots[slot].rewarded;
        if (didReward) state.slots[slot].rewarded = true;
        return { state, didReward };
    }

    return {
        TARGET_COUNT,
        NOON_SLOT,
        PRAYER_SLOT,
        PHRASES,
        getDateKey,
        isSpecialPrayerDay,
        getAvailableSlot,
        getDisplaySlot,
        createState,
        normalizeState,
        getSlotState,
        recordPhrase,
        isComplete,
        claimReward
    };
});
