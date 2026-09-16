package com.kotodamamatch.app;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/** Google Play public-key signature verification; no private credentials. */
final class PlayPurchaseVerifier {
    static boolean verify(byte[] publicKey, String data, byte[] signature) {
        try {
            if (data == null || data.isEmpty() || signature == null || signature.length == 0) return false;
            Signature verifier = Signature.getInstance("SHA1withRSA");
            verifier.initVerify(KeyFactory.getInstance("RSA").generatePublic(
                new X509EncodedKeySpec(publicKey)));
            verifier.update(data.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(signature);
        } catch (Exception invalidReceipt) {
            return false;
        }
    }
}
