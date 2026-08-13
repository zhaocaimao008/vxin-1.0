import Foundation

/// iOS 证书固定（防中间人攻击 MITM）
///
/// 原理：URLSession 在 TLS 握手时回调 URLSessionDelegate.urlSession(_:didReceive:completionHandler:)，
/// 我们在此比对服务端证书的 Public Key Hash 与预置值，不匹配则拒绝连接。
///
/// 使用 Public Key Pinning（而非证书固定）的优势：
///   - 证书续期时 Public Key 不变，无需更新 App
///   - 支持 CA 签发的多张证书（CDN/灾备）
///
/// Hash 获取方法（在服务器上执行）：
///   openssl s_client -connect dipsin.com:443 -servername dipsin.com < /dev/null 2>/dev/null \
///     | openssl x509 -pubkey -noout \
///     | openssl pkey -pubin -outform der \
///     | openssl dgst -sha256 -binary \
///     | base64
///
/// ⚠️ 上线前必须替换为真实的 SHA256 Public Key Hash！
///    当前为占位值，会导致所有连接被拒绝。
///    如果暂不启用，将 PINNING_ENABLED 设为 false。
final class CertificatePinningDelegate: NSObject, URLSessionDelegate {
    // 是否启用（生产建议 true；开发调试可临时 false）
    static let PINNING_ENABLED = false  // TODO: 上线前改为 true 并填入真实 hash

    // 合法的服务端 Public Key SHA256 哈希（Base64）
    // 建议配置 2-3 个（主、备、根CA），防止单一证书过期导致 App 不可用
    private let pinnedHashes: Set<String> = [
        // 主证书 Public Key Hash（占位 - 必须替换！）
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        // 备用/灾备证书 Public Key Hash
        "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
    ]

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard Self.PINNING_ENABLED else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // 验证证书链合法性（系统 CA 验证）
        var secResult = SecTrustResultType.invalid
        guard SecTrustEvaluate(serverTrust, &secResult) == errSecSuccess,
              secResult == .proceed || secResult == .unspecified else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // 提取并比对 Public Key Hash
        let certCount = SecTrustGetCertificateCount(serverTrust)
        for i in 0..<certCount {
            guard let cert = SecTrustGetCertificateAtIndex(serverTrust, i),
                  let publicKey = SecCertificateCopyKey(cert),
                  let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
                continue
            }
            let hash = sha256Base64(publicKeyData)
            if pinnedHashes.contains(hash) {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }

        // 没有任何证书匹配 → 拒绝连接（MITM 攻击拦截）
        completionHandler(.cancelAuthenticationChallenge, nil)
    }

    private func sha256Base64(_ data: Data) -> String {
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return Data(hash).base64EncodedString()
    }
}

// MARK: - URLSession 集成
// 在 APIClient.swift 的 session lazy var 中使用此 delegate：
// return URLSession(configuration: cfg, delegate: CertificatePinningDelegate(), delegateQueue: nil)
