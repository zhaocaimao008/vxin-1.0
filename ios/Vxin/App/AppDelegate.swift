import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging
import BackgroundTasks

/// 处理 Firebase 初始化、APNs 注册、FCM token、前台/点击通知。
/// SwiftUI 通过 @UIApplicationDelegateAdaptor 接入。
final class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // ── 启动优化：按优先级顺序初始化，非关键任务推后 ────────────
        // 1. 系统 HTTP 缓存（立即，影响所有后续网络请求）
        URLCacheConfig.setup()

        // 2. BGTask 注册（必须在 app 完成启动前注册）
        BackgroundSyncManager.shared.register()

        // 3. 推送（立即，避免首次推送丢失）
        UNUserNotificationCenter.current().delegate = self
        // 来电通知分类：CallManager.showIncomingCallNotification 已设 categoryIdentifier=INCOMING_CALL，
        // 但此前全仓无 UNNotificationCategory 注册 → 通知上一直没有「接听/拒绝」按钮。
        // 按钮点击走 didReceive response 的 ANSWER/DECLINE 分支（见下）。
        let answer = UNNotificationAction(identifier: "ANSWER", title: "接听", options: [.foreground])
        let decline = UNNotificationAction(identifier: "DECLINE", title: "拒绝", options: [.destructive])
        let callCategory = UNNotificationCategory(
            identifier: "INCOMING_CALL", actions: [answer, decline],
            intentIdentifiers: [], options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([callCategory])

        // 4. Firebase（延迟到主线程空闲，减少启动卡顿）
        DispatchQueue.main.async {
            if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
                FirebaseApp.configure()
            }
            Messaging.messaging().delegate = self
        }

        // 5. PushKit VoIP + CallKit：App 被彻底杀死时也能被唤醒弹出系统来电界面
        VoipCallManager.shared.activate()

        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // App 进入后台：调度下次 BGTask 刷新
        BackgroundSyncManager.shared.scheduleNext()
    }

    // APNs token → 交给 Firebase（FCM 底层走 APNs 投递）
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // 占位/未配置或模拟器无 APNs 时会进这里，忽略
    }

    // 来电静默推送（后端 pushCallInvite：data-only + content-available=1）。
    // 后台（未被杀）时系统据此唤醒 App 执行此回调，不经过 UNUserNotificationCenter；
    // App 被彻底杀死时 iOS 不会为静默推送拉起进程 —— 该场景仍需 PushKit/CallKit(VoIP push)，
    // 属单独任务，此处不做。
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        guard userInfo["type"] as? String == "call" else {
            completionHandler(.noData)
            return
        }
        let from = userInfo["from"] as? String ?? ""
        let callType = userInfo["callType"] as? String ?? "audio"
        let callerName = userInfo["callerName"] as? String ?? ""
        DispatchQueue.main.async {
            CallManager.shared.incomingFromPush(from: from, callType: callType, callerName: callerName)
        }
        completionHandler(.newData)
    }
}

// MARK: - FCM token
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        if let fcmToken { PushManager.shared.onToken(fcmToken) }
    }
}

// MARK: - 前台展示 / 点击
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // 前台收到推送：App 已通过 socket 实时收到消息并更新 UI + 震动（ConversationListViewModel），
        // 再展示横幅会与应用内 UI 重复打扰。服务端现总是推送（修复锁屏无通知），
        // 故前台只响声音、不弹横幅；锁屏/后台由系统正常展示完整通知。
        completionHandler([.sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // 来电通知动作：接听/拒绝。userInfo 由 CallManager.showIncomingCallNotification 携带
        // from/callType/callerName；先 incomingFromPush 置 incoming（幂等），再 accept/reject。
        let actionId = response.actionIdentifier
        if actionId == "ANSWER" || actionId == "DECLINE" {
            let info = response.notification.request.content.userInfo
            let from = info["from"] as? String ?? ""
            let callType = info["callType"] as? String ?? "audio"
            let callerName = info["callerName"] as? String ?? ""
            DispatchQueue.main.async {
                CallManager.shared.incomingFromPush(from: from, callType: callType, callerName: callerName)
                if actionId == "ANSWER" {
                    CallManager.shared.accept()
                } else {
                    CallManager.shared.reject()
                }
            }
            completionHandler()
            return
        }

        let info = response.notification.request.content.userInfo
        if let conversationId = info["conversationId"] as? String, !conversationId.isEmpty {
            // 点击通知 → 路由到对应会话（后续接入导航）
            NotificationCenter.default.post(
                name: .vxinOpenConversation, object: nil,
                userInfo: ["conversationId": conversationId]
            )
        }
        completionHandler()
    }
}

extension Notification.Name {
    static let vxinOpenConversation = Notification.Name("vxin.openConversation")
}
