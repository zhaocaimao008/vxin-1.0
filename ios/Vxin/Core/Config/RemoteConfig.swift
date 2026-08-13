import Foundation

private struct RemoteConfigDto: Decodable {
    var api: String = ""
    var socket: String = ""
    var cdn: String = ""
    var version: String = ""
}

/// 远程配置（永不重编译换服务器）。启动时从 configURLs 依次拉取 config.json，
/// 取 api 写入 ServerConfig.remote。换服务器只需改 config.json（与 Web/Android 一致）。
enum RemoteConfig {
    /// 引导地址（稳定，唯一编译常量）；与 web/src/utils/config.js、Android RemoteConfig 一致
    static let configURLs = [
        "https://cdn.jsdelivr.net/gh/zhaocaimao008/vxin-config@main/config.json",
        "https://dipsin.com/config.json",
    ]

    /// 拉取并应用远程服务器地址；失败则保留上次缓存/默认。请在首个网络请求前 await 调用。
    // 专用轻量 session：config 拉取不需要认证/证书固定，单独隔离
    private static let _session: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral  // 不持久化 cookie/cache，更轻量
        cfg.timeoutIntervalForRequest  = 5   // 比全局快 1s，尽早切到备用地址
        cfg.timeoutIntervalForResource = 10
        cfg.httpMaximumConnectionsPerHost = 2
        return URLSession(configuration: cfg)
    }()

    static func refresh() async {
        for urlStr in configURLs {
            guard let url = URL(string: urlStr) else { continue }
            do {
                let req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData,
                                    timeoutInterval: 5)
                let (data, resp) = try await _session.data(for: req)
                guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else { continue }
                let cfg = try JSONDecoder().decode(RemoteConfigDto.self, from: data)
                let api = cfg.api.isEmpty ? cfg.socket : cfg.api
                if !api.isEmpty {
                    ServerConfig.shared.setRemote(api)
                    print("[RemoteConfig] server = \(api) (from \(urlStr))")
                    return
                }
            } catch {
                continue
            }
        }
        print("[RemoteConfig] 远程不可达，沿用上次/默认: \(ServerConfig.shared.baseURL)")
    }
}
