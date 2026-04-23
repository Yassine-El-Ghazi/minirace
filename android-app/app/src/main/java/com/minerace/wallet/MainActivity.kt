package com.minerace.wallet

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import com.minerace.wallet.ui.WalletApp

/**
 * Must be a FragmentActivity (not the bare ComponentActivity) so androidx.biometric's
 * BiometricPrompt can attach to it for the auth gate.
 */
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { WalletApp() }
    }
}
