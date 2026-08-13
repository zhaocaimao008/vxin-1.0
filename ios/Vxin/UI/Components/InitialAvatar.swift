import SwiftUI

/// 文字首字母头像（无头像占位，对齐 Android InitialAvatar），避免引入图片库
struct InitialAvatar: View {
    let name: String
    var size: CGFloat = 48

    // 字母头像配色：v信品牌绿为首色，多彩辅色（对齐 Web Avatar COLORS / Android InitialAvatar）
    private static let palette: [Color] = [
        Color(red: 0x07/255, green: 0xC1/255, blue: 0x60/255), // v信绿(主) #07C160
        Color(red: 0x17/255, green: 0xB8/255, blue: 0xA6/255), // 青碧(辅)
        Color(red: 0x5B/255, green: 0x7B/255, blue: 0xF0/255), // 靛蓝
        Color(red: 0x2B/255, green: 0xB8/255, blue: 0x6E/255), // 浅绿(辅)
        Color(red: 0xF0/255, green: 0xA0/255, blue: 0x20/255), // 琥珀
        Color(red: 0xFF/255, green: 0x7A/255, blue: 0x93/255), // 珊瑚粉
        Color(red: 0x13/255, green: 0xC2/255, blue: 0xC2/255), // 青
        Color(red: 0x06/255, green: 0xA6/255, blue: 0x52/255), // 深绿
        Color(red: 0xE8/255, green: 0x61/255, blue: 0x9D/255), // 品红
        Color(red: 0x38/255, green: 0xC0/255, blue: 0xA8/255), // 薄荷
    ]

    private var letter: String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard let first = trimmed.first else { return "?" }
        return String(first).uppercased()
    }

    private var color: Color {
        Self.palette[abs(name.hashValue) % Self.palette.count]
    }

    var body: some View {
        RoundedRectangle(cornerRadius: size / 6)
            .fill(color)
            .frame(width: size, height: size)
            .overlay(
                Text(letter)
                    .foregroundColor(.white)
                    .font(.system(size: size * 0.42, weight: .semibold))
            )
    }
}
