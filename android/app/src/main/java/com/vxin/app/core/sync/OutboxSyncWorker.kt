package com.vxin.app.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.vxin.app.core.realtime.SocketManager
import com.vxin.app.core.realtime.SocketStatus
import com.vxin.app.core.storage.OutboxStore
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * A10: WorkManager 后台 Outbox 同步 Worker
 * 触发条件：网络可用 + App 后台
 * 功能：重试 OutboxStore 中 error 状态的待发消息
 */
@HiltWorker
class OutboxSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val outboxStore: OutboxStore,
    private val socketManager: SocketManager,
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        if (socketManager.status.value != SocketStatus.CONNECTED) return Result.retry()
        val pending = outboxStore.loadAll()
        if (pending.isEmpty()) return Result.success()
        var failCount = 0
        for (item in pending) {
            try {
                val result = socketManager.sendMessage(
                    conversationId = item.conversationId,
                    content = item.content,
                    clientMsgId = item.clientMsgId,
                )
                if (result.isSuccess) outboxStore.remove(item.clientMsgId) else failCount++
            } catch (_: Exception) { failCount++ }
        }
        return if (failCount == 0) Result.success() else Result.retry()
    }

    companion object {
        const val WORK_NAME = "vxin_outbox_sync"

        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<OutboxSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun runNow(context: Context) {
            val req = OneTimeWorkRequestBuilder<OutboxSyncWorker>()
                .setConstraints(Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueue(req)
        }
    }
}
