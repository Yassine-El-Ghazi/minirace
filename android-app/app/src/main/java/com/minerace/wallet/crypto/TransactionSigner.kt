package com.minerace.wallet.crypto

import java.security.MessageDigest

/**
 * Mirrors server/blockchain/Transaction.js:
 *   hash = SHA256(from + to + amount)   // amount as JS Number.toString()
 *   signature = DER-hex ECDSA(secp256k1)
 *
 * Keep amount as Long so its toString matches Number(amount).toString() server-side
 * (no ".0" suffix). If fractional amounts are added later, serialize identically on
 * both sides.
 */
object TransactionSigner {
    data class Signed(
        val from: String,
        val to: String,
        val amount: Long,
        val signature: String,
        val dataHashHex: String,
    )

    fun buildDataString(from: String, to: String, amount: Long): String =
        from + to + amount.toString()

    fun hash(from: String, to: String, amount: Long): ByteArray {
        val data = buildDataString(from, to, amount).toByteArray(Charsets.UTF_8)
        return MessageDigest.getInstance("SHA-256").digest(data)
    }

    fun sign(from: String, to: String, amount: Long, privateKeyHex: String): Signed {
        val h = hash(from, to, amount)
        val sig = Secp256k1.signDerHex(h, privateKeyHex)
        return Signed(from, to, amount, sig, h.toHex())
    }

    private fun ByteArray.toHex(): String {
        val sb = StringBuilder(size * 2)
        val hex = "0123456789abcdef"
        for (b in this) {
            sb.append(hex[(b.toInt() ushr 4) and 0x0f])
            sb.append(hex[b.toInt() and 0x0f])
        }
        return sb.toString()
    }
}
