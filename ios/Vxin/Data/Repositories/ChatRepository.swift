import Foundation
import Combine

/// 聊天仓库。与 Android ChatRepository 等价。
final class ChatRepository {
    static let shared = ChatRepository()
    private init() {}

    private let api = APIClient.shared
    private let socket = SocketService.shared

    /// 实时连接状态（供 UI 显示连接中/已连接）
    var statusPublisher: AnyPublisher<SocketStatus, Never> { socket.status.eraseToAnyPublisher() }

    /// 全局新消息流（各会话共用，UI 自行按 conversationId 过滤）
    var incomingPublisher: AnyPublisher<Message, Never> { socket.incoming.eraseToAnyPublisher() }

    func loadConversations() async throws -> [Conversation] {
        try await api.send("api/messages/conversations")
    }

    func loadHistory(_ conversationId: String, before: Double? = nil) async throws -> [Message] {
        var path = "api/messages/\(conversationId)?limit=50"
        if let before { path += "&before=\(Int(before))" }
        return try await api.send(path)
    }

    func sendText(conversationId: String, content: String) async -> Result<Message, Error> {
        await socket.sendMessage(conversationId: conversationId, content: content)
    }

    /// 上传媒体（图片/语音/文件）；返回服务端创建的消息（同时经 Socket 广播给其他端）
    func uploadMedia(conversationId: String, data: Data, fileName: String, mimeType: String) async throws -> Message {
        try await api.upload("api/messages/\(conversationId)/upload", fileData: data, fileName: fileName, mimeType: mimeType)
    }
}
