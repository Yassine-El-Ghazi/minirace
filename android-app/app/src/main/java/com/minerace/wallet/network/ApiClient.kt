package com.minerace.wallet.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiClient(
    baseUrlProvider: () -> String,
) {
    private val baseUrlProviderFn = baseUrlProvider

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

    suspend fun getBalance(address: String): BalanceResponse = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("${base()}/api/balance/$address").get().build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            require(resp.isSuccessful) { "GET /api/balance failed: ${resp.code} $body" }
            json.decodeFromString(BalanceResponse.serializer(), body)
        }
    }

    suspend fun getMempool(): List<MempoolTx> = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("${base()}/api/mempool").get().build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            require(resp.isSuccessful) { "GET /api/mempool failed: ${resp.code} $body" }
            json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(MempoolTx.serializer()), body)
        }
    }

    suspend fun getDifficulty(): DifficultyResponse = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("${base()}/api/difficulty").get().build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            require(resp.isSuccessful) { "GET /api/difficulty failed: ${resp.code} $body" }
            json.decodeFromString(DifficultyResponse.serializer(), body)
        }
    }

    /**
     * Submits a signed transaction. Returns the parsed response either way so the
     * caller can show the server's validation message (e.g. "Insufficient balance").
     * HTTP 4xx still returns a structured [SubmitTxResponse]; only transport failures throw.
     */
    suspend fun submitTransaction(payload: SubmitTxRequest): SubmitTxResponse = withContext(Dispatchers.IO) {
        val body = json.encodeToString(SubmitTxRequest.serializer(), payload)
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url("${base()}/api/transaction").post(body).build()
        client.newCall(req).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (raw.isBlank()) SubmitTxResponse(error = "Empty response (${resp.code})")
            else json.decodeFromString(SubmitTxResponse.serializer(), raw)
        }
    }

    private fun base(): String = baseUrlProviderFn().trimEnd('/')
}
