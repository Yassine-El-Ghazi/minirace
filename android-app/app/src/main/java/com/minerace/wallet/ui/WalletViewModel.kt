package com.minerace.wallet.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.minerace.wallet.crypto.TransactionSigner
import com.minerace.wallet.data.Settings
import com.minerace.wallet.data.WalletStore
import com.minerace.wallet.network.ApiClient
import com.minerace.wallet.network.SubmitTxRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class WalletViewModel(app: Application) : AndroidViewModel(app) {
    private val store = WalletStore(app)
    private val settings = Settings(app)
    private val api = ApiClient(baseUrlProvider = { settings.baseUrl })

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        val w = store.loadWallet()
        _state.value = _state.value.copy(
            wallet = w,
            baseUrl = settings.baseUrl,
            serverConfigured = settings.isServerConfigured,
        )
        if (w != null) refreshBalance()
    }

    fun createWallet() {
        val w = store.createWallet()
        _state.value = _state.value.copy(wallet = w, balance = null, lastMessage = null)
        refreshBalance()
    }

    fun importWallet(privateKeyHex: String): Boolean = try {
        val w = store.importWallet(privateKeyHex.trim())
        _state.value = _state.value.copy(wallet = w, balance = null, lastMessage = null)
        refreshBalance()
        true
    } catch (e: Exception) {
        _state.value = _state.value.copy(lastMessage = "Import failed: ${e.message}")
        false
    }

    fun deleteWallet() {
        store.deleteWallet()
        _state.value = UiState(baseUrl = settings.baseUrl)
    }

    fun refreshBalance() {
        val w = _state.value.wallet ?: return
        viewModelScope.launch {
            runCatching { api.getBalance(w.publicKeyHex).balance }
                .onSuccess { _state.value = _state.value.copy(balance = it) }
                .onFailure {
                    _state.value = _state.value.copy(lastMessage = "Balance refresh failed: ${it.message}")
                }
        }
    }

    fun send(
        recipientPublicKeyHex: String,
        amount: Long,
        onResult: (Result) -> Unit,
    ) {
        val w = _state.value.wallet ?: return onResult(Result.Error("No wallet loaded"))
        val to = recipientPublicKeyHex.trim()
        if (to.isEmpty()) return onResult(Result.Error("Recipient required"))
        if (amount <= 0L) return onResult(Result.Error("Amount must be > 0"))

        _state.value = _state.value.copy(sending = true, lastMessage = null)
        viewModelScope.launch {
            val signed = TransactionSigner.sign(
                from = w.publicKeyHex,
                to = to,
                amount = amount,
                privateKeyHex = w.privateKeyHex,
            )
            val outcome = runCatching {
                api.submitTransaction(
                    SubmitTxRequest(signed.from, signed.to, signed.amount, signed.signature)
                )
            }
            _state.value = _state.value.copy(sending = false)
            outcome.onSuccess { resp ->
                val msg = resp.message ?: resp.error ?: "(empty response)"
                _state.value = _state.value.copy(lastMessage = msg)
                if (resp.message != null) onResult(Result.Ok(msg)) else onResult(Result.Error(msg))
            }
            outcome.onFailure {
                val msg = "Network error: ${it.message}"
                _state.value = _state.value.copy(lastMessage = msg)
                onResult(Result.Error(msg))
            }
            refreshBalance()
        }
    }

    fun updateBaseUrl(url: String) {
        settings.baseUrl = url
        _state.value = _state.value.copy(
            baseUrl = settings.baseUrl,
            serverConfigured = true,
            lastMessage = "Server updated",
        )
        if (_state.value.wallet != null) refreshBalance()
    }

    data class UiState(
        val wallet: WalletStore.Wallet? = null,
        val balance: Long? = null,
        val baseUrl: String = Settings.DEFAULT_BASE_URL,
        val serverConfigured: Boolean = false,
        val sending: Boolean = false,
        val lastMessage: String? = null,
    )

    sealed class Result {
        data class Ok(val message: String) : Result()
        data class Error(val message: String) : Result()
    }
}
