import SwiftUI

/// 认证页通用下划线输入行（图标 + 输入 + 可选尾部内容），对齐 34 图参考的 WeChat 风格表单。
/// 与 Android ui/components/AuthFields.kt 保持同一视觉语汇（图标灰、下划线、无边框）。
struct VxinAuthField: View {
    let icon: String   // SF Symbol name
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var accessibilityId: String? = nil
    var trailing: AnyView? = nil

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.vxinTextSecondary)
                .frame(width: 20)
            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .autocorrectionDisabled(true)
                .textInputAutocapitalization(.never)
                .modifier(AccessibilityIdIfPresentField(id: accessibilityId))
            if let trailing { trailing }
        }
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(.separator).opacity(0.5)).frame(height: 0.5)
        }
    }
}

/// 密码下划线输入行：内置显示/隐藏切换。
struct VxinPasswordAuthField: View {
    let placeholder: String
    @Binding var text: String
    var accessibilityId: String? = nil

    @State private var visible = false
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock")
                .foregroundColor(.vxinTextSecondary)
                .frame(width: 20)
            Group {
                if visible {
                    TextField(placeholder, text: $text)
                } else {
                    SecureField(placeholder, text: $text)
                }
            }
            .focused($focused)
            .autocorrectionDisabled(true)
            .textInputAutocapitalization(.never)
            .modifier(AccessibilityIdIfPresentField(id: accessibilityId))
            Button {
                visible.toggle()
                focused = true
            } label: {
                Image(systemName: visible ? "eye" : "eye.slash")
                    .foregroundColor(.vxinTextSecondary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(visible ? "隐藏密码" : "显示密码")
        }
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(.separator).opacity(0.5)).frame(height: 0.5)
        }
    }
}

/// 圆形勾选框：品牌绿实心 + 白色对勾（选中）/ 描边空心（未选中）。
struct VxinRoundCheckbox: View {
    @Binding var checked: Bool
    var accessibilityId: String? = nil

    var body: some View {
        Button {
            checked.toggle()
        } label: {
            ZStack {
                Circle()
                    .fill(checked ? Color.vxinBrand : Color.clear)
                Circle()
                    .strokeBorder(checked ? Color.clear : Color.vxinTextSecondary.opacity(0.5), lineWidth: 1.5)
                if checked {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .frame(width: 18, height: 18)
        }
        .buttonStyle(.plain)
        .modifier(AccessibilityIdIfPresentField(id: accessibilityId))
    }
}

/// 仅在 id 非空时附加 accessibilityIdentifier。
struct AccessibilityIdIfPresentField: ViewModifier {
    let id: String?
    func body(content: Content) -> some View {
        if let id { content.accessibilityIdentifier(id) } else { content }
    }
}
