package com.minerace.wallet.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.minerace.wallet.crypto.Secp256k1

/**
 * Persists a single secp256k1 keypair, with the private key encrypted at rest.
 *
 * The raw bytes live inside an [EncryptedSharedPreferences] file whose key-material
 * is wrapped by an AES256-GCM [MasterKey] stored in the Android Keystore. The
 * Keystore is hardware-backed on devices with a StrongBox or a TEE; the user's
 * private key cannot be exported in plaintext even if the filesystem is read
 * outside the app sandbox.
 *
 * We can't put a secp256k1 key directly into the Keystore (it only supports
 * EC curves standardized by JCA; secp256k1 is not among them on Android), which
 * is why we wrap the raw bytes instead.
 */
class WalletStore(context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context.applicationContext,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun hasWallet(): Boolean =
        prefs.contains(KEY_PRIVATE) && prefs.contains(KEY_PUBLIC)

    fun createWallet(): Wallet {
        val kp = Secp256k1.generateKeyPair()
        persist(kp.privateKeyHex, kp.publicKeyHex)
        return Wallet(kp.privateKeyHex, kp.publicKeyHex)
    }

    fun importWallet(privateKeyHex: String): Wallet {
        val pub = Secp256k1.publicKeyFromPrivateHex(privateKeyHex)
        persist(privateKeyHex, pub)
        return Wallet(privateKeyHex, pub)
    }

    fun loadWallet(): Wallet? {
        val priv = prefs.getString(KEY_PRIVATE, null) ?: return null
        val pub = prefs.getString(KEY_PUBLIC, null) ?: return null
        return Wallet(priv, pub)
    }

    fun deleteWallet() {
        prefs.edit().remove(KEY_PRIVATE).remove(KEY_PUBLIC).apply()
    }

    private fun persist(priv: String, pub: String) {
        prefs.edit()
            .putString(KEY_PRIVATE, priv)
            .putString(KEY_PUBLIC, pub)
            .apply()
    }

    data class Wallet(val privateKeyHex: String, val publicKeyHex: String)

    private companion object {
        const val FILE_NAME = "minerace_wallet_v1"
        const val KEY_PRIVATE = "priv"
        const val KEY_PUBLIC = "pub"
    }
}
