package com.minerace.wallet.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.minerace.wallet.data.WalletStore
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

private object Routes {
    const val SERVER_SETUP = "server_setup"
    const val SETUP = "setup"
    const val WALLET = "wallet"
    const val SEND = "send"
    const val SCAN = "scan"
    const val SETTINGS = "settings"
    const val EXPORT = "export"
}

@Composable
fun WalletApp() {
    MaterialTheme {
        Scaffold { padding ->
            val vm: WalletViewModel = viewModel()
            val state by vm.state.collectAsState()
            val nav = rememberNavController()

            val startDestination = when {
                !state.serverConfigured -> Routes.SERVER_SETUP
                state.wallet != null -> Routes.WALLET
                else -> Routes.SETUP
            }

            // If the wallet goes from present → null (deleted), bounce to setup.
            // Only fires on an actual transition; the startDestination handles first launch.
            LaunchedEffect(Unit) {
                var previous: WalletStore.Wallet? = state.wallet
                vm.state.collect { s ->
                    if (previous != null && s.wallet == null) {
                        nav.navigate(Routes.SETUP) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                    previous = s.wallet
                }
            }

            NavHost(
                navController = nav,
                startDestination = startDestination,
                modifier = Modifier.padding(padding),
            ) {
                composable(Routes.SERVER_SETUP) {
                    ServerSetupScreen(
                        initialUrl = state.baseUrl,
                        onSave = { url ->
                            vm.updateBaseUrl(url)
                            val next = if (state.wallet != null) Routes.WALLET else Routes.SETUP
                            nav.navigate(next) {
                                popUpTo(Routes.SERVER_SETUP) { inclusive = true }
                            }
                        },
                    )
                }
                composable(Routes.SETUP) { entry ->
                    val handle = entry.savedStateHandle
                    val scanned = handle.get<String>("scanned")
                    if (scanned != null) handle.remove<String>("scanned")
                    SetupScreen(
                        onCreate = {
                            vm.createWallet()
                            nav.navigate("${Routes.EXPORT}?firstTime=true") {
                                popUpTo(Routes.SETUP) { inclusive = true }
                            }
                        },
                        onImport = { priv ->
                            val ok = vm.importWallet(priv)
                            if (ok) {
                                nav.navigate(Routes.WALLET) {
                                    popUpTo(Routes.SETUP) { inclusive = true }
                                }
                            }
                            ok
                        },
                        onScanImport = { nav.navigate(Routes.SCAN) },
                        scannedKey = scanned,
                        errorMessage = state.lastMessage?.takeIf { it.startsWith("Import failed") },
                    )
                }
                composable(Routes.WALLET) {
                    val w = state.wallet ?: return@composable
                    WalletScreen(
                        wallet = w,
                        balance = state.balance,
                        onSend = { nav.navigate(Routes.SEND) },
                        onSettings = { nav.navigate(Routes.SETTINGS) },
                        onRefresh = { vm.refreshBalance() },
                    )
                }
                composable(Routes.SEND) { entry ->
                    val handle = entry.savedStateHandle
                    val scanned = handle.get<String>("scanned")
                    if (scanned != null) handle.remove<String>("scanned")
                    SendScreen(
                        senderBalance = state.balance,
                        isSending = state.sending,
                        lastMessage = state.lastMessage,
                        prefillRecipient = scanned,
                        onSubmit = { recipient, amount ->
                            vm.send(recipient, amount) { /* state.lastMessage already updated */ }
                        },
                        onScanClick = { nav.navigate(Routes.SCAN) },
                        onBack = { nav.popBackStack() },
                    )
                }
                composable(Routes.SCAN) {
                    ScanScreen(
                        onResult = { text ->
                            nav.previousBackStackEntry?.savedStateHandle?.set("scanned", text)
                            nav.popBackStack()
                        },
                        onCancel = { nav.popBackStack() },
                    )
                }
                composable(Routes.SETTINGS) {
                    SettingsScreen(
                        currentBaseUrl = state.baseUrl,
                        onSaveBaseUrl = { vm.updateBaseUrl(it) },
                        onDeleteWallet = { vm.deleteWallet() },
                        onRevealPrivateKey = { nav.navigate(Routes.EXPORT) },
                        onBack = { nav.popBackStack() },
                    )
                }
                composable(
                    route = "${Routes.EXPORT}?firstTime={firstTime}",
                    arguments = listOf(
                        navArgument("firstTime") {
                            type = NavType.BoolType
                            defaultValue = false
                        },
                    ),
                ) { entry ->
                    val w = state.wallet ?: return@composable
                    val firstTime = entry.arguments?.getBoolean("firstTime") == true
                    ExportScreen(
                        privateKeyHex = w.privateKeyHex,
                        isFirstTime = firstTime,
                        onDone = {
                            if (firstTime) {
                                nav.navigate(Routes.WALLET) {
                                    popUpTo(0) { inclusive = true }
                                }
                            } else {
                                nav.popBackStack()
                            }
                        },
                    )
                }
            }
        }
    }
}
