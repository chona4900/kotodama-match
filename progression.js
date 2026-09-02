(function (globalScope) {
    'use strict';

    const STAGE1_GOAL = 1000;
    const STAGE2_GOAL = 2000;
    const STAGE3_GOAL = 3000;
    const ULTIMATE_FIRST_ATTEMPT_GOAL = 4900;
    const ULTIMATE_ATTEMPT_INTERVAL = 900;
    const ULTIMATE_RETRY_DISPLAY_START = 4000;

    function getNextEvolutionStage(currentStage, totalCount) {
        const stage = Number(currentStage) || 0;
        const count = Math.max(0, Number(totalCount) || 0);

        if (stage === 0 && count >= STAGE1_GOAL) return 1;
        if (stage === 1 && count >= STAGE2_GOAL) return 2;
        if (stage === 2 && count >= STAGE3_GOAL) return 3;
        return null;
    }

    function getUltimateAttemptGoal(attemptCount) {
        const attempts = Math.max(0, Math.floor(Number(attemptCount) || 0));
        return ULTIMATE_FIRST_ATTEMPT_GOAL + (attempts * ULTIMATE_ATTEMPT_INTERVAL);
    }

    function getUltimateProgressStart(attemptCount) {
        const attempts = Math.max(0, Math.floor(Number(attemptCount) || 0));
        return attempts === 0 ? STAGE3_GOAL : getUltimateAttemptGoal(attempts - 1);
    }

    // 総回数は記録として残したまま、究極進化の再挑戦だけは
    // 「4,000 / 4,900」から始まる900回の短いチャレンジとして見せる。
    function getUltimateProgress(totalCount, attemptCount) {
        const attempts = Math.max(0, Math.floor(Number(attemptCount) || 0));
        const total = Math.max(0, Number(totalCount) || 0);
        const goal = getUltimateAttemptGoal(attempts);
        const start = getUltimateProgressStart(attempts);

        if (attempts === 0) {
            return {
                displayCount: total,
                displayGoal: ULTIMATE_FIRST_ATTEMPT_GOAL,
                progressStart: STAGE3_GOAL,
                progressEnd: goal
            };
        }

        return {
            displayCount: ULTIMATE_RETRY_DISPLAY_START + Math.max(0, total - start),
            displayGoal: ULTIMATE_FIRST_ATTEMPT_GOAL,
            progressStart: start,
            progressEnd: goal
        };
    }

    function isUltimateAttemptDue(currentStage, totalCount, attemptCount) {
        return Number(currentStage) === 3
            && Number(totalCount) >= getUltimateAttemptGoal(attemptCount);
    }

    const api = {
        STAGE1_GOAL,
        STAGE2_GOAL,
        STAGE3_GOAL,
        ULTIMATE_FIRST_ATTEMPT_GOAL,
        ULTIMATE_ATTEMPT_INTERVAL,
        ULTIMATE_RETRY_DISPLAY_START,
        getNextEvolutionStage,
        getUltimateAttemptGoal,
        getUltimateProgressStart,
        getUltimateProgress,
        isUltimateAttemptDue
    };

    globalScope.KotodamaProgression = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
