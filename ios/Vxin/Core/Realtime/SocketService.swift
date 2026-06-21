import Foundation
import Combine
import SocketIO

enum SocketStatus {
    case disconnected, connecting, connected
}

/// Socket.IO 实时通道（封装 Socket.IO-Client-Swift）。职责等同 Android 的 SocketManager。
///
/// - 鉴权：connect(withPayload:) 把 {token} 作为 CONNECT auth 负载发送，
///   服务端从 handshake.auth.token 读取（对齐 Android opts.auth）
/// - 心跳：由 engine.io 内置 ping/pong 维持 + 库自动重连，无需自造
/// - 接收：监听 new_message / new_message_batch → 统一转 Message 发到 incoming
/// - 发送：emitWithAck("send_message", ...)（消息收发阶段使用）
///
/// 生命周期由 SessionStore 管理：登录/恢复会话后 connect()，登出/401 时 disconnect()。
final class SocketService {
    static let shared = SocketService()
    private init() {}

    /// 注意：SocketIO 库自带 SocketManager 类型，这里用全限定名避免与本类混淆
    private var manager: SocketIO.SocketManager?
    private var socket: SocketIOClient?

    let status = CurrentValueSubject<SocketStatus, Never>(.disconnected)
    let incoming = PassthroughSubject<Message, Never>()

    private let decoder = JSONDecoder()

    func connect() {
        guard let token = KeychainStore.shared.token else { return }
        if socket?.status == .connected { return }
        disconnect()

        guard let url = URL(string: ServerConfig.shared.baseURL) else { return }
        let mgr = SocketIO.SocketManager(socketURL: url, config: [
            .log(false),
            .forceWebsockets(true),     // 仅 websocket，匹配服务端
            .reconnects(true),
            .reconnectWait(1),
            .reconnectWaitMax(10),
            .compress,
        ])
        let sock = mgr.defaultSocket

        sock.on(clientEvent: .connect) { [weak self] _, _ in
            self?.status.send(.connected)
        }
        sock.on(clientEvent: .disconnect) { [weak self] _, _ in
            self?.status.send(.disconnected)
        }
        sock.on(clientEvent: .error) { _, _ in /* 交给库自动重连 */ }

        sock.on("new_message") { [weak self] data, _ in
            self?.handleMessage(data.first)
        }
        sock.on("new_message_batch") { [weak self] data, _ in
            if let arr = data.first as? [[String: Any]] {
                arr.forEach { self?.handleMessage($0) }
            }
        }

        manager = mgr
        socket = sock
        status.send(.connecting)
        sock.connect(withPayload: ["token": token])
    }

    /// 通过 socket 发送文本消息；ack 返回服务端落库后的 Message（消息收发阶段调用）
    func sendMessage(conversationId: String, content: String) async -> Result<Message, Error> {
        guard let sock = socket, sock.status == .connected else {
            return .failure(SocketError.notConnected)
        }
        return await withCheckedContinuation { continuation in
            sock.emitWithAck("send_message", ["conversationId": conversationId, "content": content])
                .timingOut(after: 15) { [weak self] ackData in
                    guard let self else { return }
                    guard let dict = ackData.first as? [String: Any] else {
                        continuation.resume(returning: .failure(SocketError.noResponse)); return
                    }
                    if let ok = dict["success"] as? Bool, ok,
                       let msgDict = dict["message"], let msg = self.decode(msgDict) {
                        continuation.resume(returning: .success(msg))
                    } else {
                        let err = (dict["error"] as? String) ?? "发送失败"
                        continuation.resume(returning: .failure(SocketError.server(err)))
                    }
                }
        }
    }

    func disconnect() {
        socket?.removeAllHandlers()
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
        status.send(.disconnected)
    }

    private func handleMessage(_ any: Any?) {
        decode(any).map { incoming.send($0) }
    }

    private func decode(_ any: Any?) -> Message? {
        guard let dict = any as? [String: Any],
              let data = try? JSONSerialization.data(withJSONObject: dict),
              let msg = try? decoder.decode(Message.self, from: data) else { return nil }
        return msg
    }
}

enum SocketError: LocalizedError {
    case notConnected, noResponse, server(String)
    var errorDescription: String? {
        switch self {
        case .notConnected: return "连接已断开"
        case .noResponse: return "无响应"
        case .server(let m): return m
        }
    }
}
