package com.minerace.wallet.ui

import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import kotlinx.coroutines.launch

@Composable
fun SendScreen(
    senderBalance: Long?,
    isSending: Boolean,
    lastMessage: String?,
    prefillRecipient: String?,
    onSubmit: (recipient: String, amount: Long) -> Unit,
    onScanClick: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var recipient by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    androidx.compose.runtime.LaunchedEffect(prefillRecipient) {
        if (prefillRecipient != null && prefillRecipient.isNotBlank()) {
            recipient = prefillRecipient
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("< Back") }
            Text("Send", style = MaterialTheme.typography.headlineSmall)
        }

        Text(
            senderBalance?.let { "Available: $it" } ?: "Available: …",
            style = MaterialTheme.typography.titleMedium,
        )

        OutlinedTextField(
            value = recipient,
            onValueChange = { recipient = it },
            label = { Text("Recipient public key (130 hex)") },
            singleLine = false,
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedButton(
                onClick = { pasteFromClipboard(context)?.let { recipient = it } },
                modifier = Modifier.weight(1f),
            ) { Text("Paste") }
            OutlinedButton(
                onClick = onScanClick,
                modifier = Modifier.weight(1f),
            ) { Text("Scan QR") }
        }

        OutlinedTextField(
            value = amountText,
            onValueChange = { amountText = it.filter { ch -> ch.isDigit() } },
            label = { Text("Amount") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(4.dp))

        Button(
            onClick = {
                val r = recipient.trim()
                val amount = amountText.toLongOrNull()
                localError = when {
                    r.length != 130 || !r.startsWith("04") ->
                        "Recipient must be uncompressed hex (130 chars, starts with 04)"
                    amount == null || amount <= 0L -> "Amount must be a positive integer"
                    else -> null
                }
                if (localError == null && amount != null) {
                    scope.launch {
                        val auth = BiometricGate.authenticate(
                            context = context,
                            title = "Confirm transaction",
                            subtitle = "Unlock to sign the send of $amount",
                        )
                        when (auth) {
                            is BiometricGate.Result.Success -> onSubmit(r, amount)
                            is BiometricGate.Result.Cancelled -> localError = "Cancelled"
                            is BiometricGate.Result.Failed -> localError = "Auth failed: ${auth.message}"
                        }
                    }
                }
            },
            enabled = !isSending,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isSending) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text("Sign & submit")
            }
        }

        val msg = localError ?: lastMessage
        if (msg != null) {
            Text("Server says: $msg", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun pasteFromClipboard(context: Context): String? {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = cm.primaryClip ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0).coerceToText(context)?.toString()
}
