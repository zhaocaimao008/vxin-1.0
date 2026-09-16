package com.vxin.app.core.storage

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** Drafts are isolated by server, account and conversation; old unowned keys are never read. */
@Singleton
class DraftStore internal constructor(
    private val prefs: SharedPreferences,
    private val scopes: MessageScopeProvider,
) {
    @Inject constructor(@ApplicationContext context: Context, scopes: MessageScopeProvider) :
        this(context.getSharedPreferences("vxin_drafts", Context.MODE_PRIVATE), scopes)

    fun get(conversationId: String, scope: MessageScope? = scopes.current()): String {
        if (conversationId.isBlank() || !scopes.isCurrent(scope)) return ""
        return runCatching { prefs.getString("${scope!!.key}:$conversationId", "").orEmpty() }.getOrDefault("")
    }

    fun set(conversationId: String, text: String, scope: MessageScope? = scopes.current()) {
        if (conversationId.isBlank() || !scopes.isCurrent(scope)) return
        val key = "${scope!!.key}:$conversationId"
        prefs.edit().apply { if (text.isEmpty()) remove(key) else putString(key, text) }.apply()
    }

    fun clear(conversationId: String, scope: MessageScope? = scopes.current()) = set(conversationId, "", scope)

    fun clearScope(scope: MessageScope? = scopes.current()) {
        val prefix = scope?.let { "${it.key}:" }
        prefs.edit().apply {
            prefs.all.keys.filter { !it.startsWith("v2_") || (prefix != null && it.startsWith(prefix)) }
                .forEach { remove(it) }
        }.apply()
    }
}
