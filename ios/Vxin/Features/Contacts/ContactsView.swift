import SwiftUI

/// 通讯录相关导航路由（值驱动 NavigationStack）
enum ContactRoute: Hashable {
    case contacts
    case addFriend
    case requests
    case createGroup
    case blocked
    case labels
}

struct ContactsView: View {
    var onStartChat: (Conversation) -> Void
    var onAddFriend: () -> Void
    var onRequests: () -> Void
    var onCreateGroup: () -> Void
    var onOpenBlocked: () -> Void = {}
    var onOpenLabels: () -> Void = {}
    var onOpenSearch: () -> Void = {}

    @StateObject private var vm = ContactsViewModel()
    @State private var remarkTarget: Contact?
    @State private var remarkText = ""
    @State private var deleteTarget: Contact?
    @State private var blockTarget: Contact?

    var body: some View {
        List {
            Section {
                QuickEntryRow(systemImage: "person.badge.plus", iconBg: .orange, label: "新的朋友", badgeCount: vm.requestCount, action: onRequests)
                QuickEntryRow(systemImage: "person.3.fill", iconBg: .vxinGreen, label: "群聊", action: onCreateGroup)
                QuickEntryRow(systemImage: "tag.fill", iconBg: .blue, label: "好友标签", action: onOpenLabels)
                QuickEntryRow(systemImage: "hand.raised.fill", iconBg: .gray, label: "黑名单", action: onOpenBlocked)
            }

            if vm.contacts.isEmpty && !vm.loading {
                Section {
                    Text("还没有联系人").foregroundColor(.vxinTextSecondary)
                }
            } else {
                ForEach(groupedSections) { section in
                    Section(header: Text(section.letter)) {
                        ForEach(section.contacts) { contact in
                            ContactRowView(contact: contact, online: vm.onlineIds.contains(contact.id)) {
                                Task { if let conv = await vm.startPrivateChat(contact) { onStartChat(conv) } }
                            }
                            .contextMenu {
                                Button("设置备注") { remarkText = contact.remark ?? ""; remarkTarget = contact }
                                Button("加入黑名单", role: .destructive) { blockTarget = contact }
                                Button("删除好友", role: .destructive) { deleteTarget = contact }
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .alert("设置备注", isPresented: .constant(remarkTarget != nil)) {
            TextField("留空恢复默认昵称", text: $remarkText)
            Button("取消", role: .cancel) { remarkTarget = nil }
            Button("确定") { if let c = remarkTarget { vm.setRemark(c, remark: remarkText) }; remarkTarget = nil }
        }
        .alert("删除好友", isPresented: .constant(deleteTarget != nil)) {
            Button("取消", role: .cancel) { deleteTarget = nil }
            Button("删除", role: .destructive) { if let c = deleteTarget { vm.deleteContact(c) }; deleteTarget = nil }
        } message: {
            Text("确认删除好友「\(deleteTarget?.displayName ?? "")」？将同时删除聊天记录。")
        }
        .alert("加入黑名单", isPresented: .constant(blockTarget != nil)) {
            Button("取消", role: .cancel) { blockTarget = nil }
            Button("加入", role: .destructive) { if let c = blockTarget { vm.block(c) }; blockTarget = nil }
        } message: {
            Text("加入黑名单后，将不再收到「\(blockTarget?.displayName ?? "")」的消息。")
        }
        .navigationTitle("联系人")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack {
                    Button(action: onOpenSearch) { Image(systemName: "magnifyingglass") }
                        .accessibilityLabel("搜索")
                    Button(action: onAddFriend) { Image(systemName: "plus") }
                        .accessibilityLabel("添加好友")
                }
            }
        }
        .overlay {
            if vm.loading && vm.contacts.isEmpty { ProgressView() }
        }
        .toast($vm.error)
        .task { await vm.refresh() }
    }

    /// 按拼音首字母分组（与 Android ContactsScreen 的 sectionLetterOf 语义一致），# 归最后。
    private var groupedSections: [ContactSection] {
        let groups = Dictionary(grouping: vm.contacts) { contact -> String in
            sectionLetter(of: contact.displayName.isEmpty ? contact.username : contact.displayName)
        }
        return groups.keys.sorted { a, b in
            if a == "#" { return false }
            if b == "#" { return true }
            return a < b
        }.map { letter in ContactSection(letter: letter, contacts: groups[letter] ?? []) }
    }
}

private struct ContactSection: Identifiable {
    let letter: String
    let contacts: [Contact]
    var id: String { letter }
}

/// 取分组字母：中文按拼音首字母近似（基于 Unicode 区间），英文取大写首字母，其余归 #。
private func sectionLetter(of name: String) -> String {
    guard let c = name.trimmingCharacters(in: .whitespaces).first else { return "#" }
    if c.isASCII, c.isLetter { return String(c).uppercased() }
    guard let scalar = c.unicodeScalars.first, scalar.value >= 0x4E00, scalar.value <= 0x9FFF else { return "#" }
    let boundaries: [(UInt32, String)] = [
        (0x4E00, "A"), (0x516B, "B"), (0x5693, "C"), (0x5491, "D"),
        (0x59B1, "E"), (0x53D1, "F"), (0x7324, "G"), (0x54C8, "H"),
        (0x51E0, "J"), (0x5580, "K"), (0x62C9, "L"), (0x5988, "M"),
        (0x5B01, "N"), (0x54E6, "O"), (0x5991, "P"), (0x671F, "Q"),
        (0x7136, "R"), (0x6492, "S"), (0x584C, "T"), (0x7A75, "W"),
        (0x5915, "X"), (0x4E2B, "Y"), (0x5E00, "Z"),
    ]
    var result = "#"
    for (code, letter) in boundaries where scalar.value >= code { result = letter }
    return result
}

private struct QuickEntryRow: View {
    let systemImage: String
    let iconBg: Color
    let label: String
    var badgeCount: Int = 0
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(iconBg)
                    .frame(width: 32, height: 32)
                    .overlay(Image(systemName: systemImage).foregroundColor(.white).font(.system(size: 15)))
                Text(label).foregroundColor(.primary)
                Spacer()
                if badgeCount > 0 {
                    Text(badgeCount > 99 ? "99+" : "\(badgeCount)")
                        .font(.caption2).foregroundColor(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.vxinError).clipShape(Capsule())
                }
                Image(systemName: "chevron.right").foregroundColor(.vxinTextSecondary).font(.caption)
            }
        }
    }
}

private struct ContactRowView: View {
    let contact: Contact
    let online: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                InitialAvatar(name: contact.displayName.isEmpty ? "?" : contact.displayName, size: 44)
                    .overlay(alignment: .bottomTrailing) {
                        if online {
                            Circle().fill(Color.vxinOnline).frame(width: 12, height: 12)
                                .overlay(Circle().stroke(.white, lineWidth: 2))
                        }
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(contact.displayName.isEmpty ? "未命名" : contact.displayName).foregroundColor(.primary)
                    if !contact.bio.isEmpty {
                        Text(contact.bio).font(.caption).foregroundColor(.vxinTextSecondary).lineLimit(1)
                    }
                    // 特权账户：离线时展示精确最后在线时间（后端仅对特权账户返回 lastOnlineAt）
                    if !online, let ts = contact.lastOnlineAt, ts > 0 {
                        Text(formatLastOnline(ts)).font(.caption2).foregroundColor(.vxinTextSecondary).lineLimit(1)
                    }
                }
                Spacer()
            }
        }
    }
}

/// 特权账户：格式化好友最后在线时间（Unix 秒），精确到分钟。
func formatLastOnline(_ ts: Double) -> String {
    guard ts > 0 else { return "" }
    let date = Date(timeIntervalSince1970: ts)
    let now = Date()
    let diff = max(0, now.timeIntervalSince(date))
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    let time = f.string(from: date)
    if diff < 60 { return "刚刚在线" }
    if diff < 3600 { return "\(Int(diff / 60)) 分钟前在线" }
    let cal = Calendar.current
    if cal.isDateInToday(date) { return "今天 \(time)" }
    if cal.isDateInYesterday(date) { return "昨天 \(time)" }
    let df = DateFormatter()
    df.dateFormat = "M月d日 HH:mm"
    return df.string(from: date)
}
