package com.minerace.wallet.crypto

import org.bouncycastle.asn1.ASN1EncodableVector
import org.bouncycastle.asn1.ASN1Integer
import org.bouncycastle.asn1.ASN1Sequence
import org.bouncycastle.asn1.DERSequence
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.params.ECDomainParameters
import org.bouncycastle.crypto.params.ECPrivateKeyParameters
import org.bouncycastle.crypto.params.ECPublicKeyParameters
import org.bouncycastle.crypto.signers.ECDSASigner
import org.bouncycastle.crypto.signers.HMacDSAKCalculator
import org.bouncycastle.jce.ECNamedCurveTable
import org.bouncycastle.math.ec.FixedPointCombMultiplier
import java.math.BigInteger
import java.security.SecureRandom

object Secp256k1 {
    private val params = ECNamedCurveTable.getParameterSpec("secp256k1")
    private val domain = ECDomainParameters(params.curve, params.g, params.n, params.h)
    private val halfN: BigInteger = params.n.shiftRight(1)

    data class KeyPair(val privateKeyHex: String, val publicKeyHex: String)

    fun generateKeyPair(random: SecureRandom = SecureRandom()): KeyPair {
        var d: BigInteger
        do {
            d = BigInteger(256, random)
        } while (d == BigInteger.ZERO || d >= domain.n)
        val priv = d.toUnsignedHex(32)
        val pub = publicKeyFromPrivate(d)
        return KeyPair(priv, pub)
    }

    fun publicKeyFromPrivateHex(privateKeyHex: String): String {
        val d = BigInteger(1, privateKeyHex.hexToBytes())
        require(d > BigInteger.ZERO && d < domain.n) { "Private key out of range" }
        return publicKeyFromPrivate(d)
    }

    private fun publicKeyFromPrivate(d: BigInteger): String {
        val q = FixedPointCombMultiplier().multiply(domain.g, d).normalize()
        val x = q.affineXCoord.toBigInteger().toUnsignedHex(32)
        val y = q.affineYCoord.toBigInteger().toUnsignedHex(32)
        return "04$x$y"
    }

    /** Sign the 32-byte hash. Returns DER-encoded signature as hex. Uses RFC6979 + low-s. */
    fun signDerHex(hash: ByteArray, privateKeyHex: String): String {
        require(hash.size == 32) { "Hash must be 32 bytes" }
        val d = BigInteger(1, privateKeyHex.hexToBytes())
        val signer = ECDSASigner(HMacDSAKCalculator(SHA256Digest()))
        signer.init(true, ECPrivateKeyParameters(d, domain))
        val sig = signer.generateSignature(hash)
        val r = sig[0]
        var s = sig[1]
        if (s > halfN) s = domain.n.subtract(s)
        val v = ASN1EncodableVector()
        v.add(ASN1Integer(r))
        v.add(ASN1Integer(s))
        return DERSequence(v).encoded.toHex()
    }

    /** Verify a DER-encoded hex signature against a 32-byte hash and uncompressed public key hex. */
    fun verifyDerHex(hash: ByteArray, derSignatureHex: String, publicKeyHex: String): Boolean {
        require(hash.size == 32) { "Hash must be 32 bytes" }
        val pub = decodePublicKey(publicKeyHex)
        val signer = ECDSASigner()
        signer.init(false, ECPublicKeyParameters(pub, domain))
        val seq = ASN1Sequence.getInstance(derSignatureHex.hexToBytes())
        val r = (seq.getObjectAt(0) as ASN1Integer).value
        val s = (seq.getObjectAt(1) as ASN1Integer).value
        return signer.verifySignature(hash, r, s)
    }

    private fun decodePublicKey(publicKeyHex: String): org.bouncycastle.math.ec.ECPoint {
        val bytes = publicKeyHex.hexToBytes()
        return domain.curve.decodePoint(bytes)
    }

    private fun BigInteger.toUnsignedHex(byteLen: Int): String {
        val raw = toByteArray()
        val out = ByteArray(byteLen)
        val src = if (raw.size > byteLen) raw.copyOfRange(raw.size - byteLen, raw.size) else raw
        System.arraycopy(src, 0, out, byteLen - src.size, src.size)
        return out.toHex()
    }

    private fun ByteArray.toHex(): String {
        val sb = StringBuilder(size * 2)
        for (b in this) {
            sb.append(HEX[(b.toInt() ushr 4) and 0x0f])
            sb.append(HEX[b.toInt() and 0x0f])
        }
        return sb.toString()
    }

    private fun String.hexToBytes(): ByteArray {
        val clean = if (length % 2 == 0) this else "0$this"
        val out = ByteArray(clean.length / 2)
        var i = 0
        while (i < clean.length) {
            out[i / 2] = ((hexDigit(clean[i]) shl 4) or hexDigit(clean[i + 1])).toByte()
            i += 2
        }
        return out
    }

    private fun hexDigit(c: Char): Int = when (c) {
        in '0'..'9' -> c - '0'
        in 'a'..'f' -> c - 'a' + 10
        in 'A'..'F' -> c - 'A' + 10
        else -> throw IllegalArgumentException("Bad hex char: $c")
    }

    private const val HEX = "0123456789abcdef"
}
