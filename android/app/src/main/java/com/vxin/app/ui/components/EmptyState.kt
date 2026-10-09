package com.vxin.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.foundation.shape.RoundedCornerShape
import com.vxin.app.ui.VxinIcons
import com.vxin.app.ui.theme.LocalVxinPalette
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vxin.app.ui.theme.VxinBrand
import com.vxin.app.ui.theme.VxinTextPrimary
import com.vxin.app.ui.theme.VxinTextSecondary

/**
 * 统一空态：emoji 图标置于品牌色圆形柔和徽章内 + 主文案 + 可选副文案。
 * 居中显示，用于列表/结果为空时提升观感与友好度（对齐 Web 空态）。
 */
@Composable
fun EmptyState(
    icon: String,
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    val palette = LocalVxinPalette.current
    val glyph = when (icon) {
        "🔍" -> VxinIcons.Search
        "⭐" -> VxinIcons.Star
        "📞" -> VxinIcons.PhoneCall
        "📷" -> VxinIcons.Moments
        "💻" -> VxinIcons.Devices
        "🏷️" -> VxinIcons.Tag
        "👥", "👋", "📮" -> VxinIcons.Contacts
        "🚫" -> VxinIcons.Shield
        "🧾" -> VxinIcons.Wallet
        else -> VxinIcons.Chat
    }
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // 图标徽章：品牌绿柔和圆底，替代裸 emoji（对齐 Web cl-empty-icon）
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(palette.primaryTint),
            contentAlignment = Alignment.Center,
        ) {
            Icon(glyph, contentDescription = null, tint = palette.link, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(
            title,
            color = palette.text,
            fontSize = com.vxin.app.ui.theme.VxinTextSize.md,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
        subtitle?.let {
            Spacer(Modifier.height(6.dp))
            Text(
                it,
                color = palette.text2,
                fontSize = com.vxin.app.ui.theme.VxinTextSize.sm2,
                textAlign = TextAlign.Center,
            )
        }
    }
}
