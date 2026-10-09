import SwiftUI

/// 根视图：按会话状态切换 启动中 / 登录流 / 已登录。
struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    // 外观本地设置：主题与字号，app 级即时生效
    @AppStorage(AppearanceStore.themeKey) private var themeRaw = AppTheme.system.rawValue
    @AppStorage(AppearanceStore.fontKey) private var fontRaw = AppFontScale.standard.rawValue

    // Match Android minimum startup duration without delaying session restoration.
    private static let minSplashDuration: Double = 0.35
    @State private var minSplashElapsed = false

    var body: some View {
        content
            .preferredColorScheme((AppTheme(rawValue: themeRaw) ?? .system).colorScheme)
            .dynamicTypeSize((AppFontScale(rawValue: fontRaw) ?? .standard).dynamicTypeSize)
            .task {
                try? await Task.sleep(nanoseconds: UInt64(Self.minSplashDuration * 1_000_000_000))
                minSplashElapsed = true
            }
    }

    @ViewBuilder private var content: some View {
        switch session.state {
        case .loading:
            VxinSplashView()
        case .unauthenticated:
            if minSplashElapsed { NavigationStack { LoginView() } } else { VxinSplashView() }
        case .authenticated(let user):
            if minSplashElapsed {
                MainTabView(myId: user.id)
                    .overlay(CallHostView())
                    .overlay(GroupCallHostView())
            } else {
                VxinSplashView()
            }
        }
    }
}

private struct VxinSplashView: View {
    var body: some View {
        ZStack {
            Color.vxinBg.ignoresSafeArea()
            VStack(spacing: 16) {
                VxinLogoMark().frame(width: 80, height: 80)
                Text("v信").font(.system(size: 32, weight: .bold)).foregroundColor(.vxinTextPrimary)
                Text("连接 · 沟通 · 未来").font(.subheadline).foregroundColor(.vxinTextSecondary)
                ProgressView().tint(.vxinBrand).padding(.top, 24).accessibilityLabel("正在连接")
            }
        }
    }
}
