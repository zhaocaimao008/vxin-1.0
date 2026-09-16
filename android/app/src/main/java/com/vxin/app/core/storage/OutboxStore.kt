package com.vxin.app.core.storage

import android.content.Context
import android.content.SharedPreferences
import com.vxin.app.data.model.LocalMsgStatus
import com.vxin.app.data.model.Message
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/** Only the current session can persist/read its own pending messages. */
@Singleton
class OutboxStore internal constructor(
    private val prefs: SharedPreferences,
    private val scopes: MessageScopeProvider,
) {
    @Inject constructor(@ApplicationContext context: Context, scopes: MessageScopeProvider) :
        this(context.getSharedPreferences("vxin_outbox", Context.MODE_PRIVATE), scopes)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val listSerializer = ListSerializer(Message.serializer())

    fun load(conversationId: String, scope: MessageScope? = scopes.current()): List<Message> =
        loadRaw(conversationId, scope).map { it.copy(localStatus = LocalMsgStatus.FAILED, clientMsgId = it.id) }

    fun upsert(conversationId: String, msg: Message, scope: MessageScope? = scopes.current()) {
        if (!scopes.isCurrent(scope) || msg.type != "text" ||
            scope?.owns(msg.sender_id, msg.conversation_id, conversationId) != true) return
        val list = loadRaw(conversationId, scope).toMutableList()
        val idx = list.indexOfFirst { it.id == msg.id }
        if (idx >= 0) list[idx] = msg else list.add(msg)
        save(conversationId, list.takeLast(50), scope)
    }

    fun remove(conversationId: String, msgId: String, scope: MessageScope? = scopes.current()) {
        val list = loadRaw(conversationId, scope)
        val next = list.filterNot { it.id == msgId }
        if (next.size != list.size) save(conversationId, next, scope)
    }

    private fun loadRaw(conversationId: String, scope: MessageScope?): List<Message> {
        if (conversationId.isBlank() || !scopes.isCurrent(scope)) return emptyList()
        val raw = prefs.getString("${scope!!.key}:$conversationId", null) ?: return emptyList()
        return runCatching { json.decodeFromString(listSerializer, raw) }.getOrDefault(emptyList())
            .filter { it.type == "text" && scope.owns(it.sender_id, it.conversation_id, conversationId) }
    }

    private fun save(conversationId: String, list: List<Message>, scope: MessageScope?) {
        if (!scopes.isCurrent(scope)) return
        val key = "${scope!!.key}:$conversationId"
        prefs.edit().apply {
            if (list.isEmpty()) remove(key) else putString(key, json.encodeToString(listSerializer, list))
        }.apply()
    }

    fun clearScope(scope: MessageScope? = scopes.current()) {
        val prefix = scope?.let { "${it.key}:" }
        prefs.edit().apply {
            prefs.all.keys.filter { !it.startsWith("v2_") || (prefix != null && it.startsWith(prefix)) }
                .forEach { remove(it) }
        }.apply()
    }
}
