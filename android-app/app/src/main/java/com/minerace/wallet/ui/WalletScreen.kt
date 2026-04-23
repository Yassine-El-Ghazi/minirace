package com.minerace.wallet.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.minerace.wallet.data.WalletStore

@Composable
fun WalletScreen(
    wallet: WalletStore.Wallet,
    balance: Long?,
    onSend: () -> Unit,
    onSettings: () -> Unit,
    onRefresh: () -> Unit,
) {
    val context = LocalContext.current
    val qr = remember(wallet.publicKeyHex) {
        runCatching { QrCode.encode(wallet.publicKeyHex, 512) }.getOrNull()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("MineRace", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            TextButton(onClick = onRefresh) { Text("Refresh") }
            TextButton(onClick = onSettings) { Text("Settings") }
        }

        Text(
            text = balance?.let { "Balance: $it" } ?: "Balance: …",
            style = MaterialTheme.typography.headlineLarge,
        )

        Spacer(Modifier.size(8.dp))

        if (qr != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .background(Color.White)
                    .padding(8.dp),
            ) {
                Image(
                    bitmap = qr,
                    contentDescription = "Your public key as QR",
                    filterQuality = FilterQuality.None,
                    modifier = Modifier.size(240.dp),
                )
            }
        }

        Text("Your public key", style = MaterialTheme.typography.titleSmall)
        Text(wallet.publicKeyHex, style = MaterialTheme.typography.bodySmall)

        OutlinedButton(
            onClick = { copyToClipboard(context, "MineRace public key", wallet.publicKeyHex) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Copy public key") }

        Spacer(Modifier.size(8.dp))

        Button(onClick = onSend, modifier = Modifier.fillMaxWidth()) {
            Text("Send")
        }
    }
}

private fun copyToClipboard(context: Context, label: String, text: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText(label, text))
    Toast.makeText(context, "Copied", Toast.LENGTH_SHORT).show()
}
