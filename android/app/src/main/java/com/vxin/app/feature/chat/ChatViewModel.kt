package com.vxin.app.feature.chat

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vxin.app.core.auth.AuthState
import com.vxin.app.core.auth.SessionManager
import com.vxin.app.core.media.AudioPlayer
import com.vxin.app.core.media.AudioRecorder
import com.vxin.app.core.media.MediaUploader
import com.vxin.app.core.network.toUserMessage
import com.vxin.app.core.util.MediaUrlResolver
import com.vxin.app.data.model.Message
import com.vxin.app.data.repository.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject

/** 上传中的占位项（成功后被真实 Message 替换） */
data class PendingUpload(
    val tempId: String,
    val type: String,            // image | voice | video | file
    val name: String,
    val localUri: String? = null, // 图片本地预览
    val failed: Boolean = false,
)

data class ChatUiState(
    val title: String = "",
    val loading: Boolean = false,
    val messages: List<Message> = emptyList(),
    val pending: List<PendingUpload> = emptyList(),
    val input: String = "",
    val sending: Boolean = false,
    val recording: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository,
    private val mediaUploader: MediaUploader,
    private val audioRecorder: AudioRecorder,
    private val audioPlayer: AudioPlayer,
    private val mediaUrlResolver: MediaUrlResolver,
    sessionManager: SessionManager,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val conversationId: String = savedStateHandle.get<String>("conversationId").orEmpty()
    private val title: String = savedStateHandle.get<String>("title").orEmpty()

    val myId: String = (sessionManager.state.value as? AuthState.Authenticated)?.user?.id.orEmpty()

    private val _uiState = MutableStateFlow(ChatUiState(title = title, loading = true))
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init {
        loadHistory()
        observeIncoming()
    }

    /** /uploads 相对路径 → 带 token 的绝对地址，供 Coil/播放器加载 */
    fun resolveMediaUrl(url: String?): String? = mediaUrlResolver.resolve(url)

    /** 播放语音消息 */
    fun playVoice(fileUrl: String) {
        resolveMediaUrl(fileUrl)?.let(audioPlayer::play)
    }

    private fun loadHistory() {
        viewModelScope.launch {
            runCatching { chatRepository.loadHistory(conversationId) }
                .onSuccess { list -> _uiState.update { it.copy(loading = false, messages = list) } }
                .onFailure { e -> _uiState.update { it.copy(loading = false, error = e.toUserMessage("加载消息失败")) } }
        }
    }

    private fun observeIncoming() {
        viewModelScope.launch {
            chatRepository.incomingMessages.collect { msg ->
                if (msg.conversation_id != conversationId) return@collect
                appendUnique(msg)
            }
        }
    }

    // ── 文本 ──────────────────────────────────────────────
    fun onInputChange(v: String) = _uiState.update { it.copy(input = v) }

    fun send() {
        val text = _uiState.value.input.trim()
        if (text.isEmpty() || _uiState.value.sending) return
        _uiState.update { it.copy(input = "", sending = true, error = null) }
        viewModelScope.launch {
            chatRepository.sendText(conversationId, text)
                .onSuccess { msg -> appendUnique(msg); _uiState.update { it.copy(sending = false) } }
                .onFailure { e -> _uiState.update { it.copy(sending = false, input = text, error = e.toUserMessage("发送失败")) } }
        }
    }

    // ── 媒体上传（图片/文件/录音）──────────────────────────
    fun uploadFromUri(uri: Uri, previewLocal: Boolean) {
        viewModelScope.launch {
            val prepared = withContext(Dispatchers.IO) { runCatching { mediaUploader.prepareFromUri(uri) }.getOrNull() }
            if (prepared == null) {
                _uiState.update { it.copy(error = "无法读取所选文件") }
                return@launch
            }
            val pending = PendingUpload(
                tempId = UUID.randomUUID().toString(),
                type = prepared.localType,
                name = prepared.displayName,
                localUri = if (previewLocal) uri.toString() else null,
            )
            runUpload(pending) { chatRepository.uploadMedia(conversationId, prepared.part) }
        }
    }

    fun startRecording() {
        if (_uiState.value.recording) return
        if (audioRecorder.start()) {
            _uiState.update { it.copy(recording = true, error = null) }
        } else {
            _uiState.update { it.copy(error = "无法开始录音") }
        }
    }

    fun stopRecordingAndSend() {
        if (!_uiState.value.recording) return
        _uiState.update { it.copy(recording = false) }
        val file = audioRecorder.stop() ?: run {
            _uiState.update { it.copy(error = "录音失败") }
            return
        }
        viewModelScope.launch {
            val prepared = withContext(Dispatchers.IO) {
                mediaUploader.prepareFromFile(file, audioRecorder.mimeType, file.name)
            }
            val pending = PendingUpload(UUID.randomUUID().toString(), "voice", "语音")
            runUpload(pending) { chatRepository.uploadMedia(conversationId, prepared.part) }
        }
    }

    fun cancelRecording() {
        audioRecorder.cancel()
        _uiState.update { it.copy(recording = false) }
    }

    private fun runUpload(pending: PendingUpload, block: suspend () -> Message) {
        addPending(pending)
        viewModelScope.launch {
            runCatching { block() }
                .onSuccess { msg -> removePending(pending.tempId); appendUnique(msg) }
                .onFailure { e ->
                    markPendingFailed(pending.tempId)
                    _uiState.update { it.copy(error = e.toUserMessage("上传失败")) }
                }
        }
    }

    fun dismissFailedPending(tempId: String) =
        _uiState.update { it.copy(pending = it.pending.filterNot { p -> p.tempId == tempId }) }

    // ── helpers ──────────────────────────────────────────
    private fun addPending(p: PendingUpload) =
        _uiState.update { it.copy(pending = it.pending + p) }

    private fun removePending(tempId: String) =
        _uiState.update { it.copy(pending = it.pending.filterNot { p -> p.tempId == tempId }) }

    private fun markPendingFailed(tempId: String) =
        _uiState.update { s -> s.copy(pending = s.pending.map { if (it.tempId == tempId) it.copy(failed = true) else it }) }

    private fun appendUnique(msg: Message) {
        _uiState.update { state ->
            if (state.messages.any { it.id == msg.id }) state
            else state.copy(messages = state.messages + msg)
        }
    }

    override fun onCleared() {
        audioRecorder.cancel()
        audioPlayer.stop()
        super.onCleared()
    }
}
