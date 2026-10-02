import Foundation
import PushKit
import CallKit
import Combine
import UIKit
import AVFoundation
import WebRTC

/// PushKit(VoIP push) + CallKit：App 被彻底杀死时也能被系统唤醒并弹出系统来电界面。
/// 与后端 sendVoipPush(platform=ios_voip) 配对；前台/后台静默推送(content-available)
/// 仍走 AppDelegate.didReceiveRemoteNotification，二者不冲突（前台优先走应用内 UI，见下）。
final class VoipCallManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
    static let shared = VoipCallManager()
    private override init() {}

    private var pushRegistry: PKPushRegistry?
    private let callController = CXCallController()
    private var provider: CXProvider?

    private var latestVoipToken: String?
    private var pendingCallUUID: UUID?
    private var groupInvite: GroupCallInvite?
    private var pendingCallInfo: (callId: String, from: String, callerName: String, callType: String)?

    /// App 启动后调用一次：建 CXProvider + 注册 PushKit VoIP。
    func activate() {
        let config = CXProviderConfiguration(localizedName: "v信")
        config.iconTemplateImageData = nil
        config.supportsVideo = true
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        let provider = CXProvider(configuration: config)
        provider.setDelegate(self, queue: nil)
        self.provider = provider

        let registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.pushRegistry = registry
    }

    // MARK: - PKPushRegistryDelegate

    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        latestVoipToken = token
        print("[Voip] token prefix=\(token.prefix(12))…")   // 安全：只打印前缀
        if KeychainStore.shared.isLoggedIn {
            Task { await NotificationRepository.shared.register(token: token, platform: "ios_voip") }
        }
    }

    /// 登录后调用：把 PushKit 在未登录期间缓存的 VoIP token 补注册到后端。
    /// PushKit 通常只在 token 变化时回调，登录后再也不会触发 didUpdate，
    /// 若不补注册，该设备永远收不到 VoIP 来电（Codex review P1）。
    func registerCachedTokenIfNeeded() {
        guard let token = latestVoipToken, KeychainStore.shared.isLoggedIn else { return }
        Task { await NotificationRepository.shared.register(token: token, platform: "ios_voip") }
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        guard type == .voIP else { return }
        if let token = latestVoipToken {
            Task { await NotificationRepository.shared.delete(token: token) }
        }
        latestVoipToken = nil
    }

    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload,
                       for type: PKPushType, completion: @escaping () -> Void) {
        // iOS 13+ 必须调用 completion，否则系统会终止进程（多次不调会被永久停用 VoIP 推送）
        defer { completion() }
        guard type == .voIP else { return }
        let d = payload.dictionaryPayload
        guard ["call", "group_call"].contains(d["type"] as? String ?? "") else { return }
        let callId = d["callId"] as? String ?? ""
        let from = d["from"] as? String ?? ""
        let callerName = d["callerName"] as? String ?? ""
        let callType = d["callType"] as? String ?? "audio"
        let conversationId = d["type"] as? String == "group_call" ? (d["conversationId"] as? String ?? "") : ""

        // 前台不弹 CallKit 全屏：应用内 CallHostView 已有来电 UI，避免双 UI（与 Android appForeground 去重对齐）。
        // 但 iOS 13+ 要求每个 PushKit VoIP push 必须上报 CallKit，否则进程会被终止、后续 VoIP push 被抑制
        // （Codex review P1）→ 前台也 reportNewIncomingCall，随后立即以 remoteEnded 结束，满足系统要求且不干扰应用内 UI。
        guard UIApplication.shared.applicationState != .active else {
            if !conversationId.isEmpty {
                GroupCallManager.shared.incomingFromPush(callId: callId, conversationId: conversationId, type: callType, from: from, name: callerName, notify: false)
            } else {
                CallManager.shared.incomingFromPush(from: from, callType: callType, callerName: callerName, callId: callId)
            }
            reportAndImmediatelyEnd(callId: callId, from: from, callerName: callerName, callType: callType)
            return
        }
        // 同 callId 幂等忽略（对齐 incomingFromPush 的 peerId 去重）
        if let p = pendingCallInfo, p.callId == callId { return }
        reportIncomingCall(callId: callId, from: from, callerName: callerName, callType: callType, conversationId: conversationId)
    }

    /// 前台场景：上报 CallKit 后立即结束，满足「每个 VoIP push 必须上报 CallKit」的系统要求（iOS 13+），
    /// 同时避免与应用内 CallHostView 双 UI 冲突。
    private func reportAndImmediatelyEnd(callId: String, from: String, callerName: String, callType: String) {
        let uuid = UUID()
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: from)
        update.localizedCallerName = callerName.isEmpty ? "来电" : callerName
        update.hasVideo = callType == "video"
        provider?.reportNewIncomingCall(with: uuid, update: update) { [weak self] _ in
            self?.provider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        }
    }

    private func reportIncomingCall(callId: String, from: String, callerName: String, callType: String, conversationId: String) {
        let uuid = UUID()
        pendingCallUUID = uuid
        pendingCallInfo = (callId: callId, from: from, callerName: callerName, callType: callType)
        // 先置本地通话状态，防止随后到达的 socket call:incoming 与 CallKit 竞态
        if !conversationId.isEmpty {
            groupInvite = GroupCallInvite(callId: callId, conversationId: conversationId, type: callType, from: from, fromName: callerName)
            GroupCallManager.shared.incomingFromPush(callId: callId, conversationId: conversationId, type: callType, from: from, name: callerName, notify: false)
        } else {
            groupInvite = nil
            CallManager.shared.incomingFromPush(from: from, callType: callType, callerName: callerName, callId: callId)
        }

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: from)
        update.localizedCallerName = callerName.isEmpty ? "来电" : callerName
        update.hasVideo = callType == "video"
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        provider?.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error {
                print("[Voip] reportNewIncomingCall 失败: \(error.localizedDescription)")
            }
        }

        // 被叫侧本地 120s 响铃超时（对齐服务端 CALL_TIMEOUT_MS）→ 未接听自动结束 CallKit + reject 信令。
        // 接听后 pendingCallInfo 会被置 nil，此处据此跳过，避免已接通通话被定时器误挂。
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { [weak self] in
            guard let self, self.pendingCallUUID == uuid, self.pendingCallInfo != nil else { return }
            if let group = self.groupInvite { GroupCallManager.shared.dismissInvite(callId: group.callId) }
            else { CallManager.shared.hangup() }
            self.endCallIfNeeded(uuid: uuid)
        }
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        if let group = groupInvite {
            if pendingCallInfo != nil { GroupCallManager.shared.dismissInvite(callId: group.callId) }
            else { GroupCallManager.shared.hangup() }
        } else if pendingCallUUID != nil { CallManager.shared.hangup() }
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        RTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        RTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession)
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard action.callUUID == pendingCallUUID else { action.fail(); return }
        if let group = groupInvite {
            GroupCallManager.shared.join(callId: group.callId, conversationId: group.conversationId, video: group.type == "video")
        } else { CallManager.shared.accept() }
        // 保留 pendingCallUUID 供 endActiveCall() 在通话结束时关闭系统通话 UI；
        // 清空 pendingCallInfo，使后续 CXEndCallAction 走 hangup() 而非 reject()（已不是 incoming 态）。
        pendingCallInfo = nil
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        guard action.callUUID == pendingCallUUID else { action.fulfill(); return }
        if let group = groupInvite {
            if pendingCallInfo != nil { GroupCallManager.shared.dismissInvite(callId: group.callId) }
            else { GroupCallManager.shared.hangup() }
        } else if pendingCallInfo != nil {
            CallManager.shared.reject()
        } else {
            CallManager.shared.hangup()
        }
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        // 不支持保持，直接放行
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        guard action.callUUID == pendingCallUUID else { action.fail(); return }
        if groupInvite != nil {
            if GroupCallManager.shared.state.micEnabled == action.isMuted { GroupCallManager.shared.toggleMic() }
        } else if CallManager.shared.state.micEnabled == action.isMuted { CallManager.shared.toggleMic() }
        action.fulfill()
    }

    // MARK: - 收尾

    func endCallIfNeeded(uuid: UUID) {
        provider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        if pendingCallUUID == uuid {
            pendingCallUUID = nil
            pendingCallInfo = nil
            groupInvite = nil
        }
    }

    /// 应用内 UI 也可以接听；同步撤销系统响铃超时。
    func markAnswered(groupCallId: String? = nil) {
        guard groupInvite?.callId == groupCallId else { return }
        pendingCallInfo = nil
    }

    /// 供通话管理器同步收尾 CallKit 界面。
    func endActiveCall(groupCallId: String? = nil) {
        guard groupInvite?.callId == groupCallId else { return }
        guard let uuid = pendingCallUUID else { return }
        endCallIfNeeded(uuid: uuid)
    }
}
