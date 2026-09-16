import Foundation

/// Drafts are isolated by server, account and conversation. Legacy unowned drafts are not read.
final class DraftStore {
    static let shared = DraftStore()
    private let defaults: UserDefaults
    private let currentScope: () -> MessageScope?
    private let prefix = "vxin_draft_"

    init(defaults: UserDefaults = .standard, currentScope: @escaping () -> MessageScope? = { MessageScope.current }) {
        self.defaults = defaults
        self.currentScope = currentScope
    }

    func get(_ conversationId: String, scope: MessageScope? = MessageScope.current) -> String {
        guard let scope, scope == currentScope(), !conversationId.isEmpty else { return "" }
        return defaults.string(forKey: prefix + scope.key + ":" + conversationId) ?? ""
    }

    func set(_ conversationId: String, _ text: String, scope: MessageScope? = MessageScope.current) {
        guard let scope, scope == currentScope(), !conversationId.isEmpty else { return }
        let key = prefix + scope.key + ":" + conversationId
        if text.isEmpty { defaults.removeObject(forKey: key) }
        else { defaults.set(text, forKey: key) }
    }

    func clear(_ conversationId: String, scope: MessageScope? = MessageScope.current) { set(conversationId, "", scope: scope) }

    func clearScope(_ scope: MessageScope? = MessageScope.current) {
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(prefix) {
            if !key.hasPrefix(prefix + "v2_") || scope.map({ key.hasPrefix(prefix + $0.key + ":") }) == true {
                defaults.removeObject(forKey: key)
            }
        }
    }
}
