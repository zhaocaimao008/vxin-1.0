import SwiftUI

/// 找回密码：手机号 + 邀请码 + 新密码。与 web ForgotPassword.jsx / Android ForgotPasswordScreen 对齐。
struct ForgotPasswordView: View {
    @StateObject private var vm = AuthViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
        VStack(spacing: 16) {
            Spacer(minLength: 24)

            // 品牌 Logo：统一品牌标记（与登录/注册页一致，2026-08-24 四端品牌统一）
            VxinLogoMark()
                .frame(width: 64, height: 64)
                .padding(.bottom, 4)
            Text("找回密码")
                .font(.title.bold())
                .foregroundColor(.vxinTextPrimary)
                .padding(.bottom, 16)

            VxinAuthField(icon: "iphone", placeholder: "手机号", text: $vm.phone, keyboardType: .phonePad)
            VxinAuthField(icon: "ticket", placeholder: "邀请码（6位数字）", text: $vm.inviteCode, keyboardType: .numberPad)
            PasswordField(placeholder: "新密码（≥8位，含字母和数字）", text: $vm.resetNewPassword,
                          textContentType: .newPassword)

            if let error = vm.error {
                Text(error)
                    .font(.footnote)
                    .foregroundColor(.vxinError)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if vm.resetDone {
                Text("✓ 密码已重置，请用新密码登录")
                    .font(.footnote)
                    .foregroundColor(.vxinAuthGold)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            VxinGradientButton(title: "重置密码", loading: vm.loading, enabled: vm.canReset,
                               action: vm.resetPassword)
                .padding(.top, 8)

            Spacer(minLength: 24)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.vxinAuthBg)
        .toolbarBackground(Color.vxinAuthBg, for: .navigationBar)
        .navigationTitle("找回密码")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: vm.resetDone) { done in
            if done { DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { dismiss() } }
        }
    }
}
