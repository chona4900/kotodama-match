(function (globalScope) {
    'use strict';

    const STAGE1_GOAL = 1000;
    const STAGE2_GOAL = 2000;
    const STAGE3_GOAL = 3000;
    const ULTIMATE_ATTEMPT_INTERVAL = 4900;

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
        return (attempts + 1) * ULTIMATE_ATTEMPT_INTERVAL;
    }

    function getUltimateProgressStart(attemptCount) {
        const attempts = Math.max(0, Math.floor(Number(attemptCount) || 0));
        return attempts === 0 ? STAGE3_GOAL : attempts * ULTIMATE_ATTEMPT_INTERVAL;
    }

    function isUltimateAttemptDue(currentStage, totalCount, attemptCount) {
        return Number(currentStage) === 3
            && Number(totalCount) >= getUltimateAttemptGoal(attemptCount);
    }

    const api = {
        STAGE1_GOAL,
        STAGE2_GOAL,
        STAGE3_GOAL,
        ULTIMATE_ATTEMPT_INTERVAL,
        getNextEvolutionStage,
        getUltimateAttemptGoal,
        getUltimateProgressStart,
        isUltimateAttemptDue
    };

    globalScope.KotodamaProgression = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
