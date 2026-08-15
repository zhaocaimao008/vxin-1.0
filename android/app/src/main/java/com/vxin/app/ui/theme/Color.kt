package com.vxin.app.ui.theme

import androidx.compose.ui.graphics.Color

// v信 品牌色（对齐 34 图 UI 规范 / Web 端 --brand-500 #07C160）
val VxinBrand = Color(0xFF07C160)          // 主品牌色 v信绿
val VxinBrandLight = Color(0xFF1CCF71)     // 渐变浅端 / hover
val VxinBrandDark = Color(0xFF06A852)      // 渐变深端 / 按下态
val VxinBrandMuted = Color(0xFFE6F9EF)     // 主色浅底
// 兼容旧引用名（各 Screen 无需改动）
val VxinGreen = VxinBrand
val VxinGreenDark = VxinBrandDark
val VxinTeal = VxinBrand
val VxinBg = Color(0xFFF7F8FA)             // 对齐 web --bg-app #F7F8FA
val VxinTextPrimary = Color(0xFF1F2329)    // 对齐 web --text-primary #1F2329
val VxinTextSecondary = Color(0xFF8A8F98)  // 对齐 web --text-secondary #8A8F98
val VxinError = Color(0xFFFF4D4F)          // 对齐 web --vx-danger #FF4D4F

// 语义色
val VxinSuccess = VxinBrand
val VxinSuccessDark = VxinBrandDark
// 支付/转账
val VxinPay = VxinBrand
val VxinPayDark = VxinBrandDark
val VxinPayGradStart = VxinBrandLight
val VxinPayGradEnd = VxinBrand

// 聊天气泡：我的=浅绿 #CFF3D9；对方=白 + 深字（对齐 web 新气泡色）
val VxinBubbleMine = Color(0xFFCFF3D9)     // 我方气泡：浅绿（对齐 web #CFF3D9）
val VxinBubbleMineText = Color(0xFF1F2329) // 深色文字（浅绿底色下深色字）
val VxinBubbleText = Color(0xFF1F2329)
val VxinBubbleOtherDark = Color(0xFF252830)   // 暗色下对方气泡
val VxinBubbleTextDark = Color(0xFFD8DCE3)    // 暗色下对方气泡文字

// 深色模式
val VxinBgDark = Color(0xFF15171A)            // 对齐 web --vx-bg dark
val VxinSurfaceDark = Color(0xFF202327)       // 对齐 web --vx-surface dark
val VxinTextPrimaryDark = Color(0xFFF2F3F5)   // 对齐 web --vx-text-primary dark
val VxinTextSecondaryDark = Color(0xFFA9AFB7) // 对齐 web --vx-text-secondary dark


// 「我的」页面新增语义色（对齐改版设计 tokens）
val VxinGreen34   = Color(0xFF34B759)   // spec #34B759
val VxinGreenBg   = Color(0xFFEDF8F0)   // spec #EDF8F0
val VxinPageBg    = Color(0xFFF5F5F7)   // spec #F5F5F7
val VxinDivider   = Color(0xFFE9E9EC)   // spec #E9E9EC
val VxinIconGray  = Color(0xFF2C2C2E)   // spec #2C2C2E
val VxinRedLogout = Color(0xFFFF3B30)   // spec #FF3B30
