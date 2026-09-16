package com.kotodamamatch.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class BillingRefreshEpochTest {
    @Test public void oldEmptyResponseCannotOverrideNewPurchase() {
        BillingRefreshEpoch epoch = new BillingRefreshEpoch();
        long oldEmptyQuery = epoch.begin();
        long newPurchase = epoch.begin();
        assertFalse(epoch.accepts(oldEmptyQuery));
        assertTrue(epoch.accepts(newPurchase));
        long newAuthoritativeQuery = epoch.begin();
        assertFalse(epoch.accepts(newPurchase));
        assertTrue(epoch.accepts(newAuthoritativeQuery));
    }
}
