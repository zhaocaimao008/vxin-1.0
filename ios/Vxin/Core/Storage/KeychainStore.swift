import Foundation
import Security

/// Bearer token 安全存储（Keychain）。对应 Android 的 EncryptedSharedPreferences。
final class KeychainStore {
    static let shared = KeychainStore()
    private init() {}

    private let service = "com.vxin.app"
    private var account: String { "vxin.token.v2:" + ServerConfig.shared.baseURL }
    // 串行队列：保证多线程并发访问 Keychain 时不发生竞态
    // （SecItemAdd/SecItemCopyMatching 在 iOS 上不是线程安全的）
    private let queue = DispatchQueue(label: "com.vxin.keychain", qos: .userInitiated)

    var token: String? {
        get { let key = account; return queue.sync { read(key) } }
        set { let key = account; queue.sync {
            if let newValue { save(newValue, key: key) } else { delete(key) }
        }}
    }

    var isLoggedIn: Bool { token?.isEmpty == false }

    func clear() { let key = account; queue.sync { delete(key); delete("vxin.token") } }

    private func save(_ value: String, key: String) {
        delete(key)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func read(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else { return nil }
        return value
    }

    private func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
