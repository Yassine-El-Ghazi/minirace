package com.minerace.wallet.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.SecureRandom

/**
 * Local JVM tests that lock down the invariants shared with the server:
 *   - public keys are uncompressed hex, 130 chars, starting with "04"
 *   - DER signatures round-trip through our own verifier
 *   - SHA256(from + to + amount.toString()) matches the server's input
 *
 * Run from android-app/: ./gradlew :app:testDebugUnitTest
 *
 * This suite also prints a ready-to-paste JSON payload to stdout so we can hand it
 * to `node scripts/verify-kotlin-sig.js` and prove the signature is accepted by the
 * real server-side Transaction.isValid() (the make-or-break cross-platform check).
 */
class CryptoParityTest {

    @Test
    fun keypairPublicKeyFormatMatchesEllipticUncompressed() {
        val kp = Secp256k1.generateKeyPair(SecureRandom())
        assertEquals("private key hex length", 64, kp.privateKeyHex.length)
        assertEquals("public key hex length", 130, kp.publicKeyHex.length)
        assertTrue("public key must be uncompressed (04 prefix)", kp.publicKeyHex.startsWith("04"))
    }

    @Test
    fun publicKeyDerivedFromPrivateMatchesGenerated() {
        val kp = Secp256k1.generateKeyPair()
        val derived = Secp256k1.publicKeyFromPrivateHex(kp.privateKeyHex)
        assertEquals(kp.publicKeyHex, derived)
    }

    @Test
    fun signatureRoundTripsThroughOurVerifier() {
        val kp = Secp256k1.generateKeyPair()
        val hash = TransactionSigner.hash(kp.publicKeyHex, "recipient-pub", 10L)
        val sigHex = Secp256k1.signDerHex(hash, kp.privateKeyHex)
        assertTrue(Secp256k1.verifyDerHex(hash, sigHex, kp.publicKeyHex))
    }

    @Test
    fun dataStringShapeMatchesServerConcatenation() {
        val from = "04" + "aa".repeat(64)
        val to = "04" + "bb".repeat(64)
        val s = TransactionSigner.buildDataString(from, to, 10L)
        assertEquals(from + to + "10", s)
    }

    /**
     * Prints a JSON payload you can feed into scripts/verify-kotlin-sig.js to prove
     * the Kotlin signature is accepted by the server's Transaction.isValid().
     *
     *   cd android-app && ./gradlew :app:testDebugUnitTest --tests \
     *     com.minerace.wallet.crypto.CryptoParityTest.printSignedPayloadForNodeCrossCheck -i
     *
     * Then copy the printed JSON line into:
     *   node scripts/verify-kotlin-sig.js '<paste>'
     */
    @Test
    fun printSignedPayloadForNodeCrossCheck() {
        val sender = Secp256k1.generateKeyPair()
        val recipient = Secp256k1.generateKeyPair()
        val signed = TransactionSigner.sign(
            from = sender.publicKeyHex,
            to = recipient.publicKeyHex,
            amount = 7L,
            privateKeyHex = sender.privateKeyHex,
        )
        val json = """
            {"from":"${signed.from}","to":"${signed.to}","amount":${signed.amount},"signature":"${signed.signature}","dataHash":"${signed.dataHashHex}"}
        """.trimIndent()
        println("KOTLIN_SIGNED_PAYLOAD=$json")
    }
}
