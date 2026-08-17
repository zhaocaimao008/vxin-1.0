package com.vxin.app.core.push

/**
 * 通知偏好共享缓存（跨 MessageNotificationBridge / VxinMessagingService / VxinGeTuiService 共用）。
 *
 * 网络刷新（TTL 60s）由 MessageNotificationBridge 在收到 socket 消息时发起——FCM/个推的
 * onMessageReceived / onReceiveMessageData 跑在后台回调里，不能同步拉网络，只读这里已缓存的值；
 * 若从未刷新过（bridge 还没跑过一次）就用下面声明的默认值。
 */
object NotifySettingsCache {
    @Volatile var messageNotifyEnabled: Boolean = true
    @Volatile var detailPreviewEnabled: Boolean = true
    @Volatile var vibrateEnabled: Boolean = false
    @Volatile var soundEnabled: Boolean = true
    @Volatile var mutedConversations: Set<String> = emptySet()
    @Volatile var loadedAt: Long = 0L

    const val TTL_MS = 60_000L
}
