package com.kotodamamatch.app;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/** Reusable review credential. Grants the normal game, never a Play receipt. */
final class ReviewAccess {
    private static final String CODE_SHA256 = "d387e845b1c40746d669dc2968ada2cbb4436439d85e07432d247dbe1bb5915f";

    private ReviewAccess() { }

    static boolean accepts(String code) { return accepts(code, CODE_SHA256); }

    static boolean accepts(String code, String expectedHash) {
        if (code == null || code.length() > 96 || expectedHash == null
                || !expectedHash.matches("[0-9a-f]{64}")) return false;
        String normalized = code.trim().toUpperCase(Locale.ROOT).replaceAll("[\\s-]", "");
        if (!normalized.matches("KM[0-9A-F]{32}")) return false;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8));
            byte[] expected = new byte[32];
            for (int i = 0; i < expected.length; i++) {
                expected[i] = (byte) Integer.parseInt(expectedHash.substring(i * 2, i * 2 + 2), 16);
            }
            return MessageDigest.isEqual(digest, expected);
        } catch (NoSuchAlgorithmException impossible) {
            return false;
        }
    }
}
