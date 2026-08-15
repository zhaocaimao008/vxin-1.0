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

                ZStack {
                    RoundedRectangle(cornerRadius: VxinRadius.lg, style: .continuous)
                        .fill(LinearGradient(colors: [.vxinBrandLight, .vxinBrandDark],
                                             startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 68, height: 68)
                        .shadow(color: .vxinBrand.opacity(0.4), radius: 10, y: 5)
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 28)).foregroundColor(.white)
                }
                .padding(.bottom, 4)
                Text("注册新账号")
                    .font(.title2.bold())
                    .foregroundColor(.primary)
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
                    trailing: AnyView(Text("+86").foregroundColor(.vxinTextSecondary))
                )
                // 参考图中的「验证码 / 获取验证码」字段：后端当前没有注册短信验证码接口，
                // 属于「参考图有、后端无」的情况，按规范不伪造，故不实现该字段。
                VxinPasswordAuthField(placeholder: "请输入密码（至少8位，含字母和数字）", text: $vm.password, accessibilityId: "register-password-input")
                VxinAuthField(
                    icon: "ticket",
                    placeholder: vm.inviteRequired ? "请输入邀请码" : "请输入邀请码（选填）",
                    text: $vm.inviteCode,
                    keyboardType: .numberPad,
                    accessibilityId: "register-invite-input"
                )

                if let error = vm.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(.vxinError)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(action: vm.register) {
                    ZStack {
                        if vm.loading { ProgressView().tint(.white) }
                        else { Text("注册").bold() }
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(
                        Group {
                            if vm.canRegister && agreed {
                                LinearGradient(colors: [.vxinBrandLight, .vxinBrandDark],
                                               startPoint: .leading, endPoint: .trailing)
                            } else {
                                Color.vxinTextSecondary.opacity(0.35)
                            }
                        }
                    )
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous))
                }
                .disabled(!vm.canRegister || !agreed)
                .padding(.top, 8)
                .accessibilityIdentifier("register-submit-btn")

                HStack(spacing: 4) {
                    Text("已有账号?").foregroundColor(.vxinTextSecondary)
                    Button("去登录") { dismiss() }
                        .foregroundColor(.vxinBrand)
                        .fontWeight(.medium)
                }
                .font(.footnote)
                .padding(.top, 4)

                HStack(alignment: .top, spacing: 8) {
                    VxinRoundCheckbox(checked: $agreed, accessibilityId: "register-agreement-checkbox")
                    Text("我已阅读并同意《用户协议》和《隐私政策》")
                        .font(.caption2)
                        .foregroundColor(.vxinTextSecondary)
                }
                .padding(.top, 4)

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 32)
        }
        .navigationTitle("注册")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadConfig() }
        .onChange(of: vm.authedUser) { user in
            if let user { session.onAuthenticated(user) }
        }
    }
}
