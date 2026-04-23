package com.minerace.wallet.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * App-layer user-presence gate for sensitive ops (signing, revealing the private key).
 *
 * We use BIOMETRIC_WEAK | DEVICE_CREDENTIAL so the prompt falls back to the device
 * PIN/pattern/password when no biometric is enrolled. This works out-of-the-box on
 * emulators once a screen lock is set.
 *
 * Note on threat model: this is a policy gate, not a cryptographic one — the decrypted
 * key is still held in app memory. A fully auth-bound key would require
 * [Keystore.setUserAuthenticationRequired], but Android Keystore doesn't support the
 * secp256k1 curve, so the key itself can't live in it. Combining this gate with the
 * TEE-wrapped master key (EncryptedSharedPreferences) raises the bar substantially:
 * a picker-upper can't sign, and the on-disk ciphertext stays opaque.
 */
object BiometricGate {

    enum class Availability { AVAILABLE, NO_HARDWARE, NONE_ENROLLED_NOR_CREDENTIAL, UNKNOWN }

    fun availability(context: Context): Availability {
        val status = BiometricManager.from(context)
            .canAuthenticate(BIOMETRIC_WEAK or DEVICE_CREDENTIAL)
        return when (status) {
            BiometricManager.BIOMETRIC_SUCCESS -> Availability.AVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> Availability.NO_HARDWARE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> Availability.NONE_ENROLLED_NOR_CREDENTIAL
            else -> Availability.UNKNOWN
        }
    }

    sealed class Result {
        object Success : Result()
        object Cancelled : Result()
        data class Failed(val code: Int, val message: String) : Result()
    }

    suspend fun authenticate(
        context: Context,
        title: String,
        subtitle: String,
    ): Result {
        val activity = context.findFragmentActivity()
            ?: return Result.Failed(-1, "Host is not a FragmentActivity")

        return suspendCancellableCoroutine { cont ->
            val executor = ContextCompat.getMainExecutor(activity)
            val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (cont.isActive) cont.resume(Result.Success)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    val res = when (errorCode) {
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                        BiometricPrompt.ERROR_CANCELED -> Result.Cancelled
                        else -> Result.Failed(errorCode, errString.toString())
                    }
                    if (cont.isActive) cont.resume(res)
                }
            })

            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BIOMETRIC_WEAK or DEVICE_CREDENTIAL)
                .build()
            prompt.authenticate(info)
        }
    }
}

private fun Context.findFragmentActivity(): FragmentActivity? {
    var c: Context? = this
    while (c is ContextWrapper) {
        if (c is FragmentActivity) return c
        c = c.baseContext
    }
    return null
}
