package com.minerace.wallet.ui

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.minerace.wallet.crypto.Bip39

@Composable
fun SetupScreen(
    onCreate: () -> Unit,
    onImport: (String) -> Boolean,
    onScanImport: () -> Unit,
    scannedKey: String?,
    errorMessage: String?,
) {
    val context = LocalContext.current
    var importKey by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(scannedKey) {
        if (!scannedKey.isNullOrBlank()) importKey = scannedKey.trim()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Welcome", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Your private key stays on this device, encrypted with the Android Keystore. " +
                "No server ever sees it.",
            style = MaterialTheme.typography.bodyMedium,
        )

        Spacer(Modifier.height(8.dp))

        Button(onClick = onCreate, modifier = Modifier.fillMaxWidth()) {
            Text("Create new wallet")
        }

        HorizontalDivider()

        Text("Or restore from backup", style = MaterialTheme.typography.titleSmall)
        Text(
            "Paste your 24-word recovery phrase, or a 64-character private key (hex).",
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedTextField(
            value = importKey,
            onValueChange = { importKey = it },
            label = { Text("Recovery phrase or private key") },
            singleLine = false,
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedButton(
                onClick = {
                    val hex = resolveImport(context, importKey)
                    if (hex == null) {
                        localError = "Enter 24 BIP-39 words or a 64-hex-character private key"
                    } else {
                        localError = null
                        onImport(hex)
                    }
                },
                modifier = Modifier.weight(1f),
            ) { Text("Import") }
            OutlinedButton(
                onClick = onScanImport,
                modifier = Modifier.weight(1f),
            ) { Text("Scan QR") }
        }

        val msg = localError ?: errorMessage
        if (msg != null) {
            Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun resolveImport(context: android.content.Context, raw: String): String? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null

    // Try BIP-39 mnemonic first (multi-word input).
    val tokens = Bip39.normalize(trimmed)
    if (tokens.size >= 12) {
        return try {
            val bytes = Bip39.decode(context, tokens)
            bytes.joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            null
        }
    }

    // Fallback: 64-hex-char private key.
    val hex = trimmed.lowercase()
    if (hex.length == 64 && hex.all { it in '0'..'9' || it in 'a'..'f' }) return hex
    return null
}
