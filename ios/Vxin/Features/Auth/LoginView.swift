import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AuthViewModel()
    @State private var showServerConfig = false
    @State private var rememberPhone = true   // 仅记住手机号（明文本地），不落盘密码，避免凭据泄露风险
    @State private var agreed = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Spacer(minLength: 32)

                // 品牌 Logo：项目暂无独立可在内容区引用的 Logo 图片资源（只有 AppIcon），
                // 沿用既有的品牌渐变徽章 + SF Symbol 方案，不从参考图截取 Logo。
                ZStack {
                    RoundedRectangle(cornerRadius: VxinRadius.xl, style: .continuous)
                        .fill(LinearGradient(colors: [.vxinBrandLight, .vxinBrandDark],
                                             startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 76, height: 76)
                        .shadow(color: .vxinBrand.opacity(0.4), radius: 12, y: 6)
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 32))
                        .foregroundColor(.white)
                }
                Text("v信")
                    .font(.system(size: VxinFontSize.displayLg, weight: .bold))
                    .foregroundColor(.primary)
                Text("连接世界 · 沟通无限")
                    .font(.subheadline)
                    .foregroundColor(.vxinTextSecondary)
                    .padding(.bottom, 20)

                // 登录方式：当前仅「手机登录」有真实后端支持（login 仅按手机号查询）。
                // 参考图上的「v信登录」（按 v信号登录）没有对应后端能力，未实现，避免伪造入口。
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("手机登录")
                            .font(.headline)
                            .foregroundColor(.vxinTextPrimary)
                        Rectangle().fill(Color.vxinBrand).frame(width: 56, height: 2)
                    }
                    Spacer()
                }
                .padding(.bottom, 8)

                VxinAuthField(
                    icon: "iphone",
                    placeholder: "请输入手机号",
                    text: $vm.phone,
                    keyboardType: .phonePad,
                    accessibilityId: "login-phone-input",
                    trailing: AnyView(Text("+86").foregroundColor(.vxinTextSecondary))
                )
                VxinPasswordAuthField(placeholder: "请输入密码", text: $vm.password, accessibilityId: "login-password-input")

                HStack {
                    HStack(spacing: 8) {
                        VxinRoundCheckbox(checked: $rememberPhone, accessibilityId: "login-remember-checkbox")
                        Text("记住手机号").font(.footnote).foregroundColor(.vxinTextSecondary)
                    }
                    Spacer()
                    NavigationLink("忘记密码?") { ForgotPasswordView() }
                        .font(.footnote)
                        .foregroundColor(.vxinTextSecondary)
                }
                .padding(.top, 4)

                if let error = vm.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(.vxinError)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityIdentifier("auth-error-text")
                }

                Button(action: vm.login) {
                    ZStack {
                        if vm.loading { ProgressView().tint(.white) }
                        else { Text("登录").bold() }
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(
                        Group {
                            if vm.canLogin && agreed {
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
                .disabled(!vm.canLogin || !agreed)
                .padding(.top, 8)
                .accessibilityIdentifier("login-submit-btn")

                HStack(spacing: 4) {
                    Text("还没有账号?").foregroundColor(.vxinTextSecondary)
                    NavigationLink("立即注册") { RegisterView() }
                        .foregroundColor(.vxinBrand)
                        .fontWeight(.medium)
                }
                .font(.footnote)
                .padding(.top, 4)

                HStack(alignment: .top, spacing: 8) {
                    VxinRoundCheckbox(checked: $agreed, accessibilityId: "login-agreement-checkbox")
                    // 《用户协议》《隐私政策》暂无落地页（与 Web 端 Register.jsx 现状一致：占位链接，点击不跳转）
                    Text("我已阅读并同意《用户协议》和《隐私政策》")
                        .font(.caption2)
                        .foregroundColor(.vxinTextSecondary)
                }
                .padding(.top, 4)

                Button(showServerConfig ? "收起" : "切换服务器") { showServerConfig.toggle() }
                    .font(.caption)
                    .foregroundColor(.vxinTextSecondary)
                    .padding(.top, 4)

                if showServerConfig {
                    TextField("服务器地址", text: $vm.serverURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .textFieldStyle(.roundedBorder)
                    Button("保存") { vm.saveServerURL(); showServerConfig = false }
                        .foregroundColor(.vxinBrand)
                }

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 32)
        }
        .onChange(of: vm.authedUser) { user in
            if let user { session.onAuthenticated(user) }
        }
    }
}
