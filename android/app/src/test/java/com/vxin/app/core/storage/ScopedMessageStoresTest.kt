package com.vxin.app.core.storage

import android.content.SharedPreferences
import com.vxin.app.data.model.Message
import org.junit.Assert.*
import org.junit.Test

class ScopedMessageStoresTest {
    private val a = MessageScope("https://one.invalid", "alice", "token-a")
    private val b = MessageScope("https://one.invalid", "bob", "token-b")
    private val otherServer = MessageScope("https://two.invalid", "alice", "token-a")
    private var current: MessageScope? = a
    private val scopes = MessageScopeProvider { current }
    private val prefs = MemoryPreferences()

    @Test fun scopeKeysArePrivateAndSessionIndependent() {
        assertNotEquals(a.key, b.key)
        assertNotEquals(a.key, otherServer.key)
        assertEquals(a.key, MessageScope(a.server, a.userId, "new-token").key)
        assertFalse(a.toString().contains("token-a"))
        assertFalse(a.owns("bob", "group", "group"))
        assertFalse(a.owns("alice", "other", "group"))
    }

    @Test fun draftsNeverCrossAccountsServersOrExpiredCallbacks() {
        val store = DraftStore(prefs, scopes)
        prefs.edit().putString("group", "legacy secret").apply()
        assertEquals("", store.get("group", a))
        store.set("group", "你好 👋", a)
        current = b
        assertEquals("", store.get("group", b))
        store.set("group", "old callback", a)
        store.set("group", "bob draft", b)
        current = otherServer
        assertEquals("", store.get("group", otherServer))
        current = a
        assertEquals("你好 👋", store.get("group", a))
        store.clearScope(a)
        assertEquals("", store.get("group", a))
        current = b
        assertEquals("bob draft", store.get("group", b))
        assertNull(prefs.getString("group", null))
    }

    @Test fun outboxRejectsWrongSenderAndOldSessionWrites() {
        val store = OutboxStore(prefs, scopes)
        val own = Message(id = "pending-a", conversation_id = "group", sender_id = "alice", content = "private")
        store.upsert("group", own, a)
        store.upsert("group", own.copy(id = "poison", sender_id = "bob"), a)
        assertEquals(listOf("pending-a"), store.load("group", a).map { it.id })
        current = b
        assertTrue(store.load("group", b).isEmpty())
        store.upsert("group", own, b)
        store.upsert("group", own, a)
        assertTrue(store.load("group", b).isEmpty())
        current = a
        assertEquals(1, store.load("group", a).size)
        store.clearScope(a)
        current = null
        store.upsert("group", own, a)
        current = a
        assertTrue(store.load("group", a).isEmpty())
    }

    @Test fun historyCacheDoesNotLeakWhenAccountChanges() {
        val store = MsgCacheStore(prefs, scopes)
        val msg = Message(id = "server-id", conversation_id = "group", sender_id = "alice", content = "private")
        store.save("group", listOf(msg), a)
        current = b
        assertTrue(store.load("group", b).isEmpty())
        store.save("group", listOf(msg), a)
        assertTrue(store.load("group", b).isEmpty())
        current = a
        assertEquals("private", store.load("group", a).single().content)
        store.clear()
        assertTrue(store.load("group", a).isEmpty())
    }
}

/** In-memory implementation tests real store logic without Android framework or a production keychain. */
private class MemoryPreferences : SharedPreferences {
    private val data = mutableMapOf<String, Any?>()
    override fun getAll(): MutableMap<String, *> = data.toMutableMap()
    override fun getString(key: String?, defValue: String?): String? = data[key] as? String ?: defValue
    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = data[key] as? MutableSet<String> ?: defValues
    override fun getInt(key: String?, defValue: Int): Int = data[key] as? Int ?: defValue
    override fun getLong(key: String?, defValue: Long): Long = data[key] as? Long ?: defValue
    override fun getFloat(key: String?, defValue: Float): Float = data[key] as? Float ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean): Boolean = data[key] as? Boolean ?: defValue
    override fun contains(key: String?): Boolean = data.containsKey(key)
    override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
    override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
    override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
        private val values = mutableMapOf<String, Any?>()
        private var clearing = false
        override fun putString(k: String?, v: String?) = apply { if (k != null) values[k] = v }
        override fun putStringSet(k: String?, v: MutableSet<String>?) = apply { if (k != null) values[k] = v }
        override fun putInt(k: String?, v: Int) = apply { if (k != null) values[k] = v }
        override fun putLong(k: String?, v: Long) = apply { if (k != null) values[k] = v }
        override fun putFloat(k: String?, v: Float) = apply { if (k != null) values[k] = v }
        override fun putBoolean(k: String?, v: Boolean) = apply { if (k != null) values[k] = v }
        override fun remove(k: String?) = apply { if (k != null) values[k] = null }
        override fun clear() = apply { clearing = true }
        override fun commit(): Boolean { apply(); return true }
        override fun apply() { if (clearing) data.clear(); values.forEach { (k, v) -> if (v == null) data.remove(k) else data[k] = v } }
    }
}
