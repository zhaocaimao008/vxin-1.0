import SwiftUI

private enum AccountMgmtTok {
    static let green     = Color(red: 0x34/255, green: 0xB7/255, blue: 0x59/255)
    static let greenBg   = Color(red: 0xED/255, green: 0xF8/255, blue: 0xF0/255)
    static let secondary = Color(red: 0x8E/255, green: 0x8E/255, blue: 0x93/255)
    static let primary   = Color(red: 0x11/255, green: 0x11/255, blue: 0x11/255)
    static let red       = Color(red: 0xFF/255, green: 0x3B/255, blue: 0x30/255)
}

/// 切换账号 / 账号管理页（从「其他」→「切换账号」进入）
struct AccountManagementView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var showAddAccount = false
    /// 本页本身以 sheet 从 ProfileView 弹出；添加账号成功时需要连本页一起收起，
    /// 才能真正回到主界面（而不是停在本页——SwiftUI 的 dismiss() 只收自己这一层 sheet）。
    var onAccountAdded: (() -> Void)? = nil

    var body: some View {
        List {
            Section("账号列表") {
                ForEach(session.accountList) { acc in
                    AccountRow(
                        account: acc,
                        isActive: acc.id == session.activeAccountId,
                        onSwitch: {
                            if acc.id != session.activeAccountId {
                                session.switchAccount(acc.id)
                                dismiss()
                            }
                        },
                        onRemove: { session.removeAccount(acc.id) }
                    )
                }
            }

            Section {
                Button {
                    showAddAccount = true
                } label: {
                    Label("添加账号", systemImage: "plus.circle")
                        .foregroundColor(AccountMgmtTok.green)
                }
            }
        }
        .navigationTitle("切换账号")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAddAccount) {
            // 添加账号成功后连本页一起关掉，直接回到主界面；
            // SessionStore.onAuthenticated 已完成账号切换 + socket 重连，这里只需收起弹层。
            NavigationStack {
                LoginView(onSuccess: {
                    showAddAccount = false
                    onAccountAdded?()
                }, onCancel: { showAddAccount = false })
            }
        }
    }
}

/// 单个账号行：拆成独立 View 修复原整体 body 表达式过于复杂、
/// 触发 Swift 类型检查器 "unable to type-check in reasonable time" 的编译错误。
private struct AccountRow: View {
    let account: StoredAccount
    let isActive: Bool
    let onSwitch: () -> Void
    let onRemove: () -> Void

    var body: some View {
        Button(action: onSwitch) {
            HStack(spacing: 12) {
                InitialAvatar(name: account.username.isEmpty ? "?" : account.username, size: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                Text(account.username.isEmpty ? "未命名" : account.username)
                    .font(.system(size: 16))
                    .foregroundColor(AccountMgmtTok.primary)
                    .lineLimit(1)
                Spacer()
                if isActive {
                    activeBadge
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if !isActive {
                Button("移除", role: .destructive, action: onRemove)
            }
        }
    }

    private var activeBadge: some View {
        Text("当前")
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(AccountMgmtTok.green)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(AccountMgmtTok.greenBg)
            .clipShape(Capsule())
    }
}
