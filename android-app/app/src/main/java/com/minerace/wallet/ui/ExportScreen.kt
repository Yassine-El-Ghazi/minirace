package com.minerace.wallet.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.minerace.wallet.crypto.Bip39

@Composable
fun ExportScreen(
    privateKeyHex: String,
    isFirstTime: Boolean,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    var confirmed by remember { mutableStateOf(false) }

    val mnemonic = remember(privateKeyHex) {
        Bip39.encode(context, hexToBytes(privateKeyHex))
    }
    val mnemonicString = remember(mnemonic) { mnemonic.joinToString(" ") }
    val qrBitmap = remember(mnemonicString) { QrCode.encode(mnemonicString, 600) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (!isFirstTime) TextButton(onClick = onDone) { Text("< Back") }
            Text("Backup your wallet", style = MaterialTheme.typography.headlineSmall)
        }

        if (isFirstTime) {
            Text(
                "This is your only chance to save these 24 words. Without them, if you lose this phone or delete the app, your coins are gone forever.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
        } else {
            Text(
                "Anyone with these 24 words controls your wallet. Do not share, do not screenshot on a cloud-synced device, do not paste into any website.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
        }
        Text(
            "Write them on paper in order, or store them in a password manager you trust.",
            style = MaterialTheme.typography.bodySmall,
        )

        Spacer(Modifier.height(4.dp))

        // Numbered 4-column grid so long mnemonics are easy to transcribe.
        val columns = 4
        val rows = (mnemonic.size + columns - 1) / columns
        Column(
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(12.dp),
        ) {
            for (r in 0 until rows) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (c in 0 until columns) {
                        val i = r * columns + c
                        if (i < mnemonic.size) {
                            Text(
                                "${i + 1}. ${mnemonic[i]}",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f),
                            )
                        } else {
                            Box(modifier = Modifier.weight(1f)) {}
                        }
                    }
                }
            }
        }

        OutlinedButton(
            onClick = { copyToClipboard(context, mnemonicString) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Copy 24 words to clipboard") }

        Spacer(Modifier.height(8.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                bitmap = qrBitmap,
                contentDescription = "Backup mnemonic QR",
                modifier = Modifier.size(240.dp),
            )
        }

        Spacer(Modifier.height(8.dp))
        HorizontalDivider()
        Spacer(Modifier.height(8.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = confirmed, onCheckedChange = { confirmed = it })
            Text("I wrote down my 24 words somewhere safe")
        }

        Button(
            onClick = onDone,
            enabled = confirmed,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (isFirstTime) "Continue to wallet" else "Done") }
    }
}

private fun hexToBytes(hex: String): ByteArray {
    val clean = hex.trim()
    require(clean.length % 2 == 0) { "Hex length must be even" }
    val out = ByteArray(clean.length / 2)
    for (i in out.indices) {
        val hi = Character.digit(clean[i * 2], 16)
        val lo = Character.digit(clean[i * 2 + 1], 16)
        require(hi >= 0 && lo >= 0) { "Invalid hex char" }
        out[i] = ((hi shl 4) or lo).toByte()
    }
    return out
}

private fun copyToClipboard(context: Context, text: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("MineRace recovery phrase", text).apply {
        description.extras = android.os.PersistableBundle().apply {
            putBoolean("android.content.extra.IS_SENSITIVE", true)
        }
    }
    cm.setPrimaryClip(clip)
}
