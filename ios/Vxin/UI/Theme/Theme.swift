import SwiftUI

extension Color {
    // ── v信品牌色 #07C160（统一三端）──────────────────────────────
    static let vxinBrand      = Color(red: 0x07/255, green: 0xC1/255, blue: 0x60/255) // #07C160
    static let vxinBrandLight = Color(red: 0x2B/255, green: 0xB8/255, blue: 0x6E/255) // #2BB86E 浅端
    static let vxinBrandDark  = Color(red: 0x06/255, green: 0xA6/255, blue: 0x52/255) // #06A652 深端/按下态
    static let vxinBrandMuted = Color(red: 0xE8/255, green: 0xF8/255, blue: 0xEF/255) // #E8F8EF 浅底

    /// 兼容旧引用名 → 统一指向品牌绿
    static let vxinGreen      = vxinBrand
    static let vxinTeal       = vxinBrand   // 原青碧辅色已合并为品牌绿

    // ── 气泡 ───────────────────────────────────────────────────────
    static let vxinBubbleMine = vxinBrand   // 我方气泡：品牌绿
    static let vxinBubbleText = Color.white // 气泡内白字

    // ── 语义色 ────────────────────────────────────────────────────
    static let vxinSuccess        = Color(red: 0x00/255, green: 0xB4/255, blue: 0x2A/255)
    static let vxinOnline         = Color(red: 0x44/255, green: 0xC4/255, blue: 0x64/255)
    static let vxinError          = Color(red: 0xFA/255, green: 0x51/255, blue: 0x51/255)
    static let vxinTextSecondary  = Color(red: 0x88/255, green: 0x88/255, blue: 0x88/255)
    static let vxinTextPrimary    = Color(red: 0x22/255, green: 0x22/255, blue: 0x22/255)

    // ── 支付/转账绿 ───────────────────────────────────────────────
    static let vxinPay            = vxinBrand
    static let vxinPayGradStart   = vxinBrandLight
    static let vxinPayGradEnd     = vxinBrand

    // ── 信息横幅 ─────────────────────────────────────────────────
    static let vxinInfoBannerFg   = vxinBrand

    // ── 卡面 ─────────────────────────────────────────────────────
    static let vxinCard           = Color(.secondarySystemBackground)
}

extension LinearGradient {
    /// 我方气泡渐变：浅绿 → 品牌绿（纯净清爽）
    static let vxinBubble = LinearGradient(
        colors: [.vxinBrandLight, .vxinBrand],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// 转账卡片渐变
    static let vxinPay = LinearGradient(
        colors: [.vxinPayGradStart, .vxinPayGradEnd],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}
