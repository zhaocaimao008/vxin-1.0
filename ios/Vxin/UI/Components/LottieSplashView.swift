import SwiftUI
import Lottie

/// 通用 Lottie 播放包装：按 name 在主 Bundle 查找 JSON 动画资源，播放一次后保持最后一帧。
/// 资源缺失/解析失败时展示调用方提供的 fallback，不崩溃/不白屏（对齐 Android
/// SplashScreen 的 compositionResult.isFailure 兜底策略）。
struct LottieSplashView<Fallback: View>: View {
    let animationName: String
    @ViewBuilder var fallback: () -> Fallback

    var body: some View {
        if let animation = LottieAnimation.named(animationName) {
            LottieView(animation: animation)
                .playing(loopMode: .playOnce)
                .resizable()
                .frame(width: 240, height: 240)
        } else {
            fallback()
        }
    }
}
