import Foundation

/// I4: 全局 NSURLCache 配置（系统 HTTP 缓存层）
///
/// URLSession 发出的 GET 请求（头像/缩略图等非鉴权资源）自动被系统缓存。
/// 默认内存缓存仅 512KB、磁盘缓存 10MB，远不够图片密集的聊天场景。
/// 配置后：内存 32MB + 磁盘 200MB，头像/图片第二次加载 < 1ms（直接从缓存返回）。
enum URLCacheConfig {
    static func setup() {
        let memoryCapacity = 32 * 1024 * 1024   // 32 MB 内存缓存
        let diskCapacity  = 200 * 1024 * 1024   // 200 MB 磁盘缓存
        let cache = URLCache(
            memoryCapacity: memoryCapacity,
            diskCapacity: diskCapacity,
            directory: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
                .first?.appendingPathComponent("vxin_url_cache")
        )
        URLCache.shared = cache
    }
}
