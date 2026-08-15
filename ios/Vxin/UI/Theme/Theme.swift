import SwiftUI

extension Color {
    // ── v信品牌色 #16C55B（对齐 Web 端 --brand-500）──────────────────────
    static let vxinBrand      = Color(red: 0x16/255, green: 0xC5/255, blue: 0x5B/255) // #16C55B
    static let vxinBrandLight = Color(red: 0x13/255, green: 0xB5/255, blue: 0x52/255) // #13B552 hover
    static let vxinBrandDark  = Color(red: 0x10/255, green: 0xA6/255, blue: 0x4A/255) // #10A64A 按下态
    static let vxinBrandMuted = Color(red: 0xEA/255, green: 0xF8/255, blue: 0xEF/255) // #EAF8EF 浅底

    /// 兼容旧引用名
    static let vxinGreen = vxinBrand
    static let vxinTeal  = vxinBrand

    // ── 气泡（对齐 Web 端新气泡色）────────────────────────────────────────
    static let vxinBubbleMine = Color(red: 0xCF/255, green: 0xF3/255, blue: 0xD9/255) // #CFF3D9 浅绿
    static let vxinBubbleText = Color(red: 0x1F/255, green: 0x23/255, blue: 0x29/255) // 深色文字

    // ── 语义色 ────────────────────────────────────────────────────────────
    static let vxinSuccess       = Color(red: 0x16/255, green: 0xC5/255, blue: 0x5B/255)
    static let vxinOnline        = Color(red: 0x16/255, green: 0xC5/255, blue: 0x5B/255)
    static let vxinError         = Color(red: 0xFF/255, green: 0x4D/255, blue: 0x4F/255) // #FF4D4F
    static let vxinTextSecondary = Color(red: 0x8A/255, green: 0x8F/255, blue: 0x98/255) // #8A8F98
    static let vxinTextPrimary   = Color(red: 0x1F/255, green: 0x23/255, blue: 0x29/255) // #1F2329

    // ── 支付/转账 ────────────────────────────────────────────────────────
    static let vxinPay          = vxinBrand
    static let vxinPayGradStart = vxinBrandLight
    static let vxinPayGradEnd   = vxinBrand

    // ── 信息横幅 ─────────────────────────────────────────────────────────
    static let vxinInfoBannerFg = vxinBrand

    // ── 卡面 ─────────────────────────────────────────────────────────────
    static let vxinCard = Color(.secondarySystemBackground)
}

extension LinearGradient {
    /// 品牌渐变（按钮、图标背景等）
    static let vxinBrand = LinearGradient(
        colors: [.vxinBrandLight, .vxinBrandDark],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// 我方气泡：纯浅绿色（不再用渐变，对齐 web #CFF3D9）
    static let vxinBubble = LinearGradient(
        colors: [.vxinBubbleMine, .vxinBubbleMine],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// 转账卡片渐变
    static let vxinPay = LinearGradient(
        colors: [.vxinPayGradStart, .vxinPayGradEnd],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}

