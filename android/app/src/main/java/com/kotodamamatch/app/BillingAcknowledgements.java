package com.kotodamamatch.app;

import java.util.HashSet;
import java.util.Set;

/** Main-thread-only acknowledgement evidence, bound to the exact purchase token. */
final class BillingAcknowledgements {
    private final Set<String> confirmedTokens = new HashSet<>();

    void confirmed(String token) {
        if (token != null && !token.isEmpty()) confirmedTokens.add(token);
    }

    boolean contains(String token) {
        return token != null && !token.isEmpty() && confirmedTokens.contains(token);
    }

    boolean recordResult(String token, boolean successful, long requestEpoch, BillingRefreshEpoch epochs) {
        if (successful) confirmed(token);
        return epochs.accepts(requestEpoch);
    }

    static boolean canRestore(boolean verifiedPurchase, boolean receiptAcknowledged,
                              String purchaseToken, String confirmedToken) {
        if (!verifiedPurchase) return false;
        return receiptAcknowledged || (purchaseToken != null && !purchaseToken.isEmpty()
            && purchaseToken.equals(confirmedToken));
    }
}
