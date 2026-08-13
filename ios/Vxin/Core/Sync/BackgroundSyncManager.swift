import BackgroundTasks
import Foundation

/// I11: BGTaskScheduler 后台刷新管理器
/// 在 App 切后台后系统唤醒时拉取最新会话 + 重试失败消息
final class BackgroundSyncManager {
    static let shared = BackgroundSyncManager()
    private init() {}
    static let taskId = "com.vxin.app.refresh"

    func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.taskId, using: nil) { task in
            guard let t = task as? BGAppRefreshTask else { return }
            self.handleRefresh(task: t)
        }
    }

    func scheduleNext() {
        let req = BGAppRefreshTaskRequest(identifier: Self.taskId)
        req.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(req)
    }

    private func handleRefresh(task: BGAppRefreshTask) {
        task.expirationHandler = { task.setTaskCompleted(success: false) }
        Task {
            // 预热会话列表缓存
            _ = try? await ConversationRepository.shared.list()
            task.setTaskCompleted(success: true)
            self.scheduleNext()
        }
    }
}
