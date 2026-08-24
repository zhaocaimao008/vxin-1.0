import SwiftUI

/// 根视图：按会话状态切换 启动中 / 登录流 / 已登录。
struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    // 外观本地设置：主题与字号，app 级即时生效
    @AppStorage(AppearanceStore.themeKey) private var themeRaw = AppTheme.system.rawValue
    @AppStorage(AppearanceStore.fontKey) private var fontRaw = AppFontScale.standard.rawValue

    // 品牌启动动画最短展示时长（毫秒对应值以秒为单位）：即便 SessionStore 会话恢复很快
    // （缓存 token + 快网），也保证 V信 品牌动画的核心内容完整播放一遍，不因秒过而"一闪而过"。
    // 会话恢复更慢时不受此值限制——VxinSplashView 会随 session.state 继续展示，与
    // Android AppNavigation.kt 的 MIN_SPLASH_DURATION_MS 对齐（1800ms）。
    private static let minSplashDuration: Double = 1.8
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
            VxinSplashView()   // 品牌启动页：黑底 + 金色 Lottie 动画
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

// ── v信 iOS 启动画面 ───────────────────────────────────────────────────────────
/// V信 品牌启动页：黑底 + 金色 Lottie 动画（brand/vxin/lottie/vxin_intro.json，
/// 180帧@60fps/3s，随包资源 vxin_intro.json，见 Resources/）。与 Android SplashScreen
/// 对齐（同一份动画源文件、同样的最短展示时长策略）。
/// 播放一次，结束后保持最后一帧（动画自身 1.4s~3.0s 区间设计为"保持最终状态"，
/// 正好覆盖会话恢复较慢时的等待）。Lottie 动画加载失败时兜底为原纯色+文字启动态，
/// 保证任何情况下都不会白屏/崩溃。
private struct VxinSplashView: View {
    @State private var opacity = 0.0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            LottieSplashView(animationName: "vxin_intro") {
                // 加载失败兜底：原纯色+文字启动态
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
        }
        .opacity(opacity)
        .onAppear {
            withAnimation(.easeIn(duration: 0.35)) { opacity = 1 }
        }
    }
}
