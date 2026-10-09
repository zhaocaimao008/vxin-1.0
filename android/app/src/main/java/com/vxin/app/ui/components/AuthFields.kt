package com.vxin.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import com.vxin.app.ui.theme.LocalVxinPalette
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.semantics.Role
import androidx.compose.material3.IconButton
import androidx.compose.foundation.layout.width
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
import com.vxin.app.ui.theme.VxinAuthBorder
import com.vxin.app.ui.theme.VxinAuthGold
import com.vxin.app.ui.theme.VxinAuthPlaceholder
import com.vxin.app.ui.theme.VxinAuthTextMuted
import com.vxin.app.ui.theme.VxinTextSize

/**
 * 认证页通用输入框：共享表面、圆角、聚焦边框。
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
    val palette = LocalVxinPalette.current
    var focused by remember { mutableStateOf(false) }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
            .height(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(palette.surface)
            .border(1.dp, if (focused) palette.primary else palette.border, RoundedCornerShape(12.dp))
            .padding(start = 14.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = VxinAuthTextMuted, modifier = Modifier.size(20.dp))
        Box(Modifier.padding(start = 10.dp).weight(1f)) {
            if (value.isEmpty()) {
                Text(placeholder, color = VxinAuthPlaceholder, fontSize = VxinTextSize.base)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = LocalTextStyle.current.copy(fontSize = VxinTextSize.base, color = palette.text),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                visualTransformation = visualTransformation,
                cursorBrush = androidx.compose.ui.graphics.SolidColor(VxinAuthGold),
                modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused }.testTag(testTag),
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
            IconButton(onClick = { onVisibleChange(!visible) }, modifier = Modifier.size(44.dp)) {
                Icon(if (visible) VxinIcons.Eye else VxinIcons.EyeOff,
                    contentDescription = if (visible) "隐藏密码" else "显示密码",
                    tint = VxinAuthTextMuted, modifier = Modifier.size(20.dp))
            }
        },
    )
}

/** 圆形勾选框：共享主色，44dp 触摸区域。 */
@Composable
fun VxinRoundCheckbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "",
) {
    val palette = LocalVxinPalette.current
    Box(modifier = modifier.size(44.dp).toggleable(value = checked, role = Role.Checkbox, onValueChange = onCheckedChange).testTag(testTag), contentAlignment = Alignment.Center) {
        Box(Modifier.size(18.dp).clip(CircleShape).background(if (checked) palette.primary else Color.Transparent)
            .border(1.5.dp, if (checked) palette.primary else palette.text3, CircleShape), contentAlignment = Alignment.Center) {
            if (checked) Icon(VxinIcons.Check, contentDescription = null, tint = palette.onPrimary, modifier = Modifier.size(11.dp))
        }
    }
}
