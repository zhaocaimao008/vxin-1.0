package com.vxin.app.core.network

import com.vxin.app.core.storage.MessageScope
import com.vxin.app.core.storage.MessageScopeProvider
import com.vxin.app.core.storage.TokenStore
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
    private val scopes: MessageScopeProvider,
) : Interceptor {
    private val _unauthorized = MutableSharedFlow<MessageScope>(extraBufferCapacity = 1)
    val unauthorizedEvents: SharedFlow<MessageScope> = _unauthorized

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val anonymous = original.url.encodedPath in setOf("/api/auth/login", "/api/auth/register", "/api/auth/reset-password")
        val scope = if (anonymous) null else scopes.current()
        val token = if (scope != null) tokenStore.token else null
        val request = if (scope != null && token != null) {
            val server = scope.server.toHttpUrlOrNull()
            if (!scopes.isCurrent(scope) || server == null || server.host != original.url.host ||
                server.scheme != original.url.scheme || server.port != original.url.port) {
                throw IOException("服务器或账号已切换")
            }
            original.newBuilder().header("Authorization", "Bearer $token").build()
        } else original
        val response = chain.proceed(request)
        if (response.code == 401 && scope != null && scopes.isCurrent(scope)) {
            tokenStore.clear()
            _unauthorized.tryEmit(scope)
        }
        return response
    }
}
