package com.vxin.app.data.repository

import com.vxin.app.core.storage.AccountStore
import com.vxin.app.core.storage.TokenStore
import com.vxin.app.data.api.AuthApi
import com.vxin.app.data.model.Account
import com.vxin.app.data.model.LoginRequest
import com.vxin.app.data.model.RegisterRequest
import com.vxin.app.data.model.ResetPasswordRequest
import com.vxin.app.data.model.User
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val accountStore: AccountStore,
) {
    suspend fun login(phone: String, password: String): User {
        android.util.Log.d("LOGIN_DIAG", "LOGIN_REQUEST_OBJECT_CREATE_START")
        val request = LoginRequest(phone.trim(), password)
        android.util.Log.d("LOGIN_DIAG", "LOGIN_REQUEST_OBJECT_CREATED phone=${request.phone.take(3)}***")

        android.util.Log.d("LOGIN_DIAG", "LOGIN_RETROFIT_CALL_START")
        val res = api.login(request)
        android.util.Log.d("LOGIN_DIAG", "LOGIN_RETROFIT_CALL_SUCCESS token=${res.token.take(10)}... userId=${res.user.id}")

        applyAuth(res.token, res.user)
        return res.user
    }

    suspend fun register(phone: String, password: String, username: String, inviteCode: String): User {
        val res = api.register(RegisterRequest(phone.trim(), password, username.trim(), inviteCode.trim()))
        applyAuth(res.token, res.user)
        return res.user
    }

    private fun applyAuth(token: String, user: User) {
        tokenStore.token = token
        accountStore.upsertActive(Account(user.id, user.username, user.avatar, token))
    }

    suspend fun restoreSession(): User? {
        if (!tokenStore.isLoggedIn) return null
        return runCatching { api.me() }.getOrNull()
    }

    suspend fun logout() {
        runCatching { api.logout() }
        accountStore.activeId()?.let { accountStore.remove(it) }
        tokenStore.clear()
    }

    suspend fun resetPassword(phone: String, inviteCode: String, newPassword: String) {
        api.resetPassword(
            ResetPasswordRequest(
                phone = phone.trim(),
                inviteCode = inviteCode.trim(),
                newPassword = newPassword,
            ),
        )
    }
}
