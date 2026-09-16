import Foundation

/// Disk keys never contain credentials. A changed credential invalidates old async callbacks.
struct MessageScope: Equatable {
    let server: String
    let userId: String
    private let credential: String

    init(server: String, userId: String, credential: String) {
        self.server = server.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.userId = userId
        self.credential = credential
    }

    var key: String {
        let data = (try? JSONEncoder().encode([server, userId])) ?? Data()
        return "v2_" + data.base64EncodedString().replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
    }

    static var current: MessageScope? {
        guard let user = AccountStore.shared.activeId(), !user.isEmpty,
              let token = KeychainStore.shared.token, !token.isEmpty else { return nil }
        return MessageScope(server: ServerConfig.shared.baseURL, userId: user, credential: token)
    }

    var isCurrent: Bool { self == Self.current }

    func owns(senderId: String, messageConversationId: String, conversationId: String) -> Bool {
        senderId == userId && !conversationId.isEmpty && messageConversationId == conversationId
    }
}
