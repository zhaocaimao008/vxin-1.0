package com.vxin.app.core.realtime

import android.util.Log
import com.vxin.app.core.storage.ServerConfig
import com.vxin.app.core.storage.TokenStore
import com.vxin.app.data.model.Message
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.Json
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

enum class SocketStatus { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * Socket.IO 实时通道（官方 io.socket:socket.io-client）。
 *
 * - 鉴权：handshake auth.token 携带 Bearer（对齐后端 io.use）
 * - 心跳：由 engine.io 内置 ping/pong 维持（服务端配置间隔），官方库自动处理 + 自动重连，
 *   无需自造心跳；这里只对外暴露连接状态。
 * - 接收：监听 new_message / new_message_batch，统一转成 Message 推到 incomingMessages
 * - 发送：emit("send_message", {conversationId, content}) 带 ack，封装为挂起函数
 *
 * 生命周期由 SessionManager 管理：登录/恢复会话后 connect()，登出时 disconnect()。
 */
@Singleton
class SocketManager @Inject constructor(
    private val tokenStore: TokenStore,
    private val serverConfig: ServerConfig,
    private val json: Json,
) {
    private var socket: Socket? = null

    private val _status = MutableStateFlow(SocketStatus.DISCONNECTED)
    val status: StateFlow<SocketStatus> = _status.asStateFlow()

    private val _incomingMessages = MutableSharedFlow<Message>(extraBufferCapacity = 128)
    val incomingMessages: SharedFlow<Message> = _incomingMessages.asSharedFlow()

    @Synchronized
    fun connect() {
        val token = tokenStore.token ?: return        // 未登录不连
        if (socket?.connected() == true) return

        // 已有实例先清理，避免 token/地址变更后复用旧连接
        disconnectInternal()

        val opts = IO.Options().apply {
            transports = arrayOf("websocket")          // 仅 websocket，匹配服务端
            reconnection = true
            reconnectionDelay = 1000
            reconnectionDelayMax = 10_000
            auth = mapOf("token" to token)             // Bearer 握手鉴权
        }

        val s = try {
            IO.socket(serverConfig.baseUrl, opts)
        } catch (e: Exception) {
            Log.e(TAG, "build socket failed: ${e.message}")
            return
        }
        socket = s

        s.on(Socket.EVENT_CONNECT) { _status.value = SocketStatus.CONNECTED }
        s.on(Socket.EVENT_DISCONNECT) { _status.value = SocketStatus.DISCONNECTED }
        s.on(Socket.EVENT_CONNECT_ERROR) { args ->
            _status.value = SocketStatus.DISCONNECTED
            Log.w(TAG, "connect_error: ${args.firstOrNull()}")
        }

        s.on("new_message") { args -> parseMessage(args.firstOrNull())?.let(_incomingMessages::tryEmit) }
        s.on("new_message_batch") { args ->
            (args.firstOrNull() as? JSONArray)?.let { arr ->
                for (i in 0 until arr.length()) parseMessage(arr.optJSONObject(i))?.let(_incomingMessages::tryEmit)
            }
        }

        _status.value = SocketStatus.CONNECTING
        s.connect()
    }

    /** 通过 socket 发送文本消息；ack 返回服务端落库后的完整 Message */
    suspend fun sendMessage(conversationId: String, content: String): Result<Message> =
        suspendCancellableCoroutine { cont ->
            val s = socket
            if (s == null || !s.connected()) {
                cont.resume(Result.failure(IllegalStateException("连接已断开")))
                return@suspendCancellableCoroutine
            }
            val payload = JSONObject()
                .put("conversationId", conversationId)
                .put("content", content)

            s.emit("send_message", payload, Ack { ackArgs ->
                if (!cont.isActive) return@Ack
                val resp = ackArgs.firstOrNull() as? JSONObject
                when {
                    resp == null -> cont.resume(Result.failure(IllegalStateException("无响应")))
                    resp.optBoolean("success", false) -> {
                        val msg = parseMessage(resp.optJSONObject("message"))
                        if (msg != null) cont.resume(Result.success(msg))
                        else cont.resume(Result.failure(IllegalStateException("响应解析失败")))
                    }
                    else -> cont.resume(Result.failure(RuntimeException(resp.optString("error", "发送失败"))))
                }
            })
        }

    @Synchronized
    fun disconnect() {
        disconnectInternal()
        _status.value = SocketStatus.DISCONNECTED
    }

    private fun disconnectInternal() {
        socket?.apply {
            off()
            disconnect()
        }
        socket = null
    }

    private fun parseMessage(any: Any?): Message? {
        val obj = any as? JSONObject ?: return null
        return runCatching { json.decodeFromString<Message>(obj.toString()) }
            .onFailure { Log.w(TAG, "parse message failed: ${it.message}") }
            .getOrNull()
    }

    private companion object {
        const val TAG = "SocketManager"
    }
}
