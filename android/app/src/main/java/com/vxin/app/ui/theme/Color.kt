package com.vxin.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable

// Compatibility constants for non-composable code. UI uses LocalVxinPalette.
val VxinBrand = VxinLightPalette.primary
val VxinBrandLight = VxinLightPalette.primaryHover
val VxinBrandDark = VxinLightPalette.primaryActive
val VxinBrandMuted = VxinLightPalette.primaryTint
val VxinGreen = VxinLightPalette.primary
val VxinGreenDark = VxinLightPalette.primaryActive
val VxinTeal = VxinLightPalette.primary
val VxinBg = VxinLightPalette.bg
val VxinTextPrimary = VxinLightPalette.text
val VxinTextSecondary = VxinLightPalette.text2
val VxinError = VxinLightPalette.danger
val VxinSuccess = VxinLightPalette.online
val VxinSuccessDark = VxinLightPalette.primaryActive
val VxinPay = VxinLightPalette.primary
val VxinPayDark = VxinLightPalette.primaryActive
val VxinPayGradStart = VxinLightPalette.primary
val VxinPayGradEnd = VxinLightPalette.primary
val VxinBubbleMine = VxinLightPalette.bubbleMine
val VxinBubbleMineText = VxinLightPalette.bubbleMineText
val VxinBubbleText = VxinLightPalette.text
val VxinGreen34 = VxinLightPalette.primary
val VxinGreenBg = VxinLightPalette.primaryTint
val VxinPageBg = VxinLightPalette.bg
val VxinDivider = VxinLightPalette.border
val VxinIconGray = VxinLightPalette.text2
val VxinRedLogout = VxinLightPalette.danger
val VxinBubbleOtherDark = VxinDarkPalette.bubbleOther
val VxinBubbleTextDark = VxinDarkPalette.text
val VxinBgDark = VxinDarkPalette.bg
val VxinSurfaceDark = VxinDarkPalette.surface
val VxinTextPrimaryDark = VxinDarkPalette.text
val VxinTextSecondaryDark = VxinDarkPalette.text2
val VxinAuthBg: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.bg
val VxinAuthSurface: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.surface
val VxinAuthGold: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.link
val VxinAuthGoldHover: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.primaryHover
val VxinAuthBorder: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.border
val VxinAuthTextSecondary: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.text2
val VxinAuthTextMuted: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.text2
val VxinAuthPlaceholder: Color
    @Composable @ReadOnlyComposable get() = LocalVxinPalette.current.text3
