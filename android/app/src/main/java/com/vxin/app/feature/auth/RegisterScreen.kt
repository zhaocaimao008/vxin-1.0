package com.vxin.app.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vxin.app.ui.VxinIcons
import com.vxin.app.ui.components.VxinAuthField
import com.vxin.app.ui.components.VxinLogoMark
import com.vxin.app.ui.components.VxinPasswordField
import com.vxin.app.ui.components.VxinRoundCheckbox
import com.vxin.app.ui.theme.VxinAuthBg
import com.vxin.app.ui.theme.VxinAuthBorder
import com.vxin.app.ui.theme.VxinAuthGold
import com.vxin.app.ui.theme.VxinAuthPlaceholder
import com.vxin.app.ui.theme.VxinAuthSurface
import com.vxin.app.ui.theme.VxinAuthTextSecondary
import com.vxin.app.ui.theme.VxinRadius
import com.vxin.app.ui.theme.VxinTextSize

@Composable
fun RegisterScreen(
    onBack: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var passwordVisible by remember { mutableStateOf(false) }
    var agreed by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(VxinAuthBg)
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 32.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))
        // 品牌 Logo：黑金标记（与 Web/iOS 登录页同一套扁平化简版标记，2026-08-24 四端品牌统一）
        VxinLogoMark(modifier = Modifier.size(68.dp))
        Spacer(Modifier.height(14.dp))
        Text("v信", fontSize = VxinTextSize.displaySm, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(Modifier.height(4.dp))
        Text("注册新账号", fontSize = VxinTextSize.lg, fontWeight = FontWeight.SemiBold, color = Color.White)
        Spacer(Modifier.height(6.dp))
        Text("连接 · 沟通 · 未来", fontSize = VxinTextSize.sm2, color = VxinAuthTextSecondary)
        Spacer(Modifier.height(24.dp))

        // 昵称：参考图未展示此字段，但后端 register() 强制要求 username，移除会导致注册失败——
        // 优先级「不破坏业务」高于「贴合参考图」，因此保留。
        VxinAuthField(
            icon = VxinIcons.Person,
            value = state.username,
            onValueChange = viewModel::onUsernameChange,
            placeholder = "请输入昵称",
            testTag = "register-username-input",
        )
        VxinAuthField(
            icon = VxinIcons.Phone,
            value = state.phone,
            onValueChange = viewModel::onPhoneChange,
            placeholder = "请输入手机号",
            keyboardType = KeyboardType.Phone,
            testTag = "register-phone-input",
            trailing = { Text("+86", color = VxinAuthTextSecondary, fontSize = VxinTextSize.base) },
        )
        // 参考图中的「验证码 / 获取验证码」字段：后端当前没有注册短信验证码能力（无 sendCode 接口），
        // 属于「参考图有、后端无」的情况，按规范不伪造，故不实现该字段。
        VxinPasswordField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            placeholder = "请输入密码（至少8位，含字母和数字）",
            visible = passwordVisible,
            onVisibleChange = { passwordVisible = it },
            testTag = "register-password-input",
        )
        // 后台关闭「注册需邀请码」后隐藏邀请码输入框（四端一致）；重新开启后恢复
        if (state.inviteRequired) {
            VxinAuthField(
                icon = VxinIcons.Ticket,
                value = state.inviteCode,
                onValueChange = viewModel::onInviteCodeChange,
                placeholder = "请输入邀请码",
                keyboardType = KeyboardType.Number,
                testTag = "register-invite-input",
            )
        }

        if (state.error != null) {
            Spacer(Modifier.height(12.dp))
            Text(state.error!!, color = MaterialTheme.colorScheme.error, fontSize = VxinTextSize.sm2)
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
                .testTag("register-submit-btn"),
        ) {
            val submitEnabled = state.canSubmit && agreed
            androidx.compose.foundation.layout.Box(
                Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .clip(RoundedCornerShape(VxinRadius.pill))
                    .background(VxinAuthSurface)
                    .border(
                        width = 1.5.dp,
                        color = if (submitEnabled) VxinAuthGold else VxinAuthBorder,
                        shape = RoundedCornerShape(VxinRadius.pill),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (state.loading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = VxinAuthGold, strokeWidth = 2.dp)
                } else {
                    Text("注册", color = if (submitEnabled) VxinAuthGold else VxinAuthPlaceholder, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("已有账号? ", color = VxinAuthTextSecondary, fontSize = VxinTextSize.sm2)
            TextButton(onClick = onBack, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                Text("去登录", color = VxinAuthGold, fontSize = VxinTextSize.sm2, fontWeight = FontWeight.Medium)
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            VxinRoundCheckbox(checked = agreed, onCheckedChange = { agreed = it }, testTag = "register-agreement-checkbox")
            Spacer(Modifier.width(8.dp))
            Text("我已阅读并同意《用户协议》和《隐私政策》", fontSize = VxinTextSize.xs, color = VxinAuthTextSecondary)
        }
        Spacer(Modifier.height(16.dp))
    }
}
