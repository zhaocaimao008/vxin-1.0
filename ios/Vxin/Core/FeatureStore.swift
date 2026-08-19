import Combine
import Foundation

/// 后台 /api/config 的 features 响应结构（顶层私有，供 FeatureStore.refresh 解析）
private struct FeatureConfig: Decodable {
    struct Features: Decodable {
        let moments: Bool?
        let collect: Bool?
        let inviteRequired: Bool?
        let groupVoiceCall: Bool?
        let groupVideoCall: Bool?
    }
    let features: Features?
}

/// 全局功能开关（feature flags）：后台 /api/config + socket config:updated 实时同步。
/// 四端统一消费：动态(moments)/收藏(collect)/群语音/群视频/邀请码等。
/// 缺省全部视为开启，避免拉取失败时误隐藏功能。
@MainActor
final class FeatureStore: ObservableObject {
    static let shared = FeatureStore()

    @Published var moments = true        // 动态/朋友圈
    @Published var collect = true        // 收藏
    @Published var inviteRequired = true // 注册邀请码
    @Published var groupVoiceCall = true // 群语音
    @Published var groupVideoCall = true // 群视频

    private var cancellables = Set<AnyCancellable>()

    private init() {
        // socket 实时广播 → 热更新
        SocketService.shared.featuresUpdated
            .receive(on: DispatchQueue.main)
            .sink { [weak self] f in self?.apply(f) }
            .store(in: &cancellables)
    }

    /// 初次拉取（登录后调用一次兜底；后续靠 socket 广播）
    func refresh() async {
        guard let cfg: FeatureConfig = try? await APIClient.shared.send("api/config", authorized: false) else { return }
        apply(from: cfg.features)
    }

    private func apply(_ dict: [String: Any]) {
        moments        = (dict["moments"] as? Bool) ?? true
        collect        = (dict["collect"] as? Bool) ?? true
        inviteRequired = (dict["inviteRequired"] as? Bool) ?? true
        groupVoiceCall = (dict["groupVoiceCall"] as? Bool) ?? true
        groupVideoCall = (dict["groupVideoCall"] as? Bool) ?? true
    }

    private func apply(from f: FeatureConfig.Features?) {
        moments        = f?.moments ?? true
        collect        = f?.collect ?? true
        inviteRequired = f?.inviteRequired ?? true
        groupVoiceCall = f?.groupVoiceCall ?? true
        groupVideoCall = f?.groupVideoCall ?? true
    }
}
