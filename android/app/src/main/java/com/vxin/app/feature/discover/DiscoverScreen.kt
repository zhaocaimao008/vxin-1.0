package com.vxin.app.feature.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.vxin.app.data.model.Features
import com.vxin.app.ui.VxinIcons
import com.vxin.app.ui.theme.LocalVxinPalette

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoverScreen(features: Features, onMoments: () -> Unit, onCalls: () -> Unit, onFavorites: () -> Unit) {
    val colors = LocalVxinPalette.current
    Scaffold(containerColor = colors.bg, topBar = { TopAppBar(title = { Text("发现") }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (features.moments) DiscoverRow("朋友圈", "分享生活，记录点滴", VxinIcons.Moments, onMoments)
            DiscoverRow("通话记录", "查看拨打和接听记录", VxinIcons.PhoneCall, onCalls)
            if (features.collect) DiscoverRow("收藏", "保存值得留下的内容", VxinIcons.Star, onFavorites)
        }
    }
}

@Composable
private fun DiscoverRow(title: String, subtitle: String, icon: ImageVector, onClick: () -> Unit) {
    val colors = LocalVxinPalette.current
    ListItem(
        headlineContent = { Text(title) }, supportingContent = { Text(subtitle) },
        leadingContent = { Icon(icon, contentDescription = null, tint = colors.link) },
        trailingContent = { Icon(VxinIcons.ChevronRight, contentDescription = null, tint = colors.text3) },
        colors = ListItemDefaults.colors(containerColor = colors.surface, headlineColor = colors.text, supportingColor = colors.text2),
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(vertical = 6.dp),
    )
}
