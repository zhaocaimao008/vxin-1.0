import SwiftUI

/// 切换账号 / 账号管理页（从「其他」→「切换账号」进入）
struct AccountManagementView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var showAddAccount = false

    private enum Tok {
        static let green     = Color(red: 0x34/255, green: 0xB7/255, blue: 0x59/255)
        static let greenBg   = Color(red: 0xED/255, green: 0xF8/255, blue: 0xF0/255)
        static let secondary = Color(red: 0x8E/255, green: 0x8E/255, blue: 0x93/255)
        static let primary   = Color(red: 0x11/255, green: 0x11/255, blue: 0x11/255)
        static let red       = Color(red: 0xFF/255, green: 0x3B/255, blue: 0x30/255)
    }

    var body: some View {
        List {
            Section("账号列表") {
                ForEach(session.accountList) { acc in
                    Button {
                        if acc.id != session.activeAccountId {
                            session.switchAccount(acc.id)
                            dismiss()
                        }
                    } label: {
                        HStack(spacing: 12) {
                            InitialAvatar(name: acc.username.isEmpty ? "?" : acc.username, size: 40)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(acc.username.isEmpty ? "未命名" : acc.username)
                                    .font(.system(size: 16))
                                    .foregroundColor(Tok.primary)
                                    .lineLimit(1)
                                if !acc.wechatId.isEmpty {
                                    Text("V信号：\(acc.wechatId)")
                                        .font(.system(size: 13))
                                        .foregroundColor(Tok.secondary)
                                }
                            }
                            Spacer()
                            if acc.id == session.activeAccountId {
                                Text("当前")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(Tok.green)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Tok.greenBg)
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        if acc.id != session.activeAccountId {
                            Button("移除", role: .destructive) {
                                session.removeAccount(acc.id)
                            }
                        }
                    }
                }
            }

            Section {
                Button {
                    showAddAccount = true
                } label: {
                    Label("添加账号", systemImage: "plus.circle")
                        .foregroundColor(Tok.green)
                }
            }
        }
        .navigationTitle("切换账号")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAddAccount) {
            NavigationStack { LoginView() }
        }
    }
}
