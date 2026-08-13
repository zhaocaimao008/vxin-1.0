import Foundation
import Security

/// Bearer token 安全存储（Keychain）。对应 Android 的 EncryptedSharedPreferences。
final class KeychainStore {
    static let shared = KeychainStore()
    private init() {}

    private let service = "com.vxin.app"
    private let account = "vxin.token"
    // 串行队列：保证多线程并发访问 Keychain 时不发生竞态
    // （SecItemAdd/SecItemCopyMatching 在 iOS 上不是线程安全的）
    private let queue = DispatchQueue(label: "com.vxin.keychain", qos: .userInitiated)

    var token: String? {
        get { queue.sync { read() } }
        set { queue.async { [weak self] in
            if let newValue { self?.save(newValue) } else { self?.delete() }
        }}
    }

    var isLoggedIn: Bool { token?.isEmpty == false }

    func clear() { delete() }

    private func save(_ value: String) {
        delete()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else { return nil }
        return value
    }

    private func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
