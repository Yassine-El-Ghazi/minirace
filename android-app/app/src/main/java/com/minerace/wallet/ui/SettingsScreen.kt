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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(
    currentBaseUrl: String,
    onSaveBaseUrl: (String) -> Unit,
    onDeleteWallet: () -> Unit,
    onRevealPrivateKey: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var urlField by remember { mutableStateOf(currentBaseUrl) }
    var showConfirm by remember { mutableStateOf(false) }
    var revealError by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("< Back") }
            Text("Settings", style = MaterialTheme.typography.headlineSmall)
        }

        Text("Server", style = MaterialTheme.typography.titleMedium)
        Text(
            "Emulator hits the host via http://10.0.2.2:3000. " +
                "On a physical device use http://<laptop-LAN-IP>:3000.",
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedTextField(
            value = urlField,
            onValueChange = { urlField = it },
            label = { Text("Base URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedButton(
            onClick = { onSaveBaseUrl(urlField) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Save server") }

        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))

        Text("Backup", style = MaterialTheme.typography.titleMedium)
        Text(
            "Reveal the private key so you can save it elsewhere. You will be asked to unlock with biometrics or the device PIN first.",
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedButton(
            onClick = {
                revealError = null
                scope.launch {
                    val auth = BiometricGate.authenticate(
                        context = context,
                        title = "Reveal private key",
                        subtitle = "Unlock to show your backup key",
                    )
                    when (auth) {
                        is BiometricGate.Result.Success -> onRevealPrivateKey()
                        is BiometricGate.Result.Cancelled -> revealError = "Cancelled"
                        is BiometricGate.Result.Failed -> revealError = "Auth failed: ${auth.message}"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Reveal private key") }
        if (revealError != null) {
            Text(revealError!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))

        Text("Danger zone", style = MaterialTheme.typography.titleMedium)
        Text(
            "Deleting the wallet erases the encrypted private key from this device. " +
                "If you do not have a backup you will lose access to the funds.",
            style = MaterialTheme.typography.bodySmall,
        )
        Button(
            onClick = { showConfirm = true },
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Delete wallet") }
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Delete wallet?") },
            text = { Text("This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    showConfirm = false
                    onDeleteWallet()
                }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text("Cancel") }
            },
        )
    }
}
