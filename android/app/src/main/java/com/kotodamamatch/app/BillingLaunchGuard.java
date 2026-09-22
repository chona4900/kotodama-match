package com.kotodamamatch.app;

/** Recheck after asynchronous product loading; restore may have completed meanwhile. */
final class BillingLaunchGuard {
    static boolean mayLaunch(boolean owned, boolean pending, boolean purchaseInFlight) {
        return purchaseInFlight && !owned && !pending;
    }
}
