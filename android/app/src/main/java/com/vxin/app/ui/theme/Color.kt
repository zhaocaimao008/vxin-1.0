package com.vxin.app.ui.theme

import androidx.compose.ui.graphics.Color

// v信 品牌色（对齐 Web 端 --brand-500 #07C160）
val VxinBrand = Color(0xFF07C160)          // 主品牌色 v信绿（brand-500）
val VxinBrandLight = Color(0xFF2BB86E)     // brand-400 渐变浅端
val VxinBrandDark = Color(0xFF06A652)      // brand-600 渐变深端 / 按下态
val VxinBrandMuted = Color(0xFFE8F8EF)     // brand-50 主色浅底
// 兼容旧引用名（各 Screen 无需改动）：统一指向 v信绿
val VxinGreen = VxinBrand
val VxinGreenDark = VxinBrandDark
val VxinBg = Color(0xFFF5F5F5)             // 辅助浅灰，对齐 web #F5F5F5
val VxinTextPrimary = Color(0xFF1A1A1A)    // 正文近黑，对齐 web --text-primary
val VxinTextSecondary = Color(0xFF888888)  // 辅助中性灰，对齐 web --text-secondary
val VxinError = Color(0xFFFA5151)

// 语义色
val VxinSuccess = Color(0xFF00B42A)        // 成功/正向
val VxinSuccessDark = Color(0xFF059C4B)    // 成功按下态
// 支付/转账金钱主题（对齐 v信绿主色）
val VxinPay = Color(0xFF07C160)
val VxinPayDark = Color(0xFF06A652)
val VxinPayGradStart = Color(0xFF2BB86E)   // 渐变起端（浅绿）
val VxinPayGradEnd = Color(0xFF07C160)     // 渐变终端

// 聊天气泡：我的=v信绿 + 白字；对方=白 + 深字
val VxinBubbleMine = VxinBrand             // 我方气泡主色
val VxinBubbleMineText = Color(0xFFFFFFFF) // 白字，对比度充足（WCAG AA）
val VxinBubbleText = Color(0xFF1A1A1A)
val VxinBubbleOtherDark = Color(0xFF26262A)   // 暗色下对方气泡
val VxinBubbleTextDark = Color(0xFFE5E5E5)    // 暗色下对方气泡文字

// 深色模式壳层（v信黑 #111111）
val VxinBgDark = Color(0xFF111111)            // 深色背景
val VxinSurfaceDark = Color(0xFF1E1E1E)       // 深色卡面/顶栏
val VxinTextPrimaryDark = Color(0xFFE5E5E5)   // 深色正文
val VxinTextSecondaryDark = Color(0xFF9A9A9A) // 深色辅助文字
