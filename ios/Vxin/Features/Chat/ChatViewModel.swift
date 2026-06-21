import Foundation
import Combine
import UIKit

/// 上传中的占位项（成功后被真实 Message 替换），对齐 Android PendingUpload
struct PendingUpload: Identifiable {
    let id: String = UUID().uuidString
    let type: String                // image | voice | video | file
    let name: String
    let previewImage: UIImage?       // 图片本地预览
    var failed: Bool = false
}

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var pending: [PendingUpload] = []
    @Published var input = ""
    @Published var sending = false
    @Published var recording = false
    @Published var error: String?

    let conversationId: String
    let title: String
    let myId: String

    private let repo = ChatRepository.shared
    private let recorder = AudioRecorder.shared
    private let player = AudioPlayerService.shared
    private var cancellables = Set<AnyCancellable>()

    init(conversationId: String, title: String, myId: String) {
        self.conversationId = conversationId
        self.title = title
        self.myId = myId

        repo.incomingPublisher
            .sink { [weak self] msg in
                Task { @MainActor in self?.onIncoming(msg) }
            }
            .store(in: &cancellables)

        Task { await loadHistory() }
    }

    func resolveMediaUrl(_ url: String?) -> String? { MediaUrlResolver.resolve(url) }

    // MARK: - 历史 / 实时
    func loadHistory() async {
        do { messages = try await repo.loadHistory(conversationId) }
        catch { self.error = (error as? LocalizedError)?.errorDescription ?? "加载消息失败" }
    }

    private func onIncoming(_ msg: Message) {
        guard msg.conversationId == conversationId else { return }
        appendUnique(msg)
    }

    // MARK: - 文本
    func sendText() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !sending else { return }
        input = ""
        sending = true
        error = nil
        Task {
            let result = await repo.sendText(conversationId: conversationId, content: text)
            sending = false
            switch result {
            case .success(let msg): appendUnique(msg)
            case .failure(let err):
                input = text
                error = (err as? LocalizedError)?.errorDescription ?? "发送失败"
            }
        }
    }

    // MARK: - 媒体上传
    func upload(data: Data, fileName: String, mimeType: String, localType: String, preview: UIImage?) {
        let item = PendingUpload(type: localType, name: fileName, previewImage: preview)
        pending.append(item)
        Task {
            do {
                let msg = try await repo.uploadMedia(conversationId: conversationId, data: data, fileName: fileName, mimeType: mimeType)
                removePending(item.id)
                appendUnique(msg)
            } catch {
                markFailed(item.id)
                self.error = (error as? LocalizedError)?.errorDescription ?? "上传失败"
            }
        }
    }

    // MARK: - 录音
    func startRecording() {
        guard !recording else { return }
        if recorder.start() { recording = true } else { error = "无法开始录音" }
    }

    func stopRecordingAndSend() {
        guard recording else { return }
        recording = false
        guard let url = recorder.stop() else { error = "录音失败"; return }
        Task {
            guard let data = try? Data(contentsOf: url) else { error = "读取录音失败"; return }
            upload(data: data, fileName: url.lastPathComponent, mimeType: recorder.mimeType, localType: "voice", preview: nil)
        }
    }

    func cancelRecording() {
        recorder.cancel()
        recording = false
    }

    // MARK: - 播放 / 移除失败项
    func playVoice(_ message: Message) {
        if let url = resolveMediaUrl(message.fileUrl) { player.play(urlString: url) }
    }

    func dismissFailed(_ id: String) {
        pending.removeAll { $0.id == id }
    }

    // MARK: - helpers
    private func appendUnique(_ msg: Message) {
        guard !messages.contains(where: { $0.id == msg.id }) else { return }
        messages.append(msg)
    }

    private func removePending(_ id: String) { pending.removeAll { $0.id == id } }

    private func markFailed(_ id: String) {
        if let idx = pending.firstIndex(where: { $0.id == id }) { pending[idx].failed = true }
    }
}
