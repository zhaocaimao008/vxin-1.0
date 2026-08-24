import SwiftUI

/// 找回密码：手机号 + 邀请码 + 新密码。与 web ForgotPassword.jsx / Android ForgotPasswordScreen 对齐。
struct ForgotPasswordView: View {
    @StateObject private var vm = AuthViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Spacer()

            // 品牌 Logo：黑金标记（与登录/注册页一致，2026-08-24 四端品牌统一）
            VxinLogoMark()
                .frame(width: 64, height: 64)
                .padding(.bottom, 4)
            Text("找回密码")
                .font(.title.bold())
                .foregroundColor(.white)
                .padding(.bottom, 16)

            TextField("", text: $vm.phone, prompt: Text("手机号").foregroundColor(.vxinAuthPlaceholder))
                .foregroundColor(.white)
                .tint(.vxinAuthGold)
                .keyboardType(.phonePad)
                .padding(8)
                .overlay(RoundedRectangle(cornerRadius: VxinRadius.sm).stroke(Color.vxinAuthBorder, lineWidth: 1))
            TextField("", text: $vm.inviteCode, prompt: Text("邀请码（6位数字）").foregroundColor(.vxinAuthPlaceholder))
                .foregroundColor(.white)
                .tint(.vxinAuthGold)
                .keyboardType(.numberPad)
                .padding(8)
                .overlay(RoundedRectangle(cornerRadius: VxinRadius.sm).stroke(Color.vxinAuthBorder, lineWidth: 1))
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

            Spacer()
        }
        .padding(.horizontal, 32)
        .background(Color.vxinAuthBg)
        .toolbarBackground(Color.vxinAuthBg, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .navigationTitle("找回密码")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: vm.resetDone) { done in
            if done { DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { dismiss() } }
        }
    }
}
