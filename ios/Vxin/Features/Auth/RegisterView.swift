import SwiftUI

struct RegisterView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AuthViewModel()
    @Environment(\.dismiss) private var dismiss
    @State private var agreed = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Spacer(minLength: 24)

                // 品牌 Logo：黑金标记（与 Web/Android 登录页同一套扁平化简版标记，2026-08-24 四端品牌统一）
                VxinLogoMark()
                    .frame(width: 68, height: 68)
                    .padding(.bottom, 4)
                Text("注册新账号")
                    .font(.title2.bold())
                    .foregroundColor(.white)
                    .padding(.bottom, 4)
                Text("连接 · 沟通 · 未来")
                    .font(.footnote)
                    .foregroundColor(.vxinAuthTextSecondary)
                    .padding(.bottom, 12)

                // 昵称：参考图未展示此字段，但后端 register() 强制要求 username，
                // 移除会导致注册失败——「不破坏业务」优先级高于「贴合参考图」，因此保留。
                VxinAuthField(icon: "person", placeholder: "请输入昵称", text: $vm.username, accessibilityId: "register-username-input")
                VxinAuthField(
                    icon: "iphone",
                    placeholder: "请输入手机号",
                    text: $vm.phone,
                    keyboardType: .phonePad,
                    accessibilityId: "register-phone-input",
                    trailing: AnyView(Text("+86").foregroundColor(.vxinAuthTextSecondary))
                )
                // 参考图中的「验证码 / 获取验证码」字段：后端当前没有注册短信验证码接口，
                // 属于「参考图有、后端无」的情况，按规范不伪造，故不实现该字段。
                VxinPasswordAuthField(placeholder: "请输入密码（至少8位，含字母和数字）", text: $vm.password, accessibilityId: "register-password-input")
                // 后台关闭「注册需邀请码」后隐藏邀请码输入框（四端一致）；重新开启后恢复
                if vm.inviteRequired {
                    VxinAuthField(
                        icon: "ticket",
                        placeholder: "请输入邀请码",
                        text: $vm.inviteCode,
                        keyboardType: .numberPad,
                        accessibilityId: "register-invite-input"
                    )
                }

                if let error = vm.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(.vxinError)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(action: vm.register) {
                    ZStack {
                        if vm.loading { ProgressView().tint(.vxinAuthGold) }
                        else { Text("注册").bold() }
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Color.vxinAuthSurface)
                    .foregroundColor(vm.canRegister && agreed ? .vxinAuthGold : .vxinAuthPlaceholder)
                    .clipShape(RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous)
                            .strokeBorder(vm.canRegister && agreed ? Color.vxinAuthGold : Color.vxinAuthBorder, lineWidth: 1.5)
                    )
                }
                .disabled(!vm.canRegister || !agreed)
                .padding(.top, 8)
                .accessibilityIdentifier("register-submit-btn")

                HStack(spacing: 4) {
                    Text("已有账号?").foregroundColor(.vxinAuthTextSecondary)
                    Button("去登录") { dismiss() }
                        .foregroundColor(.vxinAuthGold)
                        .fontWeight(.medium)
                }
                .font(.footnote)
                .padding(.top, 4)

                HStack(alignment: .top, spacing: 8) {
                    VxinRoundCheckbox(checked: $agreed, accessibilityId: "register-agreement-checkbox")
                    Text("我已阅读并同意《用户协议》和《隐私政策》")
                        .font(.caption2)
                        .foregroundColor(.vxinAuthTextSecondary)
                }
                .padding(.top, 4)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 32)
        }
        .background(Color.vxinAuthBg)
        .scrollContentBackground(.hidden)
        .toolbarBackground(Color.vxinAuthBg, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .navigationTitle("注册")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadConfig() }
        .onChange(of: vm.authedUser) { user in
            if let user { session.onAuthenticated(user) }
        }
    }
}
