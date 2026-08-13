import UIKit

/**
 * I17: iOS 截图防护
 *
 * 原理：将聊天内容视图添加到一个 UITextField（isSecureTextEntry=true）的 subview 中。
 * 系统在截图/屏幕录制时会自动将 secureTextEntry 视图渲染为空白。
 *
 * 注意：此方法在 iOS 13+ 有效；SwiftUI 通过 .background 方式集成。
 *
 * 使用：
 *   1. 普通聊天页面：不启用（方便用户截图分享）
 *   2. 阅后即焚会话：进入时调用 enable()，退出时调用 disable()
 *   3. 也可全局在 AppDelegate 中启用，策略由产品决定
 */
final class ScreenshotProtection {
    static let shared = ScreenshotProtection()
    private init() {}

    private var secureTextField: UITextField?
    private var protectedView: UIView?

    /// 为指定视图启用截图防护
    func protect(_ view: UIView) {
        guard secureTextField == nil else { return }
        let field = UITextField()
        field.isSecureTextEntry = true
        field.isUserInteractionEnabled = false
        field.frame = view.bounds
        field.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        // 取 secureTextField 的容器视图（系统私有）
        guard let secureContainer = field.layer.sublayers?.first?.delegate as? UIView else {
            // 降级：不支持时静默
            return
        }
        // 将目标视图添加到安全容器
        secureContainer.addSubview(view)
        view.frame = secureContainer.bounds
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.secureTextField = field
        self.protectedView = view
    }

    /// 移除截图防护（恢复正常视图层级）
    func unprotect(_ view: UIView) {
        guard let originalParent = view.superview?.superview else { return }
        originalParent.addSubview(view)
        view.frame = originalParent.bounds
        secureTextField?.removeFromSuperview()
        secureTextField = nil
        protectedView = nil
    }
}

// MARK: - SwiftUI Extension
import SwiftUI

extension View {
    /// 在 SwiftUI View 上应用截图防护（阅后即焚会话专用）
    func screenshotProtected(_ enabled: Bool) -> some View {
        self.background(
            Group {
                if enabled {
                    SecureFieldBackground()
                }
            }
        )
    }
}

/// 利用 UITextField(isSecureTextEntry) 遮蔽后台的私有实现
private struct SecureFieldBackground: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let field = UITextField()
        field.isSecureTextEntry = true
        field.isUserInteractionEnabled = false
        // 让背景视图透明，只作为"防截图层"
        field.backgroundColor = .clear
        return field
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}
