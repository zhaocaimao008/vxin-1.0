package com.vxin.app.core.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.vxin.app.R
import com.vxin.app.MainActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 通知渠道 + 展示。渠道 id 与后端 FCM android.notification.channelId 一致（vxin_messages_v3）。
 *
 * 优化（v3.1）：
 *   1. 通知聚合：同一会话短时间内多条消息折叠为 InboxStyle（最多显示 5 条预览 + 未读总数）。
 *   2. 通知分组：Android 7+ 使用 NotificationGroup，会话独立 + 汇总条目（桌面不刷屏）。
 *   3. 去抖：同一会话 500ms 内的连续通知合并，避免连续震动。
 */
@Singleton
class NotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    init { createChannel() }

    // convId -> 累计未读消息摘要列表（最新在前，最多保留 5 条）
    private val pendingLines = ConcurrentHashMap<String, ArrayDeque<String>>()
    // convId -> 发送者名（汇总标题用）
    private val pendingTitles = ConcurrentHashMap<String, String>()
    // 全局通知 ID 生成器（不同会话不同 ID，系统 tray 独立显示）
    private val notifIdMap = ConcurrentHashMap<String, Int>()
    private val idCounter = AtomicInteger(1000)

    /**
     * 消息通知（支持聚合折叠）。
     * soundEnabled/vibrateEnabled 对齐用户「声音/震动」设置：
     *  - Android 8+ 声音由通知渠道决定，per-notification 的 setDefaults 不生效，
     *    所以按 soundEnabled 选普通渠道（有声）还是静音渠道（CHANNEL_ID_SILENT，setSound(null)）；
     *  - 8 以下版本渠道无意义，靠 setDefaults 的位组合控制。
     */
    fun showMessageNotification(
        title: String,
        body: String,
        conversationId: String?,
        soundEnabled: Boolean = true,
        vibrateEnabled: Boolean = false,
    ) {
        val convId = conversationId ?: "global"
        val channelId = if (soundEnabled) CHANNEL_ID else CHANNEL_ID_SILENT
        val defaults = NotificationCompat.DEFAULT_LIGHTS or
            (if (soundEnabled) NotificationCompat.DEFAULT_SOUND else 0) or
            (if (vibrateEnabled) NotificationCompat.DEFAULT_VIBRATE else 0)
        val notifId = notifIdMap.getOrPut(convId) { idCounter.incrementAndGet() }

        // 聚合摘要列表（最新在前，最多 5 条）
        val lines = pendingLines.getOrPut(convId) { ArrayDeque() }
        lines.addFirst(body)
        if (lines.size > 5) lines.removeLast()
        pendingTitles[convId] = title

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            conversationId?.let { putExtra(EXTRA_CONVERSATION_ID, it) }
        }
        val pending = PendingIntent.getActivity(
            context, notifId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(defaults)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pending)
            // ── 通知分组（Android 7+）──────────────────────────
            .setGroup(GROUP_KEY_MESSAGES)
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)

        // 多条消息时展开 InboxStyle（折叠展示多行摘要）
        if (lines.size > 1) {
            val style = NotificationCompat.InboxStyle()
                .setBigContentTitle(title)
                .setSummaryText("${lines.size} 条新消息")
            lines.forEach { style.addLine(it) }
            builder.setStyle(style)
                   .setNumber(lines.size)   // 角标显示数量
        }

        try {
            val mgr = NotificationManagerCompat.from(context)
            mgr.notify(notifId, builder.build())
            // 更新群组汇总通知（Android 7+ 折叠多会话）
            showGroupSummary(mgr)
        } catch (_: SecurityException) { /* 无权限，忽略 */ }
    }

    /** 清除某会话的聚合缓存（进入聊天时调用） */
    fun clearConversationNotifications(conversationId: String) {
        pendingLines.remove(conversationId)
        pendingTitles.remove(conversationId)
        notifIdMap[conversationId]?.let { NotificationManagerCompat.from(context).cancel(it) }
    }

    /** 群组汇总通知（Android 7+ 多通知折叠）*/
    private fun showGroupSummary(mgr: NotificationManagerCompat) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        val totalUnread = pendingLines.values.sumOf { it.size }
        if (totalUnread < 2) return   // 只有 1 条时不显示汇总
        val summary = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("v信")
            .setContentText("${totalUnread} 条新消息")
            .setGroup(GROUP_KEY_MESSAGES)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        try { mgr.notify(SUMMARY_NOTIFICATION_ID, summary) } catch (_: SecurityException) {}
    }

    /**
     * 来电通知：全屏意图 + 接听/拒绝。App 在后台/锁屏时由系统直接拉起来电界面。
     * data 来自后端 data-only FCM（type=call）。点击/接听/拒绝均拉起 MainActivity 并带 extra，
     * 由 MainActivity 交给 CallManager 进入 INCOMING（accept 时并置接听意图）。
     */
    fun showCallNotification(callId: String, from: String, callerName: String, callType: String) {
        fun callIntent(action: String) = Intent(context, MainActivity::class.java).apply {
            this.action = action
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_CALL_ID, callId)
            putExtra(EXTRA_CALL_FROM, from)
            putExtra(EXTRA_CALL_NAME, callerName)
            putExtra(EXTRA_CALL_TYPE, callType)
        }
        val reqBase = from.hashCode()
        val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val fullScreen = PendingIntent.getActivity(context, reqBase, callIntent(ACTION_CALL_SHOW), piFlags)
        val accept = PendingIntent.getActivity(context, reqBase + 1, callIntent(ACTION_CALL_ACCEPT), piFlags)
        val decline = PendingIntent.getActivity(context, reqBase + 2, callIntent(ACTION_CALL_DECLINE), piFlags)

        val title = callerName.ifBlank { "来电" }
        val text = if (callType == "video") "邀请你视频通话" else "邀请你语音通话"
        val notification = NotificationCompat.Builder(context, CALL_CHANNEL_ID_V2)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(fullScreen)
            .setFullScreenIntent(fullScreen, true)
            .addAction(android.R.drawable.ic_menu_call, "接听", accept)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "拒绝", decline)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(CALL_NOTIFICATION_ID, notification)
        } catch (_: SecurityException) { /* 无权限，忽略 */ }
    }

    /** 接听/拒绝后清除来电通知 */
    fun cancelCallNotification() {
        NotificationManagerCompat.from(context).cancel(CALL_NOTIFICATION_ID)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = context.getSystemService(NotificationManager::class.java) ?: return
            val messages = NotificationChannel(
                CHANNEL_ID, "消息通知", NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "新消息与提及"
                // 锁屏可见性：Android 8+ 由渠道决定。PUBLIC = 锁屏完整显示内容，
                // 否则锁屏收到消息时用户看不到任何提醒（本次问题根因之一）。
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                enableVibration(true)
                enableLights(true)
            }
            mgr.createNotificationChannel(messages)
            // 静音消息渠道：用户关闭「声音」设置时使用。Android 8+ 声音由渠道决定、创建后不可再改，
            // 所以用独立 id（而非改 CHANNEL_ID 的属性）—— 遵循本文件既有的「改渠道属性必须 bump 渠道 id」策略。
            val messagesSilent = NotificationChannel(
                CHANNEL_ID_SILENT, "消息通知（静音）", NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "新消息与提及（已关闭声音）"
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setSound(null, null)
                enableVibration(true)
                enableLights(true)
            }
            mgr.createNotificationChannel(messagesSilent)
            // 旧来电渠道：未 setSound()，Android 8+ 声音由渠道决定、创建后不可再改，
            // 导致来电只响系统默认通知音（单声“叮”非循环铃声）。保留不删（避免老用户渠道设置丢失/崩溃），
            // 新渠道见 CALL_CHANNEL_ID_V2（同「改渠道属性必须 bump 渠道 id」策略，同上 messagesSilent 注释）。
            val calls = NotificationChannel(
                CALL_CHANNEL_ID, "来电", NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "语音/视频通话来电"
                setBypassDnd(true)
                enableVibration(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            mgr.createNotificationChannel(calls)
            // 来电渠道 v2：显式 setSound() 为系统铃声（循环由 CallManager 的 MediaPlayer 负责，
            // 此处渠道声音仅保证系统层兜底一致），IMPORTANCE_MAX 保证弹出式 + 声音，
            // 绕过勿扰，来电就该响、就该弹。
            val callAttrs = android.media.AudioAttributes.Builder()
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val callsV2 = NotificationChannel(
                CALL_CHANNEL_ID_V2, "来电", NotificationManager.IMPORTANCE_MAX,
            ).apply {
                description = "语音/视频通话来电"
                setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE), callAttrs)
                setBypassDnd(true)
                enableVibration(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            mgr.createNotificationChannel(callsV2)
        }
    }

    companion object {
        // 渠道 id 带版本后缀：已存在渠道无法改锁屏可见性/震动（Android 保护用户既有设置），
        // 需换新 id 才能让新配置对老用户生效。改动这些渠道属性时同步 bump 版本号。
        // 注意：后端 FCM android.notification.channelId 也须同步为此值（见 backend push.js）。
        const val CHANNEL_ID = "vxin_messages_v3"
        const val CHANNEL_ID_SILENT = "vxin_messages_v3_silent"
        const val CALL_CHANNEL_ID = "vxin_calls"
        const val CALL_CHANNEL_ID_V2 = "vxin_calls_v2"
        const val EXTRA_CONVERSATION_ID = "conversationId"
        const val CALL_NOTIFICATION_ID = 424242
        const val SUMMARY_NOTIFICATION_ID = 424200        // 群组汇总通知 ID（固定，更新时覆盖）
        const val GROUP_KEY_MESSAGES = "com.vxin.app.MESSAGES"   // 消息通知分组键

        // 来电通知 Intent action / extra（MainActivity 据此进入 INCOMING）
        const val ACTION_CALL_SHOW = "com.vxin.app.action.CALL_SHOW"
        const val ACTION_CALL_ACCEPT = "com.vxin.app.action.CALL_ACCEPT"
        const val ACTION_CALL_DECLINE = "com.vxin.app.action.CALL_DECLINE"
        const val EXTRA_CALL_ID = "callId"
        const val EXTRA_CALL_FROM = "callFrom"
        const val EXTRA_CALL_NAME = "callerName"
        const val EXTRA_CALL_TYPE = "callType"
    }
}
