(function (globalScope) {
    'use strict';

    const CURRENT_SAVE_DATA_VERSION = 3;
    const LEGACY_ULTIMATE_GOAL = 4900;
    const LEGACY_ULTIMATE_FAILURE_ROLLBACK = 100;

    function normalizeWordCounts(counts, allWords) {
        const normalized = {};
        allWords.forEach((word) => {
            normalized[word] = Math.max(0, Number(counts?.[word]) || 0);
        });
        return normalized;
    }

    function sumWordCounts(counts) {
        return Object.values(counts).reduce((sum, count) => sum + (Number(count) || 0), 0);
    }

    function inferLegacyUltimateAttemptCount(state, normalizedCounts) {
        const stage = Number(state.currentStage) || 0;
        if (stage < 3) return 0;

        const savedTotal = Math.max(0, Number(state.totalCount) || 0);
        const spokenTotal = sumWordCounts(normalizedCounts);
        const rolledBackCount = Math.max(0, spokenTotal - savedTotal);
        const attemptsFromRollback = Math.floor(rolledBackCount / LEGACY_ULTIMATE_FAILURE_ROLLBACK);
        const attemptsFromProgress = Math.floor(savedTotal / LEGACY_ULTIMATE_GOAL);
        const minimumForUltimateForm = stage >= 4 ? 1 : 0;

        return Math.max(minimumForUltimateForm, attemptsFromRollback, attemptsFromProgress);
    }

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
        const wordCounts = normalizeWordCounts({}, allWords);

        return {
            saveDataVersion: CURRENT_SAVE_DATA_VERSION,
            currentStage: 0,
            currentForm: 'egg',
            wordCounts,
            cycleWordCounts: { ...wordCounts },
            totalCount: 0,
            ultimateAttemptCount: 0,
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

        if ((Number(state.saveDataVersion) || 0) < CURRENT_SAVE_DATA_VERSION
            || !state.cycleWordCounts
            || state.ultimateAttemptCount === undefined) {
            const wordCounts = normalizeWordCounts(state.wordCounts || {}, allWords);
            const cycleWordCounts = state.cycleWordCounts
                ? normalizeWordCounts(state.cycleWordCounts, allWords)
                : { ...wordCounts };
            const inferredAttemptCount = state.ultimateAttemptCount !== undefined
                ? Math.max(0, Math.floor(Number(state.ultimateAttemptCount) || 0))
                : inferLegacyUltimateAttemptCount(state, cycleWordCounts);

            // 旧版は究極進化失敗のたびに totalCount だけ100回巻き戻していた。
            // 言霊別回数とのずれを戻し、実際に唱えた回数を進化進捗へ復元する。
            const restoredTotalCount = Math.max(
                Math.max(0, Number(state.totalCount) || 0),
                sumWordCounts(cycleWordCounts)
            );

            return {
                state: {
                    ...state,
                    saveDataVersion: CURRENT_SAVE_DATA_VERSION,
                    wordCounts,
                    cycleWordCounts,
                    totalCount: restoredTotalCount,
                    ultimateAttemptCount: inferredAttemptCount
                },
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
