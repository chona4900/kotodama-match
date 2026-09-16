package com.kotodamamatch.app;

import org.junit.Test;
import static org.junit.Assert.*;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.nio.charset.StandardCharsets;

public class PlayPurchaseVerifierTest {
    @Test public void acceptsSignedReceiptAndRejectsTampering() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair key = generator.generateKeyPair();
        String data = "{\"productId\":\"kotodama_full_game\",\"purchaseState\":0}";
        Signature signer = Signature.getInstance("SHA1withRSA");
        signer.initSign(key.getPrivate()); signer.update(data.getBytes(StandardCharsets.UTF_8));
        byte[] signature = signer.sign();
        assertTrue(PlayPurchaseVerifier.verify(key.getPublic().getEncoded(), data, signature));
        assertFalse(PlayPurchaseVerifier.verify(key.getPublic().getEncoded(), data + " ", signature));
        assertFalse(PlayPurchaseVerifier.verify(key.getPublic().getEncoded(), data, new byte[0]));
        assertFalse(PlayPurchaseVerifier.verify(new byte[0], data, signature));
    }
}
