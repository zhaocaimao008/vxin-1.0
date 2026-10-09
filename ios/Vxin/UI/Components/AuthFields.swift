import SwiftUI

/// 认证页通用圆角输入框（图标 + 输入 + 可选尾部内容），对齐 34 图参考的 WeChat 风格表单。
/// 与 Android ui/components/AuthFields.kt 保持同一视觉语汇（圆角表面、主题边框、聚焦状态）。
struct VxinAuthField: View {
    let icon: String   // SF Symbol name
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var accessibilityId: String? = nil
    var trailing: AnyView? = nil
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.vxinAuthTextMuted)
                .frame(width: 20)
            TextField("", text: $text, prompt: Text(placeholder).foregroundColor(.vxinAuthPlaceholder))
                .foregroundColor(.vxinTextPrimary)
                .tint(.vxinAuthGold)
                .keyboardType(keyboardType)
                .focused($focused)
                .autocorrectionDisabled(true)
                .textInputAutocapitalization(.never)
                .modifier(AccessibilityIdIfPresentField(id: accessibilityId))
            if let trailing { trailing }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 52)
        .background(Color.vxinSurface)
        .clipShape(RoundedRectangle(cornerRadius: VxinRadius.md))
        .overlay(RoundedRectangle(cornerRadius: VxinRadius.md).stroke(focused ? Color.vxinBrand : Color.vxinBorder, lineWidth: 1))
    }
}

/// 密码圆角输入框：内置显示/隐藏切换。
struct VxinPasswordAuthField: View {
    let placeholder: String
    @Binding var text: String
    var accessibilityId: String? = nil

    @State private var visible = false
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock")
                .foregroundColor(.vxinAuthTextMuted)
                .frame(width: 20)
            Group {
                if visible {
                    TextField("", text: $text, prompt: Text(placeholder).foregroundColor(.vxinAuthPlaceholder))
                } else {
                    SecureField("", text: $text, prompt: Text(placeholder).foregroundColor(.vxinAuthPlaceholder))
                }
            }
            .foregroundColor(.vxinTextPrimary)
            .tint(.vxinAuthGold)
            .focused($focused)
            .autocorrectionDisabled(true)
            .textInputAutocapitalization(.never)
            .modifier(AccessibilityIdIfPresentField(id: accessibilityId))
            Button {
                visible.toggle()
                focused = true
            } label: {
                Image(systemName: visible ? "eye" : "eye.slash")
                    .foregroundColor(.vxinAuthTextMuted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(visible ? "隐藏密码" : "显示密码")
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 52)
        .background(Color.vxinSurface)
        .clipShape(RoundedRectangle(cornerRadius: VxinRadius.md))
        .overlay(RoundedRectangle(cornerRadius: VxinRadius.md).stroke(focused ? Color.vxinBrand : Color.vxinBorder, lineWidth: 1))
    }
}

/// 圆形勾选框：主色实心 + 对比色对勾（选中）/ 描边空心（未选中）。
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
                    .strokeBorder(checked ? Color.clear : Color.vxinAuthBorder, lineWidth: 1.5)
                if checked {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.vxinOnPrimary)
                }
            }
            .frame(width: 18, height: 18)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("勾选")
        .accessibilityValue(checked ? "已选中" : "未选中")
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
