package com.minerace.wallet.network

import kotlinx.serialization.Serializable

@Serializable
data class BalanceResponse(val address: String, val balance: Long)

@Serializable
data class DifficultyResponse(val difficulty: Int, val miningReward: Long)

@Serializable
data class MempoolTx(
    val from: String,
    val to: String,
    val amount: Long,
    val signature: String? = null,
)

@Serializable
data class SubmitTxRequest(
    val from: String,
    val to: String,
    val amount: Long,
    val signature: String,
)

@Serializable
data class SubmitTxResponse(
    val message: String? = null,
    val error: String? = null,
)
