import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AuthViewModel()
    @State private var showServerConfig = false
    @State private var rememberPhone = true   // 仅记住手机号（明文本地），不落盘密码，避免凭据泄露风险
    @State private var agreed = false
    /// 登录成功后的额外回调：根流程(RootView 按 session.state 切换)无需传，默认 nil。
    /// 「添加账号」场景以 sheet 弹出本视图，session.state 仍是 .authenticated(旧user)→
    /// .authenticated(新user)，同一个 case 不会触发 RootView 切换视图、sheet 不会自动关闭，
    /// 需要这个回调显式关掉 sheet 回到主界面。
    var onSuccess: (() -> Void)? = nil
    /// 添加账号入口专用：传入后显示「返回」按钮关闭弹层；普通登录入口不传，无影响
    var onCancel: (() -> Void)? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let onCancel {
                    HStack {
                        Button(action: onCancel) {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                Text("返回")
                            }
                        }
                        .foregroundColor(.vxinAuthGold)
                        Spacer()
                    }
                }
                Spacer(minLength: 32)

                // 品牌 Logo：黑金标记（与 Web/Android 登录页同一套扁平化简版标记，2026-08-24 四端品牌统一）
                VxinLogoMark()
                    .frame(width: 76, height: 76)
                Text("v信")
                    .font(.system(size: VxinFontSize.displayLg, weight: .bold))
                    .foregroundColor(.white)
                Text("连接 · 沟通 · 未来")
                    .font(.subheadline)
                    .foregroundColor(.vxinAuthTextSecondary)
                    .padding(.bottom, 20)

                // 登录方式切换
                HStack(spacing: 24) {
                    Button(action: { vm.loginMode = .phone }) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("手机登录")
                                .font(.headline)
                                .foregroundColor(vm.loginMode == .phone ? .vxinAuthGold : .vxinAuthTextSecondary)
                            if vm.loginMode == .phone {
                                Rectangle().fill(Color.vxinAuthGold).frame(width: 56, height: 2)
                            }
                        }
                    }
                    Button(action: { vm.loginMode = .vxin }) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("v信登录")
                                .font(.headline)
                                .foregroundColor(vm.loginMode == .vxin ? .vxinAuthGold : .vxinAuthTextSecondary)
                            if vm.loginMode == .vxin {
                                Rectangle().fill(Color.vxinAuthGold).frame(width: 56, height: 2)
                            }
                        }
                    }
                    Spacer()
                }
                .padding(.bottom, 8)

                if vm.loginMode == .phone {
                    VxinAuthField(
                        icon: "iphone",
                        placeholder: "请输入手机号",
                        text: $vm.phone,
                        keyboardType: .phonePad,
                        accessibilityId: "login-phone-input",
                        trailing: AnyView(Text("+86").foregroundColor(.vxinAuthTextSecondary))
                    )
                } else {
                    VxinAuthField(
                        icon: "at",
                        placeholder: "请输入v信号",
                        text: $vm.vxinId,
                        keyboardType: .default,
                        accessibilityId: "login-vxin-input"
                    )
                }
                VxinPasswordAuthField(placeholder: "请输入密码", text: $vm.password, accessibilityId: "login-password-input")

                HStack {
                    HStack(spacing: 8) {
                        VxinRoundCheckbox(checked: $rememberPhone, accessibilityId: "login-remember-checkbox")
                        Text(vm.loginMode == .phone ? "记住手机号" : "记住v信号")
                            .font(.footnote)
                            .foregroundColor(.vxinAuthTextSecondary)
                    }
                    Spacer()
                    NavigationLink("忘记密码?") { ForgotPasswordView() }
                        .font(.footnote)
                        .foregroundColor(.vxinAuthTextSecondary)
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
                        if vm.loading { ProgressView().tint(.vxinAuthGold) }
                        else { Text("登录").bold() }
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Color.vxinAuthSurface)
                    .foregroundColor(vm.canLogin && agreed ? .vxinAuthGold : .vxinAuthPlaceholder)
                    .clipShape(RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: VxinRadius.pill, style: .continuous)
                            .strokeBorder(vm.canLogin && agreed ? Color.vxinAuthGold : Color.vxinAuthBorder, lineWidth: 1.5)
                    )
                }
                .disabled(!vm.canLogin || !agreed)
                .padding(.top, 8)
                .accessibilityIdentifier("login-submit-btn")

                HStack(spacing: 4) {
                    Text("还没有账号?").foregroundColor(.vxinAuthTextSecondary)
                    NavigationLink("立即注册") { RegisterView() }
                        .foregroundColor(.vxinAuthGold)
                        .fontWeight(.medium)
                }
                .font(.footnote)
                .padding(.top, 4)

                HStack(alignment: .top, spacing: 8) {
                    VxinRoundCheckbox(checked: $agreed, accessibilityId: "login-agreement-checkbox")
                    // 《用户协议》《隐私政策》暂无落地页（与 Web 端 Register.jsx 现状一致：占位链接，点击不跳转）
                    Text("我已阅读并同意《用户协议》和《隐私政策》")
                        .font(.caption2)
                        .foregroundColor(.vxinAuthTextSecondary)
                }
                .padding(.top, 4)

                Button(showServerConfig ? "收起" : "切换服务器") { showServerConfig.toggle() }
                    .font(.caption)
                    .foregroundColor(.vxinAuthTextSecondary)
                    .padding(.top, 4)

                if showServerConfig {
                    TextField("", text: $vm.serverURL, prompt: Text("服务器地址").foregroundColor(.vxinAuthPlaceholder))
                        .foregroundColor(.white)
                        .tint(.vxinAuthGold)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .padding(8)
                        .overlay(RoundedRectangle(cornerRadius: VxinRadius.sm).stroke(Color.vxinAuthBorder, lineWidth: 1))
                    Button("保存") { vm.saveServerURL(); showServerConfig = false }
                        .foregroundColor(.vxinAuthGold)
                }

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 32)
        }
        .background(Color.vxinAuthBg)
        .scrollContentBackground(.hidden)
        .toolbarBackground(Color.vxinAuthBg, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onChange(of: vm.authedUser) { user in
            if let user {
                session.onAuthenticated(user)
                onSuccess?()
            }
        }
    }
}
