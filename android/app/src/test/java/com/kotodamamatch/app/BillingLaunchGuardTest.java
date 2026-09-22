package com.kotodamamatch.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class BillingLaunchGuardTest {
    @Test public void activePurchaseIntentMayLaunchWhenProductArrives() {
        assertTrue(BillingLaunchGuard.mayLaunch(false, false, true));
    }

    @Test public void restoreCompletingDuringProductQueryPreventsAnotherSheet() {
        assertFalse(BillingLaunchGuard.mayLaunch(true, false, true));
        assertFalse(BillingLaunchGuard.mayLaunch(false, true, true));
        assertFalse(BillingLaunchGuard.mayLaunch(true, true, true));
    }

    @Test public void canceledOldRequestCannotLaunchLater() {
        assertFalse(BillingLaunchGuard.mayLaunch(false, false, false));
    }
}
