package com.kotodamamatch.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class SpeechRecoveryBackoffTest {
    @Test public void repeatedFailuresReachBoundedBackoffWithoutAResult() {
        SpeechRecoveryBackoff recovery = new SpeechRecoveryBackoff();
        long[] expected = {1000, 2000, 4000, 8000, 8000, 8000};
        for (long delay : expected) assertEquals(delay, recovery.nextDelay(1000, true));
    }

    @Test public void foregroundServicePreservesMicIntentButNoServiceCapsRetries() {
        SpeechRecoveryBackoff recovery = new SpeechRecoveryBackoff();
        for (int attempt = 0; attempt < 4; attempt++) {
            assertTrue(recovery.mayRetry(false));
            recovery.nextDelay(1000, true);
        }
        assertFalse(recovery.mayRetry(false));
        assertTrue(recovery.mayRetry(true));
    }

    @Test public void newUserStartOrSuccessfulBoundaryResetsFailureHistory() {
        SpeechRecoveryBackoff recovery = new SpeechRecoveryBackoff();
        for (int attempt = 0; attempt < 5; attempt++) recovery.nextDelay(1000, true);
        recovery.reset();
        assertTrue(recovery.mayRetry(false));
        assertEquals(1000, recovery.nextDelay(1000, true));
    }

    @Test public void normalUtteranceDelayDoesNotCountAsFailure() {
        SpeechRecoveryBackoff recovery = new SpeechRecoveryBackoff();
        for (int phrase = 0; phrase < 10; phrase++) {
            recovery.reset();
            assertEquals(250, recovery.nextDelay(250, false));
            assertTrue(recovery.mayRetry(false));
        }
    }

    @Test public void throttleErrorUsesLongerDelayWithoutOverflowing() {
        SpeechRecoveryBackoff recovery = new SpeechRecoveryBackoff();
        assertEquals(2000, recovery.nextDelay(2000, true));
        assertEquals(4000, recovery.nextDelay(2000, true));
        for (int attempt = 0; attempt < 10000; attempt++)
            assertEquals(8000, recovery.nextDelay(2000, true));
    }
}
