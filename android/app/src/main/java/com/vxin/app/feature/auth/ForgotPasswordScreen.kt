package com.vxin.app.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vxin.app.ui.components.VxinLogoMark
import com.vxin.app.ui.theme.VxinAuthBg
import com.vxin.app.ui.theme.VxinAuthBorder
import com.vxin.app.ui.theme.VxinAuthGold
import com.vxin.app.ui.theme.VxinAuthPlaceholder
import com.vxin.app.ui.theme.VxinAuthSurface
import com.vxin.app.ui.theme.VxinAuthTextSecondary

@Composable
fun ForgotPasswordScreen(
    onBack: () -> Unit,
    viewModel: ForgotPasswordViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    val fieldColors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
        focusedTextColor = Color.White,
        unfocusedTextColor = Color.White,
        focusedBorderColor = VxinAuthGold,
        unfocusedBorderColor = VxinAuthBorder,
        focusedLabelColor = VxinAuthGold,
        unfocusedLabelColor = VxinAuthTextSecondary,
        cursorColor = VxinAuthGold,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(VxinAuthBg)
            .imePadding()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // 品牌 Logo：黑金标记（与登录/注册页一致，2026-08-24 四端品牌统一）
        VxinLogoMark(modifier = Modifier.size(64.dp))
        Spacer(Modifier.height(14.dp))
        Text("忘记密码", fontSize = com.vxin.app.ui.theme.VxinTextSize.display, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(Modifier.height(6.dp))
        Text(
            "使用注册时的手机号和邀请码重置密码",
            fontSize = com.vxin.app.ui.theme.VxinTextSize.sm2,
            color = VxinAuthTextSecondary,
        )
        Spacer(Modifier.height(28.dp))

        if (state.success) {
            Text("密码已重置，请返回登录", color = VxinAuthGold, fontSize = com.vxin.app.ui.theme.VxinTextSize.md)
            Spacer(Modifier.height(20.dp))
            AuthGoldButton(text = "返回登录", onClick = onBack)
            return@Column
        }

        OutlinedTextField(
            value = state.phone,
            onValueChange = viewModel::onPhoneChange,
            label = { Text("手机号") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = state.inviteCode,
            onValueChange = viewModel::onInviteCodeChange,
            label = { Text("邀请码（6位数字）") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(14.dp))
        var pwdVisible by remember { mutableStateOf(false) }
        OutlinedTextField(
            value = state.newPassword,
            onValueChange = viewModel::onNewPasswordChange,
            label = { Text("新密码（至少8位，含字母和数字）") },
            singleLine = true,
            visualTransformation = if (pwdVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            trailingIcon = {
                TextButton(onClick = { pwdVisible = !pwdVisible }) {
                    Text(if (pwdVisible) "隐藏" else "显示", color = VxinAuthTextSecondary, fontSize = com.vxin.app.ui.theme.VxinTextSize.sm)
                }
            },
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = state.confirmPassword,
            onValueChange = viewModel::onConfirmPasswordChange,
            label = { Text("确认新密码") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )

        if (state.error != null) {
            Spacer(Modifier.height(12.dp))
            Text(state.error!!, color = MaterialTheme.colorScheme.error, fontSize = com.vxin.app.ui.theme.VxinTextSize.sm2)
        }

        Spacer(Modifier.height(24.dp))
        AuthGoldButton(
            text = "重置密码",
            onClick = viewModel::submit,
            enabled = state.canSubmit,
            loading = state.loading,
        )
        Spacer(Modifier.height(12.dp))
        TextButton(onClick = onBack) {
            Text("返回登录", color = VxinAuthTextSecondary)
        }
    }
}

/**
 * 黑底金字描边按钮：与 Login/Register 提交按钮同一套黑金主题（对齐 Web 端 .auth-submit）。
 * 仅供本文件内的"重置密码"/"返回登录"两处使用，不影响 [com.vxin.app.ui.VxinGradientButton]
 * 这个 App 内其它页面（如 AddFriendScreen）仍在用的绿色渐变按钮。
 */
@Composable
private fun AuthGoldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            disabledContainerColor = Color.Transparent,
        ),
        modifier = modifier.fillMaxWidth().height(50.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(com.vxin.app.ui.theme.VxinRadius.pill))
                .background(VxinAuthSurface)
                .border(
                    width = 1.5.dp,
                    color = if (enabled) VxinAuthGold else VxinAuthBorder,
                    shape = RoundedCornerShape(com.vxin.app.ui.theme.VxinRadius.pill),
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (loading) {
                CircularProgressIndicator(Modifier.size(20.dp), color = VxinAuthGold, strokeWidth = 2.dp)
            } else {
                Text(text, color = if (enabled) VxinAuthGold else VxinAuthPlaceholder, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}