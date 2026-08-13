(function (globalScope) {
    'use strict';

    const CURRENT_SAVE_DATA_VERSION = 2;

    function isKnownPublishedTestState(state) {
        if (!state || typeof state !== 'object') return false;

        const savedVersion = Number(state.saveDataVersion) || 0;
        return savedVersion < CURRENT_SAVE_DATA_VERSION
            && Number(state.currentStage || 0) === 0
            && (state.currentForm || 'egg') === 'egg'
            && Number(state.battleWins || 0) === 100
            && Number(state.battleLosses || 0) === 0
            && Number(state.intokuPower || 0) === 49;
    }

    function createCleanState(allWords, now) {
        const wordCounts = {};
        allWords.forEach((word) => {
            wordCounts[word] = 0;
        });

        return {
            saveDataVersion: CURRENT_SAVE_DATA_VERSION,
            currentStage: 0,
            currentForm: 'egg',
            wordCounts,
            totalCount: 0,
            intokuPower: 0,
            battleWins: 0,
            battleLosses: 0,
            isSick: false,
            sickRecoveryCount: 0,
            lastInteractionTimestamp: now,
            finalEvolutionTimestamp: null,
            unlockedForms: ['egg'],
            unlockedItems: []
        };
    }

    function migrateSavedState(state, allWords, now = Date.now()) {
        if (isKnownPublishedTestState(state)) {
            return {
                state: createCleanState(allWords, now),
                didChange: true,
                didResetKnownTestState: true
            };
        }

        if ((Number(state.saveDataVersion) || 0) < CURRENT_SAVE_DATA_VERSION) {
            return {
                state: { ...state, saveDataVersion: CURRENT_SAVE_DATA_VERSION },
                didChange: true,
                didResetKnownTestState: false
            };
        }

        return {
            state,
            didChange: false,
            didResetKnownTestState: false
        };
    }

    const api = {
        CURRENT_SAVE_DATA_VERSION,
        isKnownPublishedTestState,
        migrateSavedState
    };

    globalScope.KotodamaStateMigrations = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
