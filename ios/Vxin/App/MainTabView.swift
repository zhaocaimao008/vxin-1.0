import SwiftUI

/// 底部 Tab：消息 / 联系人 / 动态 / 我的
struct MainTabView: View {
    let myId: String

    @State private var selectedTab = 0
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView(selection: $selectedTab) {

            // ── Tab 1：消息 ─────────────────────────────────────
            ConversationListView(myId: myId)
                .tabItem {
                    Label("消息", systemImage: "bubble.left.and.bubble.right.fill")
                }
                .accessibilityIdentifier("nav-tab-chats")
                .tag(0)

            // ── Tab 2：联系人 ───────────────────────────────────
            ContactsTab(myId: myId)
                .tabItem {
                    Label("联系人", systemImage: "person.2.fill")
                }
                .accessibilityIdentifier("nav-tab-contacts")
                .tag(1)

            // ── Tab 3：动态 ─────────────────────────────────────
            NavigationStack {
                MomentsView()
            }
            .tabItem {
                Label("动态", systemImage: "camera.fill")
            }
            .accessibilityIdentifier("nav-tab-moments")
            .tag(2)

            // ── Tab 4：我的 ─────────────────────────────────────
            NavigationStack { ProfileView() }
                .tabItem {
                    Label("我的", systemImage: "person.crop.circle.fill")
                }
                .accessibilityIdentifier("nav-tab-me")
                .tag(3)
        }
        .tint(.vxinBrand)
        // 点推送通知 → 跳回消息页
        .onReceive(NotificationCenter.default.publisher(for: .vxinOpenConversation)) { _ in
            selectedTab = 0
        }
        // App 进入前台刷新推送注册
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                PushManager.shared.refreshRegistrationIfNeeded()
            }
        }
    }
}

// ── 联系人 Tab：内置 NavigationStack 处理各子页跳转 ─────────────────
private struct ContactsTab: View {
    let myId: String
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ContactsView(
                onStartChat: { path.append($0) },
                onAddFriend: { path.append(ContactRoute.addFriend) },
                onRequests:  { path.append(ContactRoute.requests) },
                onCreateGroup: { path.append(ContactRoute.createGroup) },
                onOpenBlocked: { path.append(ContactRoute.blocked) },
                onOpenLabels:  { path.append(ContactRoute.labels) },
                onOpenSearch:  { path.append(SearchRoute.search) }
            )
            .navigationDestination(for: Conversation.self) { conv in
                ChatView(
                    conversation: conv, myId: myId,
                    onOpenGroupInfo: { path.append(GroupRoute.info(conv.id)) }
                )
            }
            .navigationDestination(for: GroupRoute.self) { route in
                switch route {
                case .info(let id):
                    GroupInfoView(
                        conversationId: id,
                        onInvite: { path.append(GroupRoute.invite(id)) },
                        onLeft: { path.removeLast(path.count) }
                    )
                case .invite(let id):
                    InviteMembersView(conversationId: id) {
                        if !path.isEmpty { path.removeLast() }
                    }
                }
            }
            .navigationDestination(for: SearchRoute.self) { _ in
                SearchView(onOpenResult: { r in
                    var conv = Conversation(id: r.conversationId, type: r.convType, name: r.convName)
                    if let uid = r.otherUserId, !uid.isEmpty {
                        conv.otherUser = Conversation.OtherUser(id: uid, username: r.convName)
                    }
                    path.append(conv)
                })
            }
            .navigationDestination(for: ContactRoute.self) { route in
                switch route {
                case .contacts:
                    ContactsView(
                        onStartChat: { path.append($0) },
                        onAddFriend: { path.append(ContactRoute.addFriend) },
                        onRequests:  { path.append(ContactRoute.requests) },
                        onCreateGroup: { path.append(ContactRoute.createGroup) },
                        onOpenBlocked: { path.append(ContactRoute.blocked) },
                        onOpenLabels:  { path.append(ContactRoute.labels) },
                        onOpenSearch:  { path.append(SearchRoute.search) }
                    )
                case .addFriend:  AddFriendView()
                case .requests:   FriendRequestsView()
                case .createGroup:
                    CreateGroupView { conv in
                        path.removeLast(path.count)
                        path.append(conv)
                    }
                case .blocked: BlockedView()
                case .labels:  FriendLabelsView()
                }
            }
        }
    }
}
