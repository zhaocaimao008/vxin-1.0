import SwiftUI

/// V信 品牌标记：黑色圆角方形气泡 + 金色圆环 + 金色 V。
/// 与 Web / Android 登录页使用的同一套扁平化简版标记（100x100 设计画布，等比缩放到
/// 调用方通过 .frame(width:height:) 指定的实际尺寸），用于登录/注册/找回密码页替代 App Icon 图片。
struct VxinLogoMark: View {
    var body: some View {
        GeometryReader { geo in
            let scale = geo.size.width / 100
            let gold = Color(red: 0xFF/255, green: 0xD7/255, blue: 0x00/255)
            ZStack {
                RoundedRectangle(cornerRadius: 22 * scale, style: .continuous)
                    .fill(Color.black)
                Path { path in
                    path.move(to: CGPoint(x: 14 * scale, y: 80 * scale))
                    path.addLine(to: CGPoint(x: 28 * scale, y: 80 * scale))
                    path.addLine(to: CGPoint(x: 12 * scale, y: 96 * scale))
                    path.closeSubpath()
                }
                .fill(Color.black)
                Circle()
                    .strokeBorder(gold.opacity(0.85), lineWidth: 2.5 * scale)
                    .frame(width: 60 * scale, height: 60 * scale)
                    .position(x: 50 * scale, y: 46 * scale)
                Path { path in
                    path.move(to: CGPoint(x: 38.28 * scale, y: 32.23 * scale))
                    path.addLine(to: CGPoint(x: 46.09 * scale, y: 51.77 * scale))
                    path.addLine(to: CGPoint(x: 53.91 * scale, y: 51.77 * scale))
                    path.addLine(to: CGPoint(x: 61.72 * scale, y: 32.23 * scale))
                    path.addLine(to: CGPoint(x: 55.86 * scale, y: 32.23 * scale))
                    path.addLine(to: CGPoint(x: 50 * scale, y: 43.95 * scale))
                    path.addLine(to: CGPoint(x: 44.14 * scale, y: 32.23 * scale))
                    path.closeSubpath()
                }
                .fill(gold)
            }
        }
    }
}
