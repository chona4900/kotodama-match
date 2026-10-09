package com.kotodamamatch.app;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.junit.Test;

public class ReviewAccessTest {
    private String hash(String normalized) throws Exception {
        StringBuilder result = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8))) {
            result.append(String.format("%02x", b & 0xff));
        }
        return result.toString();
    }
    @Test public void reusableCredentialIsCaseAndSeparatorTolerant() throws Exception {
        String normalized = "KM0123456789ABCDEF0123456789ABCDEF";
        String digest = hash(normalized);
        assertTrue(ReviewAccess.accepts(normalized, digest));
        assertTrue(ReviewAccess.accepts(" km-01234567-89abcdef-01234567-89abcdef ", digest));
        assertTrue(ReviewAccess.accepts(normalized, digest));
    }
    @Test public void malformedAndIncorrectCredentialsCannotGrantAccess() throws Exception {
        String digest = hash("KM0123456789ABCDEF0123456789ABCDEF");
        for (String wrong : new String[] {null, "", "true", "KM0123456789ABCDEF0123456789ABCDE0", "KMＧ123456789ABCDEF0123456789ABCDEF"}) {
            assertFalse(ReviewAccess.accepts(wrong, digest));
        }
        assertFalse(ReviewAccess.accepts("KM0123456789ABCDEF0123456789ABCDEF", "bad-hash"));
        assertFalse(ReviewAccess.accepts("KM0123456789ABCDEF0123456789ABCDEF" + " ".repeat(100), digest));
    }
    @Test public void productionConfigurationRejectsEmptyAndFixtureCredentials() {
        assertFalse(ReviewAccess.accepts(""));
        assertFalse(ReviewAccess.accepts("KM0123456789ABCDEF0123456789ABCDEF"));
    }
}
