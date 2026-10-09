import SwiftUI

/// 统一空态：SF Symbol 图标置于品牌绿柔和圆形徽章内 + 主文案 + 可选副文案。
/// 对齐 Android EmptyState 与 Web cl-empty-icon，提升列表/结果为空时的观感。
struct VxinEmptyState: View {
    let systemImage: String
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.vxinBrandMuted)
                    .frame(width: 64, height: 64)
                Image(systemName: systemImage)
                    .font(.system(size: 28))
                    .foregroundColor(.vxinLink)
            }
            Text(title)
                .font(.system(size: VxinFontSize.md, weight: .medium))
                .foregroundColor(.vxinTextPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundColor(.vxinTextSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }
}
