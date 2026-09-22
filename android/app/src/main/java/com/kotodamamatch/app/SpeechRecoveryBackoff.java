package com.kotodamamatch.app;

/** A ready microphone is not evidence that recognition recovered successfully. */
final class SpeechRecoveryBackoff {
    private static final int MAX_ATTEMPTS_WITHOUT_SERVICE = 4;
    private int failures;

    void reset() { failures = 0; }

    boolean mayRetry(boolean foregroundServiceRunning) {
        return foregroundServiceRunning || failures < MAX_ATTEMPTS_WITHOUT_SERVICE;
    }

    long nextDelay(long baseDelayMillis, boolean recoveryFailure) {
        if (recoveryFailure) failures = Math.min(failures + 1, MAX_ATTEMPTS_WITHOUT_SERVICE);
        int exponent = recoveryFailure ? Math.min(Math.max(failures - 1, 0), 3) : 0;
        return Math.min(baseDelayMillis * (1L << exponent), 8000L);
    }
}
