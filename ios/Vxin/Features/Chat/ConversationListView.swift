import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm: ConversationListViewModel
    private let myId: String

    init(myId: String) {
        self.myId = myId
        _vm = StateObject(wrappedValue: ConversationListViewModel(myId: myId))
    }

    var body: some View {
        Group {
            if vm.loading && vm.conversations.isEmpty {
                ProgressView()
            } else if let error = vm.error, vm.conversations.isEmpty {
                Text(error).foregroundColor(.vxinError)
            } else if vm.conversations.isEmpty {
                Text("暂无会话").foregroundColor(.vxinTextSecondary)
            } else {
                List(vm.conversations) { conv in
                    NavigationLink(value: conv) {
                        ConversationRow(conversation: conv)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("消息")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 2) {
                    Text("消息").font(.headline)
                    Text(statusLabel)
                        .font(.caption2)
                        .foregroundColor(vm.socketStatus == .connected ? .vxinGreen : .vxinTextSecondary)
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("退出") { Task { await session.logout() } }
            }
        }
        .navigationDestination(for: Conversation.self) { conv in
            ChatView(conversation: conv, myId: myId)
        }
    }

    private var statusLabel: String {
        switch vm.socketStatus {
        case .connected: return "已连接"
        case .connecting: return "连接中…"
        case .disconnected: return "未连接"
        }
    }
}

private struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            InitialAvatar(name: conversation.name.isEmpty ? "?" : conversation.name, size: 48)
            VStack(alignment: .leading, spacing: 3) {
                Text(conversation.name.isEmpty ? "未命名会话" : conversation.name)
                    .font(.body)
                    .lineLimit(1)
                Text(previewText)
                    .font(.subheadline)
                    .foregroundColor(.vxinTextSecondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(formatChatTime(conversation.lastTime))
                    .font(.caption2)
                    .foregroundColor(.vxinTextSecondary)
                if conversation.unreadCount > 0 {
                    Text(conversation.unreadCount > 99 ? "99+" : "\(conversation.unreadCount)")
                        .font(.caption2)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.vxinError)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var previewText: String {
        switch conversation.lastMessageType {
        case nil, "text": return conversation.lastMessage ?? ""
        case "image": return "[图片]"
        case "voice": return "[语音]"
        case "video": return "[视频]"
        case "file": return "[文件]"
        default: return conversation.lastMessage ?? ""
        }
    }
}
