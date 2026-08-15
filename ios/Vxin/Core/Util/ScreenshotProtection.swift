import UIKit
import SwiftUI

/// I17: iOS 截图防护（阅后即焚会话专用）
extension View {
    /// 在 SwiftUI View 上应用截图防护
    /// enabled=true 时截图/屏幕录制呈现空白
    func screenshotProtected(_ enabled: Bool = true) -> some View {
        overlay(Group { if enabled { _SecureOverlay() } })
    }
}

/// 利用 UITextField(isSecureTextEntry) 系统级防护机制
private struct _SecureOverlay: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let f = UITextField()
        f.isSecureTextEntry = true
        f.isUserInteractionEnabled = false
        f.backgroundColor = .clear
        f.alpha = 0.01  // 不可见但存在，触发系统防护
        return f
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}
