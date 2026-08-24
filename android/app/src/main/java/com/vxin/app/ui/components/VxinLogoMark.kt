package com.vxin.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke

/**
 * V信 品牌标记：黑色圆角方形气泡 + 金色圆环 + 金色 V。
 * 与 Web 登录页 / iOS 登录页使用的同一套扁平化简版标记（100x100 设计画布，等比缩放），
 * 不含渐变/滤镜，任意尺寸下清晰可读，用于登录/注册/找回密码页替代 App Icon 图片。
 */
@Composable
fun VxinLogoMark(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val scale = size.width / 100f
        drawRoundRect(
            color = Color.Black,
            size = Size(size.width, size.height),
            cornerRadius = CornerRadius(22f * scale, 22f * scale),
        )
        val tail = Path().apply {
            moveTo(14f * scale, 80f * scale)
            lineTo(28f * scale, 80f * scale)
            lineTo(12f * scale, 96f * scale)
            close()
        }
        drawPath(tail, color = Color.Black)
        drawCircle(
            color = Color(0xFFFFD700),
            radius = 30f * scale,
            center = Offset(50f * scale, 46f * scale),
            style = Stroke(width = 2.5f * scale),
            alpha = 0.85f,
        )
        val v = Path().apply {
            moveTo(38.28f * scale, 32.23f * scale)
            lineTo(46.09f * scale, 51.77f * scale)
            lineTo(53.91f * scale, 51.77f * scale)
            lineTo(61.72f * scale, 32.23f * scale)
            lineTo(55.86f * scale, 32.23f * scale)
            lineTo(50f * scale, 43.95f * scale)
            lineTo(44.14f * scale, 32.23f * scale)
            close()
        }
        drawPath(v, color = Color(0xFFFFD700))
    }
}
