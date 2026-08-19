package com.vxin.app.feature.profile

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.ripple.rememberRipple
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.vxin.app.feature.update.UpdateCheckDialog
import com.vxin.app.feature.update.UpdateViewModel
import com.vxin.app.ui.VxinIcons
import com.vxin.app.ui.components.InitialAvatar
import com.vxin.app.ui.theme.*

// ── Design tokens ─────────────────────────────────────────────────────────────

private object Tok {
    // spacing
    val XS = 4.dp;  val S = 8.dp;  val M = 12.dp
    val L = 16.dp;  val XL = 20.dp; val XXL = 24.dp
    // colours（对齐全局品牌色 VxinBrand #07C160，不再各屏自定义一套绿）
    val Green     = VxinBrand
    val GreenBg   = VxinBrandMuted
    val Bg        = Color(0xFFF5F5F7)
    val Primary   = Color(0xFF111111)
    val Secondary = Color(0xFF8E8E93)
    val Divider   = Color(0xFFE9E9EC)
    val CardBg    = Color.White
    val IconGray  = Color(0xFF2C2C2E)
    val Red       = Color(0xFFFF3B30)
    // shape
    val cardRadius = 16.dp
    val avatarRadius = 14.dp
    // sizes
    val avatarSize = 66.dp
    val iconSize = 22.dp
    val rowHeight = 56.dp
}

// ── Shared components ──────────────────────────────────────────────────────────

@Composable
private fun VxCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Tok.cardRadius))
            .background(Tok.CardBg)
            .border(0.5.dp, Tok.Divider, RoundedCornerShape(Tok.cardRadius)),
        content = content,
    )
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text,
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = Tok.XL, top = Tok.XL, bottom = Tok.S),
        color = Tok.Secondary,
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
    )
}

@Composable
private fun RowDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(start = Tok.L + Tok.XXL + Tok.M),
        thickness = 0.5.dp,
        color = Tok.Divider,
    )
}

@Composable
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    trailing: String? = null,
    iconColor: Color = Tok.IconGray,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(Tok.rowHeight)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = rememberRipple(bounded = true),
                onClick = onClick,
            )
            .padding(horizontal = Tok.L),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(Tok.XXL), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = title, tint = iconColor, modifier = Modifier.size(Tok.iconSize))
        }
        Spacer(Modifier.width(Tok.M))
        Text(
            text = title,
            modifier = Modifier.weight(1f),
            fontSize = 16.5.sp,
            color = Tok.Primary,
        )
        if (trailing != null) {
            Text(
                text = trailing,
                fontSize = 15.sp,
                color = Tok.Secondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(end = Tok.S),
            )
        }
        Icon(
            VxinIcons.ChevronRight,
            contentDescription = null,
            tint = Tok.Secondary.copy(alpha = 0.6f),
            modifier = Modifier.size(16.dp),
        )
    }
}

// ── ProfileScreen ──────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onAddAccount: () -> Unit = {},
    onOpenMyQr: () -> Unit = {},
    onOpenCallHistory: () -> Unit = {},
    onOpenWallet: () -> Unit = {},
    onOpenSessions: () -> Unit = {},
    onOpenInviteFriend: () -> Unit = {},
    onOpenFavorites: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenProfileEdit: () -> Unit = {},
    collectEnabled: Boolean = true, // 后台「收藏」开关，四端一致
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val user = state.user
    LaunchedEffect(Unit) { viewModel.refreshAccounts() }
    androidx.lifecycle.compose.LifecycleResumeEffect(Unit) {
        viewModel.refreshUser()
        onPauseOrDispose { }
    }

    // update
    val updateViewModel: UpdateViewModel = hiltViewModel()
    val updateState by updateViewModel.uiState.collectAsStateWithLifecycle()
    val silentResult by updateViewModel.silentResult.collectAsStateWithLifecycle()
    var showUpdateDialog by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { updateViewModel.silentCheck() }
    LaunchedEffect(silentResult) {
        if (silentResult is com.vxin.app.feature.update.SilentCheckResult.HasUpdate) {
            showUpdateDialog = true; updateViewModel.openDialog()
        }
    }

    var showChangePhoneDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showSwitchAccount by remember { mutableStateOf(false) }
    var versionTaps by remember { mutableStateOf(0) }
    var showBuild by remember { mutableStateOf(false) }

    fun maskedPhone(phone: String?): String {
        if (phone.isNullOrBlank()) return "未绑定"
        return if (phone.length >= 7) "${phone.take(3)}****${phone.takeLast(4)}" else phone
    }

    Scaffold(
        containerColor = Tok.Bg,
        topBar = {},   // no top bar — page has no title per spec
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {

            // ── 1. Profile header card ────────────────────────────────────────
            Box(Modifier.padding(horizontal = Tok.L, vertical = Tok.XXL)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Tok.cardRadius))
                        .background(Tok.CardBg)
                        .border(0.5.dp, Tok.Divider, RoundedCornerShape(Tok.cardRadius))
                        .clickable(onClick = onOpenProfileEdit)
                        .padding(Tok.L),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // avatar
                    val avatarUrl = viewModel.resolveAvatarUrl(user?.avatar)
                    if (!user?.avatar.isNullOrBlank()) {
                        AsyncImage(
                            model = avatarUrl,
                            contentDescription = "头像",
                            modifier = Modifier
                                .size(Tok.avatarSize)
                                .clip(RoundedCornerShape(Tok.avatarRadius)),
                        )
                    } else {
                        InitialAvatar(
                            name = user?.username ?: "?",
                            size = Tok.avatarSize,
                        )
                    }
                    if (state.uploadingAvatar) {
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Tok.Green)
                    }
                    Spacer(Modifier.width(Tok.M))
                    // name + id
                    Column(Modifier.weight(1f)) {
                        Text(
                            user?.username?.ifBlank { "未设置昵称" } ?: "未登录",
                            fontSize = 21.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Tok.Primary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        user?.wechat_id?.takeIf { it.isNotBlank() }?.let {
                            Spacer(Modifier.height(Tok.XS))
                            Text("V信号：$it", fontSize = 14.sp, color = Tok.Secondary, maxLines = 1)
                        }
                    }
                    // QR — independent click
                    IconButton(
                        onClick = onOpenMyQr,
                        modifier = Modifier.testTag("profile-my-qr"),
                    ) {
                        Icon(VxinIcons.QrCode, contentDescription = "我的二维码", tint = Tok.Green, modifier = Modifier.size(22.dp))
                    }
                    Icon(VxinIcons.ChevronRight, contentDescription = null, tint = Tok.Secondary.copy(alpha = 0.6f), modifier = Modifier.size(16.dp))
                }
            }

            // ── 2. 账户与服务 ──────────────────────────────────────────────────
            SectionHeader("账户与服务")
            VxCard(Modifier.padding(horizontal = Tok.L).padding(bottom = Tok.M)) {
                SettingsRow(VxinIcons.Phone, "手机号", trailing = maskedPhone(user?.phone), onClick = { showChangePhoneDialog = true })
                RowDivider()
                SettingsRow(VxinIcons.Wallet, "我的钱包", onClick = onOpenWallet)
                RowDivider()
                // 收藏：后台开关关闭即隐藏（四端一致）
                if (collectEnabled) {
                    SettingsRow(VxinIcons.Star, "收藏", onClick = onOpenFavorites)
                    RowDivider()
                }
                SettingsRow(VxinIcons.PhoneCall, "通话记录", onClick = onOpenCallHistory)
                RowDivider()
                SettingsRow(VxinIcons.Devices, "登录设备管理", onClick = onOpenSessions)
            }

            // ── 3. 设置（消息通知/隐私与安全/外观/登录设备/清除缓存等收拢进独立设置页）──
            VxCard(Modifier.padding(horizontal = Tok.L).padding(top = Tok.M).padding(bottom = Tok.M)) {
                SettingsRow(VxinIcons.Gear, "设置", onClick = onOpenSettings)
            }

            // ── 4. 其他 ──────────────────────────────────────────────────────
            SectionHeader("其他")
            VxCard(Modifier.padding(horizontal = Tok.L).padding(bottom = Tok.M)) {
                SettingsRow(VxinIcons.UserPlus, "邀请好友", onClick = onOpenInviteFriend)
                RowDivider()
                val switchTrailing = "${user?.username?.ifBlank { "当前" } ?: "当前"} · 当前"
                SettingsRow(VxinIcons.Users, "切换账号", trailing = switchTrailing, onClick = { showSwitchAccount = true })
            }

            // ── 5. 退出登录 ───────────────────────────────────────────────────
            VxCard(Modifier.padding(horizontal = Tok.L).padding(bottom = Tok.M)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = rememberRipple(bounded = true),
                        ) { showLogoutDialog = true },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("退出登录", color = Tok.Red, fontSize = 16.5.sp)
                }
            }

            // ── 6. 版本号 ─────────────────────────────────────────────────────
            Text(
                text = if (showBuild)
                    "V信 ${com.vxin.app.BuildConfig.VERSION_NAME} (${com.vxin.app.BuildConfig.VERSION_CODE})"
                else
                    "V信 ${com.vxin.app.BuildConfig.VERSION_NAME}",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Tok.XXL)
                    .clickable {
                        versionTaps++
                        if (versionTaps >= 5) showBuild = true
                    },
                fontSize = 13.sp,
                color = Tok.Secondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }

    // ── Dialogs ───────────────────────────────────────────────────────────────

    if (showUpdateDialog) {
        UpdateCheckDialog(viewModel = updateViewModel, onDismiss = { showUpdateDialog = false })
    }

    if (showChangePhoneDialog) {
        ChangePhoneDialog(
            currentPhone = user?.phone.orEmpty(),
            changing = state.changingPhone,
            onConfirm = { newPhone, password -> viewModel.changePhone(newPhone, password); showChangePhoneDialog = false },
            onDismiss = { showChangePhoneDialog = false },
        )
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("退出登录") },
            text = { Text("确认退出当前账号？") },
            confirmButton = {
                TextButton(onClick = { showLogoutDialog = false; viewModel.logout() }) {
                    Text("退出", color = Tok.Red)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("取消") }
            },
        )
    }

    if (showSwitchAccount) {
        AccountSwitchSheet(
            accounts = accounts,
            activeId = viewModel.activeAccountId,
            onSwitch = { id -> viewModel.switchAccount(id); showSwitchAccount = false },
            onRemove = { id -> viewModel.removeAccount(id) },
            onAddAccount = { showSwitchAccount = false; onAddAccount() },
            onDismiss = { showSwitchAccount = false },
        )
    }
}

// ── Account switch bottom sheet ────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccountSwitchSheet(
    accounts: List<com.vxin.app.data.model.Account>,
    activeId: String?,
    onSwitch: (String) -> Unit,
    onRemove: (String) -> Unit,
    onAddAccount: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color.White) {
        Text(
            "切换账号",
            Modifier.fillMaxWidth().padding(horizontal = Tok.L, vertical = Tok.M),
            fontWeight = FontWeight.SemiBold,
            fontSize = 17.sp,
        )
        HorizontalDivider(color = Tok.Divider, thickness = 0.5.dp)
        accounts.forEach { acc ->
            val isCurrent = acc.id == activeId
            Row(
                Modifier.fillMaxWidth()
                    .height(Tok.rowHeight)
                    .clickable(enabled = !isCurrent) { onSwitch(acc.id) }
                    .padding(horizontal = Tok.L),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                InitialAvatar(name = acc.username.ifBlank { "?" }, size = 40.dp)
                Spacer(Modifier.width(Tok.M))
                Column(Modifier.weight(1f)) {
                    Text(
                        acc.username.ifBlank { "未命名" },
                        fontSize = 15.sp,
                        color = Tok.Primary,
                        maxLines = 1,
                    )
                }
                if (isCurrent) {
                    Text(
                        "当前",
                        fontSize = 13.sp,
                        color = Tok.Green,
                        modifier = Modifier
                            .background(Tok.GreenBg, RoundedCornerShape(50))
                            .padding(horizontal = Tok.S, vertical = Tok.XS),
                    )
                } else {
                    TextButton(onClick = { onRemove(acc.id) }) {
                        Text("移除", color = Tok.Red, fontSize = 14.sp)
                    }
                }
            }
            HorizontalDivider(Modifier.padding(start = Tok.L + 40.dp + Tok.M), color = Tok.Divider, thickness = 0.5.dp)
        }
        // Add account row
        Row(
            Modifier.fillMaxWidth()
                .height(Tok.rowHeight)
                .clickable { onAddAccount() }
                .padding(horizontal = Tok.L),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                Icon(VxinIcons.Add, contentDescription = null, tint = Tok.Green)
            }
            Spacer(Modifier.width(Tok.M))
            Text("添加账号", fontSize = 15.sp, color = Tok.Green)
        }
        Spacer(Modifier.height(Tok.XXL))
    }
}

// ── ChangePhoneDialog (unchanged logic, refreshed layout) ─────────────────────

@Composable
fun ChangePhoneDialog(
    currentPhone: String,
    changing: Boolean,
    onConfirm: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    var newPhone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    val valid = newPhone.trim().length >= 6 && password.isNotBlank()

    AlertDialog(
        onDismissRequest = { if (!changing) onDismiss() },
        title = { Text("换绑手机号") },
        text = {
            Column {
                if (currentPhone.isNotBlank()) {
                    Text("当前：$currentPhone", color = Tok.Secondary, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.size(Tok.S))
                }
                OutlinedTextField(
                    value = newPhone,
                    onValueChange = { newPhone = it.filter { c -> c.isDigit() || c == '+' }.take(16) },
                    label = { Text("新手机号") }, singleLine = true,
                    enabled = !changing, modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.size(Tok.S))
                OutlinedTextField(
                    value = password, onValueChange = { password = it },
                    label = { Text("登录密码") }, singleLine = true, enabled = !changing,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        TextButton(onClick = { showPassword = !showPassword }) {
                            Text(if (showPassword) "隐藏" else "显示", style = MaterialTheme.typography.bodySmall)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(newPhone.trim(), password) }, enabled = valid && !changing) {
                if (changing) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("确认换绑", color = Tok.Green)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !changing) { Text("取消") } },
    )
}
