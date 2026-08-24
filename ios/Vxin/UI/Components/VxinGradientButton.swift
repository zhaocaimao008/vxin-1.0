import SwiftUI

/// v信 找回密码页主按钮：黑底金字描边（对齐 Web .auth-submit / Android AuthGoldButton）。
/// 仅供 ForgotPasswordView 使用（App 内其余按钮各自有独立样式，未共用本组件）。
struct VxinGradientButton: View {
    let title: String
    var loading: Bool = false
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if loading { ProgressView().tint(.vxinAuthGold) }
                else { Text(title).bold() }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Color.vxinAuthSurface)
            .foregroundColor(enabled ? .vxinAuthGold : .vxinAuthPlaceholder)
            .clipShape(RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous)
                    .strokeBorder(enabled ? Color.vxinAuthGold : Color.vxinAuthBorder, lineWidth: 1.5)
            )
            .shadow(color: enabled ? Color.vxinAuthGold.opacity(0.18) : .clear, radius: 8, y: 4)
        }
        .disabled(!enabled || loading)
    }
}
