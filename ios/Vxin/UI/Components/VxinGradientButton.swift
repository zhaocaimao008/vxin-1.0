import SwiftUI

/// Shared filled primary action for authentication forms.
struct VxinGradientButton: View {
    let title: String
    var loading: Bool = false
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if loading { ProgressView().tint(.vxinOnPrimary) }
                else { Text(title).fontWeight(.semibold) }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundColor(enabled ? .vxinOnPrimary : .vxinTextSecondary)
            .background(enabled ? Color.vxinBrand : Color.vxinDisabledFill)
            .clipShape(RoundedRectangle(cornerRadius: VxinRadius.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled || loading)
    }
}
