package com.minerace.wallet.crypto

import android.content.Context
import java.security.MessageDigest

/**
 * Minimal BIP-39 encoding. Reversibly maps the raw private-key bytes (32 bytes / 256 bits)
 * to 24 words chosen from the official BIP-39 English wordlist.
 *
 * Layout: 256 bits of entropy + 8-bit SHA-256 checksum → 264 bits → 24 × 11-bit indices.
 *
 * NOTE: This is mnemonic *encoding* of the private key, not BIP-32 seed derivation.
 * The resulting words backup the exact same secp256k1 key; no HD derivation.
 */
object Bip39 {
    private const val EXPECTED_WORDS = 24
    private const val ENTROPY_BYTES = 32

    @Volatile private var cached: List<String>? = null

    private fun wordlist(context: Context): List<String> {
        cached?.let { return it }
        synchronized(this) {
            cached?.let { return it }
            val words = context.applicationContext.assets
                .open("bip39-english.txt")
                .bufferedReader()
                .useLines { it.map(String::trim).filter(String::isNotEmpty).toList() }
            check(words.size == 2048) { "Wordlist must have 2048 entries, got ${words.size}" }
            cached = words
            return words
        }
    }

    fun encode(context: Context, entropy: ByteArray): List<String> {
        require(entropy.size == ENTROPY_BYTES) {
            "BIP-39 encoding expects $ENTROPY_BYTES bytes, got ${entropy.size}"
        }
        val words = wordlist(context)
        val checksumBits = entropy.size / 4 // 256 / 32 = 8 bits for 32-byte entropy
        val checksumByte = MessageDigest.getInstance("SHA-256").digest(entropy)[0]
        val checksumValue = (checksumByte.toInt() ushr (8 - checksumBits)) and ((1 shl checksumBits) - 1)

        // Build a bit queue: entropy bits first, then checksum bits.
        var buffer = 0L
        var bitsInBuffer = 0
        val indices = ArrayList<Int>(EXPECTED_WORDS)

        fun pushBits(value: Int, count: Int) {
            buffer = (buffer shl count) or (value.toLong() and ((1L shl count) - 1))
            bitsInBuffer += count
            while (bitsInBuffer >= 11) {
                val shift = bitsInBuffer - 11
                val idx = ((buffer ushr shift) and 0x7FF).toInt()
                indices.add(idx)
                bitsInBuffer -= 11
                buffer = buffer and ((1L shl bitsInBuffer) - 1)
            }
        }

        for (b in entropy) pushBits(b.toInt() and 0xFF, 8)
        pushBits(checksumValue, checksumBits)

        check(indices.size == EXPECTED_WORDS) { "Encoding produced ${indices.size} words" }
        return indices.map { words[it] }
    }

    fun decode(context: Context, mnemonic: List<String>): ByteArray {
        require(mnemonic.size == EXPECTED_WORDS) {
            "BIP-39 decode expects $EXPECTED_WORDS words, got ${mnemonic.size}"
        }
        val words = wordlist(context)
        val index = words.withIndex().associate { (i, w) -> w to i }

        var buffer = 0L
        var bitsInBuffer = 0
        val out = ByteArray(ENTROPY_BYTES)
        var outPos = 0
        val checksumBits = ENTROPY_BYTES / 4
        var checksumValue = 0
        var entropyBitsRemaining = ENTROPY_BYTES * 8

        for ((i, w) in mnemonic.withIndex()) {
            val normalized = w.trim().lowercase()
            val idx = index[normalized] ?: throw IllegalArgumentException(
                "Word ${i + 1} ('$w') is not in the BIP-39 English wordlist"
            )
            buffer = (buffer shl 11) or idx.toLong()
            bitsInBuffer += 11
            // Emit full bytes of entropy first.
            while (bitsInBuffer >= 8 && entropyBitsRemaining > 0) {
                val shift = bitsInBuffer - 8
                val byte = ((buffer ushr shift) and 0xFF).toInt()
                out[outPos++] = byte.toByte()
                bitsInBuffer -= 8
                buffer = buffer and ((1L shl bitsInBuffer) - 1)
                entropyBitsRemaining -= 8
            }
        }

        check(bitsInBuffer == checksumBits) { "Unexpected leftover bits: $bitsInBuffer" }
        checksumValue = (buffer and ((1L shl checksumBits) - 1)).toInt()

        val expectedChecksumByte = MessageDigest.getInstance("SHA-256").digest(out)[0]
        val expected = (expectedChecksumByte.toInt() ushr (8 - checksumBits)) and ((1 shl checksumBits) - 1)
        if (expected != checksumValue) {
            throw IllegalArgumentException("Checksum word does not match (typo in the mnemonic?)")
        }
        return out
    }

    fun normalize(input: String): List<String> =
        input.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.map { it.lowercase() }
}
