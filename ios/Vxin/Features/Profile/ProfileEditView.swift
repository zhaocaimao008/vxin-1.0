import SwiftUI
import PhotosUI
import Kingfisher

/// Profile editing page (avatar + nickname). Extracted from old ProfileView.
struct ProfileEditView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var username = ""
    @State private var saving = false
    @State private var uploadingAvatar = false
    @State private var message: String?
    @State private var photoItem: PhotosPickerItem?
    private let repo = ProfileRepository.shared

    private enum Tok {
        static let green = Color(red: 0x34/255, green: 0xB7/255, blue: 0x59/255)
        static let secondary = Color(red: 0x8E/255, green: 0x8E/255, blue: 0x93/255)
        static let avatarSize: CGFloat = 80
    }

    var body: some View {
        Form {
            Section {
                HStack {
                    Spacer()
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        avatarView
                            .overlay(alignment: .bottomTrailing) {
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(.white)
                                    .padding(5)
                                    .background(Tok.green)
                                    .clipShape(Circle())
                                    .offset(x: 2, y: 2)
                            }
                    }
                    .accessibilityLabel("更换头像")
                    Spacer()
                }
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            Section("昵称") {
                TextField("请输入昵称", text: $username)
                    .accessibilityIdentifier("edit-username-input")
            }

            Section {
                Button {
                    saveProfile()
                } label: {
                    if saving {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("保存")
                            .foregroundColor(Tok.green)
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(saving || username.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityIdentifier("edit-save-btn")
            }
        }
        .navigationTitle("编辑资料")
        .navigationBarTitleDisplayMode(.inline)
        .toast($message)
        .onAppear {
            if username.isEmpty { username = session.currentUser?.username ?? "" }
        }
        .onChange(of: photoItem) { item in handlePhoto(item) }
        .overlay {
            if uploadingAvatar {
                ProgressView("上传头像中…")
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    @ViewBuilder private var avatarView: some View {
        let user = session.currentUser
        if let avatar = user?.avatar, !avatar.isEmpty,
           let src = MediaUrlResolver.kfSource(raw: avatar) {
            KFImage(source: src)
                .resizable().scaledToFill()
                .frame(width: Tok.avatarSize, height: Tok.avatarSize)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        } else {
            InitialAvatar(name: user?.username ?? "?", size: Tok.avatarSize)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private func saveProfile() {
        saving = true; message = nil
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        Task {
            do {
                var user = try await repo.updateProfile(
                    username: username.trimmingCharacters(in: .whitespaces), bio: session.currentUser?.bio ?? ""
                )
                if user.phone.isEmpty, let phone = session.currentUser?.phone { user.phone = phone }
                session.updateCurrentUser(user)
                message = "已保存"
                await MainActor.run {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { dismiss() }
                }
            } catch {
                message = (error as? LocalizedError)?.errorDescription ?? "保存失败"
            }
            saving = false
        }
    }

    private func handlePhoto(_ item: PhotosPickerItem?) {
        guard let item else { return }
        uploadingAvatar = true; message = nil
        Task {
            defer { uploadingAvatar = false; photoItem = nil }
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.85) ?? data
            do {
                let url = try await repo.uploadAvatar(data: jpeg, fileName: "avatar.jpg")
                if let user = session.currentUser {
                    var updated = user; updated.avatar = url
                    session.updateCurrentUser(updated)
                }
                message = "头像已更新"
            } catch {
                message = (error as? LocalizedError)?.errorDescription ?? "头像上传失败"
            }
        }
    }
}
