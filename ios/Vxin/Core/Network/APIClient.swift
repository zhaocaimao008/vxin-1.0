import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case server(Int, String?)
    case network
    case decoding

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "手机号或密码错误"
        case .server(_, let msg): return msg ?? "服务器开小差了，请稍后再试"
        case .network: return "网络异常，请检查网络连接"
        case .decoding: return "数据解析失败"
        }
    }
}

/// 让任意 Encodable 可被 JSONEncoder 编码
struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        encodeClosure = { encoder in try wrapped.encode(to: encoder) }
    }
    func encode(to encoder: Encoder) throws { try encodeClosure(encoder) }
}

/// 统一网络层：URLSession + async/await + Bearer 注入 + 401 处理。
/// 与 Android APIClient/AuthInterceptor 等价；不处理 CSRF（无 cookie，后端对 Bearer 放行）。
///
/// 优化（v3.1）：
///   - 使用专用 URLSessionConfiguration：HTTP/2、连接池复用（对齐 Android OkHttp 配置）
///   - 请求超时对齐 Android：connect 20s / resource 60s
///   - 自动重试：5xx / 网络超时最多重试 2 次（指数退避 1s/2s）
final class APIClient {
    static let shared = APIClient()
    private init() {}

    /// 401 通知；SessionStore 订阅后清状态、跳登录页
    static let unauthorizedNotification = Notification.Name("vxin.unauthorized")

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    // ── 专用 URLSession：连接池复用 + HTTP/2 + 超时调优 ────────
    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        // HTTP/2 多路复用（iOS 10+ 默认支持，显式确认）
        cfg.httpShouldUsePipelining = false  // HTTP/2 不需要 pipelining
        // 连接池：最大并发连接数（对齐 Android OkHttp 10 空闲连接）
        cfg.httpMaximumConnectionsPerHost = 8
        // 超时（对齐 Android：connect 20s，resource 60s）
        cfg.timeoutIntervalForRequest  = 20   // 等待服务器响应超时
        cfg.timeoutIntervalForResource = 60   // 资源下载总超时（上传/下载文件）
        // 网络服务类型：responsiveData = 优先保证响应速度（不限速，高优先级）
        cfg.networkServiceType = .responsiveData
        // 蜂窝后台访问（配合 Background App Refresh）
        cfg.allowsCellularAccess = true
        cfg.allowsConstrainedNetworkAccess = true
        cfg.allowsExpensiveNetworkAccess  = true
        // 禁用 cookie（用 Bearer token，不需要 cookie 会话）
        cfg.httpCookieAcceptPolicy = .never
        cfg.httpShouldSetCookies = false
        return URLSession(configuration: cfg)
    }()

    /// 最大自动重试次数（5xx / 网络超时）
    private let maxRetries = 2

    // MARK: - JSON 请求（带自动重试）
    func send<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil,
        authorized: Bool = true
    ) async throws -> T {
        var request = try makeRequest(path: path, method: method, authorized: authorized)
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return try await withRetry(maxRetries) {
            let (data, response): (Data, URLResponse)
            do { (data, response) = try await self.session.data(for: request) }
            catch { throw APIError.network }
            return try self.handle(data: data, response: response)
        }
    }

    /// 取原始字节（带 Bearer），用于二维码 PNG 等非 JSON 响应。
    func fetchData(_ path: String) async throws -> Data {
        let request = try makeRequest(path: path, method: "GET", authorized: true)
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await session.data(for: request) }
        catch { throw APIError.network }
        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        switch http.statusCode {
        case 200..<300: return data
        case 401:
            KeychainStore.shared.token = nil
            NotificationCenter.default.post(name: Self.unauthorizedNotification, object: nil)
            throw APIError.unauthorized
        default: throw APIError.server(http.statusCode, nil)
        }
    }

    // MARK: - 媒体上传（multipart/form-data，字段名固定 file）
    func upload<T: Decodable>(
        _ path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fieldName: String = "file",
        method: String = "POST"
    ) async throws -> T {
        var request = try makeRequest(path: path, method: method, authorized: true)
        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        body.appendString("\r\n--\(boundary)--\r\n")

        let (data, response): (Data, URLResponse)
        do { (data, response) = try await session.upload(for: request, from: body) }
        catch { throw APIError.network }
        return try handle(data: data, response: response)
    }

    // MARK: - 指数退避重试（5xx / 网络超时自动重试）
    private func withRetry<T>(_ times: Int, operation: () async throws -> T) async throws -> T {
        var attempt = 0
        var lastError: Error = APIError.network
        while attempt <= times {
            do {
                return try await operation()
            } catch let err as APIError {
                // 401 / 客户端错误不重试
                switch err {
                case .unauthorized, .decoding: throw err
                case .server(let code, _) where code < 500: throw err
                default: break
                }
                lastError = err
            } catch {
                lastError = error
            }
            if attempt < times {
                // 指数退避：1s, 2s
                let delay = UInt64(1_000_000_000) << attempt
                try? await Task.sleep(nanoseconds: delay)
            }
            attempt += 1
        }
        throw lastError
    }

    // MARK: - 内部
    private func makeRequest(path: String, method: String, authorized: Bool) throws -> URLRequest {
        guard let url = URL(string: ServerConfig.shared.baseURL + "/" + path) else { throw APIError.network }
        var request = URLRequest(url: url)
        request.httpMethod = method
        if authorized, let token = KeychainStore.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func handle<T: Decodable>(data: Data, response: URLResponse) throws -> T {
        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        switch http.statusCode {
        case 200..<300:
            if T.self == EmptyResponse.self { return EmptyResponse() as! T }
            do { return try decoder.decode(T.self, from: data) }
            catch { throw APIError.decoding }
        case 401:
            KeychainStore.shared.token = nil
            NotificationCenter.default.post(name: Self.unauthorizedNotification, object: nil)
            throw APIError.unauthorized
        default:
            let message = try? decoder.decode(APIErrorBody.self, from: data).error
            throw APIError.server(http.statusCode, message)
        }
    }
}

private extension Data {
    mutating func appendString(_ string: String) {
        if let d = string.data(using: .utf8) { append(d) }
    }
}
