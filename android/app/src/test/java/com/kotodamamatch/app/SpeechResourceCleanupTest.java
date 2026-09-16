package com.kotodamamatch.app;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class SpeechResourceCleanupTest {
    @Test public void cancelsThenDestroys() {
        StringBuilder calls = new StringBuilder();
        SpeechResourceCleanup.release(() -> calls.append("cancel "), () -> calls.append("destroy"));
        assertEquals("cancel destroy", calls.toString());
    }

    @Test public void cancelFailureStillDestroysAndAllowsServiceCleanup() {
        StringBuilder calls = new StringBuilder();
        SpeechResourceCleanup.release(() -> {
            calls.append("cancel ");
            throw new IllegalStateException("provider disconnected");
        }, () -> calls.append("destroy "));
        calls.append("stop service");
        assertEquals("cancel destroy stop service", calls.toString());
    }

    @Test public void destroyFailureStillAllowsServiceCleanup() {
        StringBuilder calls = new StringBuilder();
        SpeechResourceCleanup.release(() -> {}, () -> {
            calls.append("destroy ");
            throw new IllegalStateException("already disconnected");
        });
        calls.append("stop service");
        assertEquals("destroy stop service", calls.toString());
    }

    @Test public void bothProviderFailuresStillAllowServiceCleanup() {
        StringBuilder calls = new StringBuilder();
        SpeechResourceCleanup.release(() -> { throw new IllegalStateException(); }, () -> {
            calls.append("destroy ");
            throw new IllegalStateException();
        });
        calls.append("stop service");
        assertEquals("destroy stop service", calls.toString());
    }
}
