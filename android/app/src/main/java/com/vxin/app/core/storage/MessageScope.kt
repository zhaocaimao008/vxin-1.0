package com.vxin.app.core.storage

import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/** Stable disk namespace; the credential only invalidates callbacks from an old session. */
data class MessageScope(val server: String, val userId: String, private val credential: String) {
    val key: String = "v2_" + MessageDigest.getInstance("SHA-256")
        .digest("${server.length}:$server${userId.length}:$userId".toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    fun owns(senderId: String, messageConversationId: String, conversationId: String): Boolean =
        senderId == userId && conversationId.isNotBlank() && messageConversationId == conversationId

    override fun toString(): String = "MessageScope(server=$server, userId=$userId)"
}

@Singleton
class MessageScopeProvider internal constructor(private val resolve: () -> MessageScope?) {
    @Inject constructor(accounts: AccountStore, server: ServerConfig, tokens: TokenStore) : this({
        val url = server.baseUrl.trim().trimEnd('/')
        val user = accounts.activeId()?.takeIf { it.isNotBlank() }
        val token = tokens.token?.takeIf { it.isNotBlank() }
        if (user == null || token == null) null else MessageScope(url, user, token)
    })

    fun current(): MessageScope? = resolve()
    fun isCurrent(scope: MessageScope?): Boolean = scope != null && scope == current()
}
