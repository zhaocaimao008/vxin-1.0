package com.vxin.app.core.auth

import com.vxin.app.core.di.AppScope
import com.vxin.app.core.network.AuthInterceptor
import com.vxin.app.core.realtime.SocketManager
import com.vxin.app.data.model.User
import com.vxin.app.data.repository.AuthRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

sealed interface AuthState {
    data object Loading : AuthState
    data object Unauthenticated : AuthState
    data class Authenticated(val user: User) : AuthState
}

/**
 * 全局会话状态的单一事实来源。
 * - 启动即 restoreSession（凭已存 token 调 /me）
 * - 订阅 AuthInterceptor 的 401 事件 → 自动登出
 * - 登录成功 / 登出由 ViewModel 调用更新
 */
@Singleton
class SessionManager @Inject constructor(
    private val authRepository: AuthRepository,
    private val socketManager: SocketManager,
    authInterceptor: AuthInterceptor,
    @AppScope private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        scope.launch {
            authInterceptor.unauthorizedEvents.collect {
                socketManager.disconnect()
                _state.value = AuthState.Unauthenticated
            }
        }
        scope.launch { restoreSession() }
    }

    suspend fun restoreSession() {
        val user = authRepository.restoreSession()
        if (user != null) {
            socketManager.connect()
            _state.value = AuthState.Authenticated(user)
        } else {
            _state.value = AuthState.Unauthenticated
        }
    }

    fun onAuthenticated(user: User) {
        socketManager.connect()
        _state.value = AuthState.Authenticated(user)
    }

    suspend fun logout() {
        socketManager.disconnect()
        authRepository.logout()
        _state.value = AuthState.Unauthenticated
    }
}
