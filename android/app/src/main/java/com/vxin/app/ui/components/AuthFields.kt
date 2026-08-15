package com.vxin.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.vxin.app.ui.VxinIcons
import com.vxin.app.ui.theme.VxinBrand
import com.vxin.app.ui.theme.VxinDivider
import com.vxin.app.ui.theme.VxinTextPrimary
import com.vxin.app.ui.theme.VxinTextSecondary
import com.vxin.app.ui.theme.VxinTextSize

/**
 * 认证页通用下划线输入行（图标 + 输入 + 可选尾部内容），对齐 34 图参考的 WeChat 风格表单。
 */
@Composable
fun VxinAuthField(
    icon: ImageVector,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    testTag: String = "",
    trailing: @Composable (() -> Unit)? = null,
) {
    val dividerColor = VxinDivider
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .drawBehind {
                drawLine(
                    color = dividerColor,
                    start = Offset(0f, size.height),
                    end = Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = VxinTextSecondary, modifier = Modifier.size(20.dp))
        Box(Modifier.padding(start = 10.dp).weight(1f)) {
            if (value.isEmpty()) {
                Text(placeholder, color = VxinTextSecondary, fontSize = VxinTextSize.base)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = LocalTextStyle.current.copy(fontSize = VxinTextSize.base, color = VxinTextPrimary),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                visualTransformation = visualTransformation,
                cursorBrush = androidx.compose.ui.graphics.SolidColor(VxinBrand),
                modifier = Modifier.fillMaxWidth().testTag(testTag),
            )
        }
        if (trailing != null) trailing()
    }
}

/** 密码输入行：内置显示/隐藏切换（眼睛图标）。 */
@Composable
fun VxinPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    visible: Boolean,
    onVisibleChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "",
) {
    VxinAuthField(
        icon = VxinIcons.Lock,
        value = value,
        onValueChange = onValueChange,
        placeholder = placeholder,
        modifier = modifier,
        keyboardType = KeyboardType.Password,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        testTag = testTag,
        trailing = {
            Icon(
                if (visible) VxinIcons.Eye else VxinIcons.EyeOff,
                contentDescription = if (visible) "隐藏密码" else "显示密码",
                tint = VxinTextSecondary,
                modifier = Modifier
                    .size(20.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { onVisibleChange(!visible) },
            )
        },
    )
}

/** 圆形勾选框：绿色实心 + 白色对勾（选中）/ 描边空心（未选中）。 */
@Composable
fun VxinRoundCheckbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "",
) {
    Box(
        modifier = modifier
            .size(18.dp)
            .clip(CircleShape)
            .then(
                if (checked) Modifier.background(VxinBrand)
                else Modifier.border(width = 1.5.dp, color = VxinTextSecondary.copy(alpha = 0.5f), shape = CircleShape)
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) { onCheckedChange(!checked) }
            .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        if (checked) {
            Icon(VxinIcons.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(11.dp))
        }
    }
}
