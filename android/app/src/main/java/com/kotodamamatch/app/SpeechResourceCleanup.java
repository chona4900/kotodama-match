package com.kotodamamatch.app;

/** Keep a recognition-provider failure from stranding MIC state or its service. */
final class SpeechResourceCleanup {
    private SpeechResourceCleanup() {}

    static void release(Runnable cancel, Runnable destroy) {
        try {
            cancel.run();
        } catch (RuntimeException ignored) {
            // Still destroy the recognizer when its remote provider is gone.
        } finally {
            try {
                destroy.run();
            } catch (RuntimeException ignored) {
                // Callers must still clear listening state and stop the service.
            }
        }
    }
}
