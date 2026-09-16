package com.kotodamamatch.app;

/** Main-thread-only guard against out-of-order Play responses. */
final class BillingRefreshEpoch {
    private long current;
    long begin() { return ++current; }
    boolean accepts(long value) { return value == current; }
}
