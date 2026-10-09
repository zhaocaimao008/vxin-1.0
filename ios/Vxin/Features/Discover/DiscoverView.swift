import SwiftUI

struct DiscoverView: View {
    @ObservedObject private var features = FeatureStore.shared

    var body: some View {
        List {
            if features.moments {
                NavigationLink(destination: MomentsView()) { row("朋友圈", subtitle: "分享生活，记录点滴", icon: "VxinIconMoments") }
            }
            NavigationLink(destination: CallHistoryView()) { row("通话记录", subtitle: "查看拨打和接听记录", icon: "VxinIconPhoneCall") }
            if features.collect {
                NavigationLink(destination: FavoritesView()) { row("收藏", subtitle: "保存值得留下的内容", icon: "VxinIconStar") }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.vxinBg)
        .navigationTitle("发现")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ title: String, subtitle: String, icon: String) -> some View {
        HStack(spacing: 16) {
            Image(icon).renderingMode(.template).foregroundColor(.vxinLink)
            VStack(alignment: .leading, spacing: 5) {
                Text(title).foregroundColor(.vxinTextPrimary)
                Text(subtitle).font(.footnote).foregroundColor(.vxinTextSecondary)
            }
        }
        .padding(.vertical, 10)
        .listRowBackground(Color.vxinSurface)
    }
}
