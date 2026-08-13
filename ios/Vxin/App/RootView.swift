import SwiftUI

/// 根视图：按会话状态切换 启动中 / 登录流 / 已登录。
struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    // 外观本地设置：主题与字号，app 级即时生效
    @AppStorage(AppearanceStore.themeKey) private var themeRaw = AppTheme.system.rawValue
    @AppStorage(AppearanceStore.fontKey) private var fontRaw = AppFontScale.standard.rawValue

    var body: some View {
        content
            .preferredColorScheme((AppTheme(rawValue: themeRaw) ?? .system).colorScheme)
            .dynamicTypeSize((AppFontScale(rawValue: fontRaw) ?? .standard).dynamicTypeSize)
    }

    @ViewBuilder private var content: some View {
        switch session.state {
        case .loading:
            VxinSplashView()   // 品牌启动页：#07C160 背景 + v信 Logo + 淡入动画
        case .unauthenticated:
            NavigationStack { LoginView() }
        case .authenticated(let user):
            MainTabView(myId: user.id)
                .overlay(CallHostView())
                .overlay(GroupCallHostView())
        }
    }
}

// ── v信 iOS 启动画面 ───────────────────────────────────────────────────────────
/// 与 Android SplashScreen 对齐：品牌绿底 + 白色 v信 + 副标语 + 淡入动画
private struct VxinSplashView: View {
    @State private var opacity = 0.0

    var body: some View {
        ZStack {
            Color.vxinBrand.ignoresSafeArea()
            VStack(spacing: 12) {
                Text("v信")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                Text("安全 · 私密 · 畅聊")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.75))
                Spacer().frame(height: 48)
                ProgressView()
                    .tint(.white.opacity(0.65))
                    .scaleEffect(0.9)
            }
        }
        .opacity(opacity)
        .onAppear {
            withAnimation(.easeIn(duration: 0.35)) { opacity = 1 }
        }
    }
}
