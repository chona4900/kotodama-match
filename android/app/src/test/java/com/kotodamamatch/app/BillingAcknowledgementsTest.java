package com.kotodamamatch.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class BillingAcknowledgementsTest {
    @Test public void successfulAckAllowsOfflineRestoreBeforeSignedReceiptRefresh() {
        BillingAcknowledgements acknowledgements = new BillingAcknowledgements();
        acknowledgements.confirmed("verified-purchase-token");
        assertTrue(acknowledgements.contains("verified-purchase-token"));
        assertTrue(BillingAcknowledgements.canRestore(true, false,
            "verified-purchase-token", "verified-purchase-token"));
    }

    @Test public void ackCannotGrantAnUnverifiedOrDifferentReceipt() {
        assertFalse(BillingAcknowledgements.canRestore(false, true, "token", "token"));
        assertFalse(BillingAcknowledgements.canRestore(false, false, "token", "token"));
        assertFalse(BillingAcknowledgements.canRestore(true, false, "new-token", "old-token"));
        assertFalse(BillingAcknowledgements.canRestore(true, false, "", ""));
        assertFalse(BillingAcknowledgements.canRestore(true, false, null, null));
    }

    @Test public void earlierAcknowledgedReceiptStillMigratesWithoutNewCacheField() {
        assertTrue(BillingAcknowledgements.canRestore(true, true, "token", ""));
        assertFalse(BillingAcknowledgements.canRestore(true, false, "token", ""));
    }

    @Test public void staleAckIsRememberedWithoutAcceptingStaleOwnership() {
        BillingRefreshEpoch epoch = new BillingRefreshEpoch();
        BillingAcknowledgements acknowledgements = new BillingAcknowledgements();
        long oldPurchase = epoch.begin();
        long resumedRestore = epoch.begin();
        assertFalse(acknowledgements.recordResult("token", true, oldPurchase, epoch));
        assertTrue(epoch.accepts(resumedRestore));
        assertTrue(acknowledgements.contains("token"));
        assertFalse(acknowledgements.contains("other-token"));
    }

    @Test public void failedAcknowledgementNeverCreatesOfflineEvidence() {
        BillingRefreshEpoch epoch = new BillingRefreshEpoch();
        BillingAcknowledgements acknowledgements = new BillingAcknowledgements();
        long request = epoch.begin();
        assertTrue(acknowledgements.recordResult("token", false, request, epoch));
        assertFalse(acknowledgements.contains("token"));
        epoch.begin();
        assertFalse(acknowledgements.recordResult("token", false, request, epoch));
        assertFalse(acknowledgements.contains("token"));
    }

    @Test public void invalidAndRepeatedTokensDoNotCrossGrant() {
        BillingAcknowledgements acknowledgements = new BillingAcknowledgements();
        acknowledgements.confirmed(null);
        acknowledgements.confirmed("");
        acknowledgements.confirmed("token");
        acknowledgements.confirmed("token");
        assertFalse(acknowledgements.contains(null));
        assertFalse(acknowledgements.contains(""));
        assertFalse(acknowledgements.contains("other-token"));
        assertTrue(acknowledgements.contains("token"));
    }
}
