package com.minerace.wallet.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.minerace.wallet.data.Settings

@Composable
fun ServerSetupScreen(
    initialUrl: String = Settings.DEFAULT_BASE_URL,
    onSave: (String) -> Unit,
) {
    var url by remember { mutableStateOf(initialUrl) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Welcome", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Before creating or importing a wallet, tell the app where the MineRace server is running.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            "Example: http://192.168.1.10:3000 (your PC on the LAN), or http://10.0.2.2:3000 for an Android emulator.",
            style = MaterialTheme.typography.bodySmall,
        )

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it; error = null },
            label = { Text("Server URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        if (error != null) {
            Text(error!!, style = MaterialTheme.typography.bodySmall)
        }

        Button(
            onClick = {
                val trimmed = url.trim().trimEnd('/')
                if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                    error = "URL must start with http:// or https://"
                    return@Button
                }
                onSave(trimmed)
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Continue") }
    }
}
