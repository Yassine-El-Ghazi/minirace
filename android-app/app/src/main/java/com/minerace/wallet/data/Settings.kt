package com.minerace.wallet.data

import android.content.Context

/**
 * Plain (non-encrypted) SharedPreferences for things that are not secrets.
 * Currently just the server base URL — kept outside WalletStore so changing it
 * never touches the encrypted keystore file.
 */
class Settings(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("minerace_settings", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) {
            prefs.edit()
                .putString(KEY_BASE_URL, value.trim().trimEnd('/'))
                .putBoolean(KEY_SERVER_CONFIGURED, true)
                .apply()
        }

    val isServerConfigured: Boolean
        get() = prefs.getBoolean(KEY_SERVER_CONFIGURED, false)

    companion object {
        const val DEFAULT_BASE_URL = "http://10.0.2.2:3000"
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_SERVER_CONFIGURED = "server_configured"
    }
}
