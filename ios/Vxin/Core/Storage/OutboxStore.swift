import Foundation

/// 失败消息「待发件箱」——让发送失败的文本消息在切走会话 / 杀进程重启后依然不丢失，
/// 对齐 Web / Android 的 outbox 体验。按 conversationId 持久化到 UserDefaults。
/// 只存纯文本（type=="text"）；每会话最多 50 条防膨胀。
final class OutboxStore {
    static let shared = OutboxStore()
    private let defaults: UserDefaults
    private let currentScope: () -> MessageScope?
    init(defaults: UserDefaults = .standard, currentScope: @escaping () -> MessageScope? = { MessageScope.current }) {
        self.defaults = defaults
        self.currentScope = currentScope
    }

    private let prefix = "vxin_outbox_"
    private let maxPerConv = 50

    /// 可持久化的失败消息快照（Message 仅 Decodable，这里用独立 Codable 结构）
    private struct Item: Codable {
        let id: String
        let conversationId: String
        let senderId: String
        let content: String
        let replyToId: String?
        let createdAt: Double
        let replyToSenderName: String?
        let replyToId2: String?
        let replyToType: String?
        let replyToContent: String?
    }

    // MARK: - Public

    /// 读取某会话的待发件箱，还原为 failed 态的 Message 列表
    func load(_ conversationId: String, scope: MessageScope? = MessageScope.current) -> [Message] {
        loadItems(conversationId, scope: scope).map { item in
            let reply: ReplyPreview? = item.replyToId2.map {
                ReplyPreview(id: $0, type: item.replyToType ?? "text",
                             content: item.replyToContent ?? "", senderName: item.replyToSenderName ?? "")
            }
            var m = Message(optimisticText: item.id, conversationId: item.conversationId,
                            senderId: item.senderId, content: item.content,
                            replyToId: item.replyToId, replyTo: reply, clientMsgId: item.id)
            m.localStatus = LocalMsgStatus.failed
            m.createdAt = item.createdAt
            return m
        }
    }

    /// 新增/更新一条失败消息（按 id 去重；仅文本）
    func upsert(_ conversationId: String, _ msg: Message, scope: MessageScope? = MessageScope.current) {
        guard let scope, scope == currentScope(), msg.type == "text",
              scope.owns(senderId: msg.senderId, messageConversationId: msg.conversationId, conversationId: conversationId) else { return }
        var items = loadItems(conversationId, scope: scope)
        let item = Item(
            id: msg.id, conversationId: conversationId, senderId: msg.senderId,
            content: msg.content, replyToId: msg.replyToId, createdAt: msg.createdAt,
            replyToSenderName: msg.replyTo?.senderName, replyToId2: msg.replyTo?.id,
            replyToType: msg.replyTo?.type, replyToContent: msg.replyTo?.content
        )
        if let idx = items.firstIndex(where: { $0.id == msg.id }) { items[idx] = item }
        else { items.append(item) }
        save(conversationId, Array(items.suffix(maxPerConv)), scope: scope)
    }

    /// 消息成功送达后移除（按 id）
    func remove(_ conversationId: String, _ msgId: String, scope: MessageScope? = MessageScope.current) {
        guard !conversationId.isEmpty else { return }
        let items = loadItems(conversationId, scope: scope)
        let next = items.filter { $0.id != msgId }
        if next.count != items.count { save(conversationId, next, scope: scope) }
    }

    // MARK: - Private

    func clearScope(_ scope: MessageScope? = MessageScope.current) {
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(prefix) {
            if !key.hasPrefix(prefix + "v2_") || scope.map({ key.hasPrefix(prefix + $0.key + ":") }) == true {
                defaults.removeObject(forKey: key)
            }
        }
    }

    private func loadItems(_ conversationId: String, scope: MessageScope?) -> [Item] {
        guard let scope, scope == currentScope(), !conversationId.isEmpty else { return [] }
        guard let data = defaults.data(forKey: prefix + scope.key + ":" + conversationId) else { return [] }
        return ((try? JSONDecoder().decode([Item].self, from: data)) ?? []).filter {
            scope.owns(senderId: $0.senderId, messageConversationId: $0.conversationId, conversationId: conversationId)
        }
    }

    private func save(_ conversationId: String, _ items: [Item], scope: MessageScope?) {
        guard let scope, scope == currentScope() else { return }
        let key = prefix + scope.key + ":" + conversationId
        if items.isEmpty { defaults.removeObject(forKey: key); return }
        if let data = try? JSONEncoder().encode(items) { defaults.set(data, forKey: key) }
    }
}
