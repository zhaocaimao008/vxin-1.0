package com.vxin.app.feature.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vxin.app.R
import com.vxin.app.ui.components.VxinAuthField
import com.vxin.app.ui.components.VxinPasswordField
import com.vxin.app.ui.components.VxinRoundCheckbox
import com.vxin.app.ui.VxinIcons
import com.vxin.app.ui.theme.VxinBrand
import com.vxin.app.ui.theme.VxinRadius
import com.vxin.app.ui.theme.VxinTextPrimary
import com.vxin.app.ui.theme.VxinTextSecondary
import com.vxin.app.ui.theme.VxinTextSize

@Composable
fun LoginScreen(
    onNavigateRegister: () -> Unit,
    onNavigateForgotPassword: () -> Unit = {},
    onSuccess: () -> Unit = {},
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(state.loggedIn) { if (state.loggedIn) onSuccess() }
    var showServerConfig by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }
    // 记住手机号（明文本地存储，等级与 ServerConfig 一致）；密码不做本地持久化，避免明文凭据泄露风险
    var rememberPhone by remember { mutableStateOf(true) }
    var agreed by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 32.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))
        // 品牌 Logo：使用项目正式 App 图标资源，而非参考图上的示意 Logo
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .size(76.dp)
                .clip(RoundedCornerShape(VxinRadius.xl)),
        ) {
            Image(
                painter = painterResource(R.mipmap.ic_launcher_foreground),
                contentDescription = "v信",
                modifier = Modifier.fillMaxSize(),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text("v信", fontSize = VxinTextSize.displayLg, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
        Spacer(Modifier.height(6.dp))
        Text("连接世界 · 沟通无限", fontSize = VxinTextSize.base, color = VxinTextSecondary)
        Spacer(Modifier.height(36.dp))

        // 登录方式：当前仅「手机登录」有真实后端支持（login 仅按手机号查询）。
        // 参考图上的「v信登录」（按 v信号登录）没有对应的后端能力，未实现，避免伪造入口。
        Text(
            "手机登录",
            fontSize = VxinTextSize.lg,
            fontWeight = FontWeight.SemiBold,
            color = VxinTextPrimary,
            modifier = Modifier
                .align(Alignment.Start)
                .padding(bottom = 4.dp),
        )
        androidx.compose.foundation.layout.Box(
            Modifier
                .align(Alignment.Start)
                .width(56.dp)
                .height(2.dp)
                .background(VxinBrand),
        )
        Spacer(Modifier.height(20.dp))

        VxinAuthField(
            icon = VxinIcons.Phone,
            value = state.phone,
            onValueChange = viewModel::onPhoneChange,
            placeholder = "请输入手机号",
            keyboardType = KeyboardType.Phone,
            testTag = "login-phone-input",
            trailing = {
                Text("+86", color = VxinTextSecondary, fontSize = VxinTextSize.base)
            },
        )
        VxinPasswordField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            placeholder = "请输入密码",
            visible = passwordVisible,
            onVisibleChange = { passwordVisible = it },
            testTag = "login-password-input",
        )

        Spacer(Modifier.height(16.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                VxinRoundCheckbox(checked = rememberPhone, onCheckedChange = { rememberPhone = it }, testTag = "login-remember-checkbox")
                Spacer(Modifier.width(8.dp))
                Text("记住手机号", fontSize = VxinTextSize.sm2, color = VxinTextSecondary)
            }
            TextButton(onClick = onNavigateForgotPassword, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                Text("忘记密码?", color = VxinTextSecondary, fontSize = VxinTextSize.sm2)
            }
        }

        if (state.error != null) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = state.error!!,
                color = MaterialTheme.colorScheme.error,
                fontSize = VxinTextSize.sm2,
                modifier = Modifier.fillMaxWidth().testTag("auth-error-text"),
            )
        }

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = viewModel::submit,
            enabled = state.canSubmit && agreed,
            contentPadding = androidx.compose.foundation.layout.PaddingValues(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                disabledContainerColor = Color.Transparent,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("login-submit-btn"),
        ) {
            androidx.compose.foundation.layout.Box(
                Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .clip(RoundedCornerShape(VxinRadius.pill))
                    .background(
                        if (state.canSubmit && agreed) VxinBrand else VxinTextSecondary.copy(alpha = 0.35f)
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (state.loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("登录", color = Color.White, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("还没有账号? ", color = VxinTextSecondary, fontSize = VxinTextSize.sm2)
            TextButton(onClick = onNavigateRegister, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                Text("立即注册", color = VxinBrand, fontSize = VxinTextSize.sm2, fontWeight = FontWeight.Medium)
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            VxinRoundCheckbox(checked = agreed, onCheckedChange = { agreed = it }, testTag = "login-agreement-checkbox")
            Spacer(Modifier.width(8.dp))
            // 《用户协议》《隐私政策》暂无落地页（与 Web 端 Register.jsx 现状一致：占位链接，点击不跳转）
            Text("我已阅读并同意《用户协议》和《隐私政策》", fontSize = VxinTextSize.xs, color = VxinTextSecondary)
        }

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = { showServerConfig = !showServerConfig }) {
            Text("切换服务器", color = VxinTextSecondary, fontSize = VxinTextSize.sm)
        }
        if (showServerConfig) {
            OutlinedTextField(
                value = state.serverUrl,
                onValueChange = viewModel::onServerUrlChange,
                label = { Text("服务器地址") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            TextButton(onClick = { viewModel.saveServerUrl(); showServerConfig = false }) {
                Text("保存", color = VxinBrand)
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}
