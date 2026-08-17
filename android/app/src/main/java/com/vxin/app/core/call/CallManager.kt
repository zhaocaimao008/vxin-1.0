package com.vxin.app.core.call

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.util.Log
import com.vxin.app.core.auth.SessionManager
import com.vxin.app.core.di.AppScope
import com.vxin.app.core.realtime.SocketManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import javax.inject.Inject
import javax.inject.Singleton

enum class CallStage { IDLE, OUTGOING, INCOMING, CONNECTING, CONNECTED, ENDED }

data class CallState(
    val stage: CallStage = CallStage.IDLE,
    val peerId: String = "",
    val peerName: String = "",
    val isVideo: Boolean = false,
    val isCaller: Boolean = false,
    val micEnabled: Boolean = true,
    val cameraEnabled: Boolean = true,
    val remoteVideoActive: Boolean = false,
    val connectedAt: Long = 0,        // 接通时刻(elapsedRealtime ms)，用于通话计时
    val endedAt: Long = 0,            // 结束时刻(elapsedRealtime ms)，用于结束页定格总时长
)

/**
 * WebRTC 1对1 音视频通话。信令走 SocketManager（call:* 事件，纯转发）。
 * 单活动通话；UI 通过 [state] 观察，并取 [localVideoTrack]/[remoteVideoTrack] 渲染。
 */
@Singleton
class CallManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val socketManager: SocketManager,
    private val sessionManager: SessionManager,
    private val turnApi: com.vxin.app.data.api.TurnApi,
    private val notificationHelper: com.vxin.app.core.push.NotificationHelper,
    @AppScope private val scope: CoroutineScope,
) {
    val eglBase: EglBase = EglBase.create()

    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var callTimeoutJob: Job? = null   // 主叫呼出超时:对方无应答/断线时自动收尾,防卡死"呼叫中"
    private var audioSource: org.webrtc.AudioSource? = null
    private var videoSource: VideoSource? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceHelper: SurfaceTextureHelper? = null

    var localVideoTrack: VideoTrack? = null
        private set
    var remoteVideoTrack: VideoTrack? = null
        private set

    // ICE 候选缓存 + 远端描述就绪标志：ICE 事件在协程线程读写，onSetSuccess/drainIce 在 WebRTC
    // 自己的信令线程回调 → 跨线程。必须同锁保护「查标志→入队/直加」与「置标志→排空」两段的原子性，
    // 否则存在竞态：ICE 处理读到 remoteDescSet==false，此刻 onSetSuccess 在另一线程置位并排空空队列，
    // ICE 再把候选压进 pendingIce → 该候选永不排空 → 连接卡在 CONNECTING。并发迭代还会 CME。
    private val iceLock = Any()
    private val pendingIce = mutableListOf<IceCandidate>()
    private var remoteDescSet = false

    private val _state = MutableStateFlow(CallState())
    val state: StateFlow<CallState> = _state.asStateFlow()

    // STUN-only 兜底；通话前 refreshIceServers() 会向后端拉取含 TURN 的完整列表
    private val fallbackIceServers = listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
    )
    @Volatile
    private var iceServers: List<PeerConnection.IceServer> = fallbackIceServers

    /** 通话建立前刷新 ICE（含时效 TURN 凭证）。失败保留兜底，不阻断通话。 */
    private suspend fun refreshIceServers() {
        try {
            val creds = turnApi.getCredentials()
            val servers = creds.iceServers.mapNotNull { dto ->
                if (dto.urls.isEmpty()) return@mapNotNull null
                PeerConnection.IceServer.builder(dto.urls).apply {
                    dto.username?.let { setUsername(it) }
                    dto.credential?.let { setPassword(it) }
                }.createIceServer()
            }
            if (servers.isNotEmpty()) iceServers = servers
        } catch (e: Exception) {
            Log.w("CallManager", "refreshIceServers failed, using fallback STUN", e)
        }
    }

    init {
        ensureFactory()
        observeSignaling()
    }

    private fun ensureFactory() {
        if (factory != null) return
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions()
        )
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()
    }

    // ── 对外动作 ───────────────────────────────────────────
    /** 主叫发起 */
    fun startCall(peerId: String, peerName: String, video: Boolean) {
        if (_state.value.stage != CallStage.IDLE && _state.value.stage != CallStage.ENDED) return
        _state.value = CallState(CallStage.OUTGOING, peerId, peerName, isVideo = video, isCaller = true)
        playRingbackTone()                  // 主叫拨出→接通前循环回铃音（接通/挂断时停）
        // 本地呼出超时:60s 内未接通(对方不接/断线,后端 timeout 不向主叫发事件)则自动挂断收尾,
        // 防止界面永远卡在"呼叫中"。接通(CONNECTED)或挂断时取消(见 cleanup / IceConnectionState)。
        callTimeoutJob?.cancel()
        callTimeoutJob = scope.launch {
            delay(60_000)
            val st = _state.value.stage
            if (st == CallStage.OUTGOING || st == CallStage.CONNECTING) {
                if (_state.value.peerId.isNotEmpty()) socketManager.emitCallEnd(_state.value.peerId)
                cleanup(CallStage.ENDED)
            }
        }
        scope.launch {
            refreshIceServers()                 // 先拿到含 TURN 的 ICE，再建连接
            if (_state.value.stage == CallStage.ENDED) return@launch  // 期间被取消
            createPeerConnection()
            createLocalTracks(video)
            // 本地媒体已开始采集（麦克风/摄像头）→ 起前台服务保活（此刻 App 在前台、权限已授予，满足 FGS 合规）
            CallForegroundService.start(context, video)
            val name = sessionManager.currentUser?.username.orEmpty()
            socketManager.emitCallRequest(peerId, if (video) "video" else "audio", name)
        }
    }

    /** 被叫接听 */
    fun accept() {
        val s = _state.value
        if (s.stage != CallStage.INCOMING) return
        stopIncomingRing()                  // 已接通 → 停铃声
        _state.update { it.copy(stage = CallStage.CONNECTING) }
        scope.launch {
            refreshIceServers()
            if (_state.value.stage == CallStage.ENDED) return@launch
            createPeerConnection()
            createLocalTracks(s.isVideo)
            // 本地媒体已开始采集 → 起前台服务保活（接听时 App 在前台、权限已授予）
            CallForegroundService.start(context, s.isVideo)
            socketManager.emitCallResponse(s.peerId, true)
            // 等待主叫的 call:offer
        }
    }

    /** 被叫拒接 */
    fun reject() {
        val s = _state.value
        if (s.peerId.isNotEmpty()) socketManager.emitCallResponse(s.peerId, false)
        cleanup(CallStage.ENDED)
    }

    /** 挂断（任一方） */
    fun hangup() {
        val s = _state.value
        if (s.peerId.isNotEmpty()) socketManager.emitCallEnd(s.peerId)
        cleanup(CallStage.ENDED)
    }

    fun toggleMic() {
        val enabled = !_state.value.micEnabled
        localAudioTrack?.setEnabled(enabled)
        _state.update { it.copy(micEnabled = enabled) }
    }

    fun toggleCamera() {
        val enabled = !_state.value.cameraEnabled
        localVideoTrack?.setEnabled(enabled)
        _state.update { it.copy(cameraEnabled = enabled) }
    }

    fun switchCamera() {
        (videoCapturer as? CameraVideoCapturer)?.switchCamera(null)
    }

    fun consumeEnded() {
        if (_state.value.stage == CallStage.ENDED) _state.value = CallState()
    }

    /**
     * 由后台 FCM 来电推送触发进入 INCOMING（App 被通知拉起、socket 可能尚未重连时）。
     * 幂等：若已在展示同一来电或正在通话则不覆盖；socket 后续补发 call:incoming 会因 peer 相同被去重。
     */
    fun incomingFromPush(from: String, callType: String, callerName: String) {
        if (from.isEmpty()) return
        val st = _state.value
        // 空闲或结束态才进 incoming；已在处理同一 peer 的来电则忽略（避免覆盖 socket 已建立的状态）
        if (st.stage != CallStage.IDLE && st.stage != CallStage.ENDED) return
        _state.value = CallState(
            CallStage.INCOMING, from, callerName, isVideo = callType == "video", isCaller = false,
        )
        startIncomingRing()
        startCallFgsBestEffort(callType == "video")   // 响铃期保活（尽力而为，不满足条件则跳过）
    }

    /**
     * 后台响铃期起 FGS 会被系统拒绝（Android 12+ 后台启动限制）或抛权限异常
     * （Android 14+ microphone 型 FGS 强校验 RECORD_AUDIO），故只在满足条件时尝试：
     * App 在前台 且（SDK<34 或已授予 RECORD_AUDIO）。不满足则跳过、不报错——响铃仍由
     * vxin_calls_v2 通知 + fullScreenIntent 覆盖，FGS 只是 Doze 保活增强，非必需。
     */
    private fun canStartCallFgs(): Boolean {
        if (!com.vxin.app.core.push.MessageNotificationBridge.appForeground) return false
        if (android.os.Build.VERSION.SDK_INT < 34) return true
        return context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun startCallFgsBestEffort(video: Boolean) {
        if (!canStartCallFgs()) return
        runCatching { CallForegroundService.start(context, video) }.onFailure { e ->
            if (e is SecurityException ||
                (android.os.Build.VERSION.SDK_INT >= 31 && e is android.app.ForegroundServiceStartNotAllowedException)
            ) {
                Log.w(TAG, "响铃期起前台服务被拒(尽力而为,不影响响铃/通知): ${e.message}")
            }
        }
    }

    // ── 信令处理 ───────────────────────────────────────────
    private fun observeSignaling() {
        scope.launch {
            socketManager.callIncomingEvents.collect { e ->
                // 已在展示同一 peer 的来电（如先由 FCM 推送进入 INCOMING）→ 忽略重复，勿误拒
                if (_state.value.stage == CallStage.INCOMING && _state.value.peerId == e.from) return@collect
                if (_state.value.stage != CallStage.IDLE && _state.value.stage != CallStage.ENDED) {
                    // 忙线：直接拒接
                    socketManager.emitCallResponse(e.from, false)
                    return@collect
                }
                _state.value = CallState(
                    CallStage.INCOMING, e.from, e.callerName, isVideo = e.type == "video", isCaller = false,
                )
                startIncomingRing()                                   // 来电就该响，前台也播
                startCallFgsBestEffort(e.type == "video")             // 响铃期保活（尽力而为）
                // ── 锁屏/后台来电通知 ────────────────────────────────────────
                // socket 连着时服务端不发 FCM，须由此处补弹全屏来电通知。
                // App 在前台时 CallHost 会渲染来电 UI，无需重复弹通知。
                if (!com.vxin.app.core.push.MessageNotificationBridge.appForeground) {
                    notificationHelper.showCallNotification(
                        callId = e.from,   // callId 用 peerId 兜底（socket 路径无独立 callId）
                        from = e.from,
                        callerName = e.callerName,
                        callType = e.type,
                    )
                }
            }
        }
        scope.launch {
            socketManager.callResponseEvents.collect { e ->
                val s = _state.value
                if (!s.isCaller || e.from != s.peerId) return@collect
                if (e.accepted) {
                    _state.update { it.copy(stage = CallStage.CONNECTING) }
                    createOfferAndSend()
                } else {
                    cleanup(CallStage.ENDED)
                }
            }
        }
        scope.launch {
            socketManager.callOfferEvents.collect { e ->
                if (e.from != _state.value.peerId) return@collect
                val pc = peerConnection ?: return@collect
                pc.setRemoteDescription(object : SimpleSdpObserver() {
                    override fun onSetSuccess() {
                        drainIce()   // 锁内置位 remoteDescSet 并排空缓存的候选
                        createAnswerAndSend()
                    }
                }, SessionDescription(SessionDescription.Type.OFFER, e.sdp))
            }
        }
        scope.launch {
            socketManager.callAnswerEvents.collect { e ->
                if (e.from != _state.value.peerId) return@collect
                val pc = peerConnection ?: return@collect
                pc.setRemoteDescription(object : SimpleSdpObserver() {
                    override fun onSetSuccess() { drainIce() }   // 锁内置位 remoteDescSet 并排空
                }, SessionDescription(SessionDescription.Type.ANSWER, e.sdp))
            }
        }
        scope.launch {
            socketManager.callIceEvents.collect { e ->
                if (e.from != _state.value.peerId) return@collect
                val cand = IceCandidate(e.sdpMid, e.sdpMLineIndex, e.candidate)
                // 锁内「判断 + 加入/直排」原子化：与 drainIce 的「置位 + 排空」互斥，杜绝候选丢失竞态。
                synchronized(iceLock) {
                    if (remoteDescSet) peerConnection?.addIceCandidate(cand) else pendingIce.add(cand)
                }
            }
        }
        scope.launch {
            socketManager.callEndEvents.collect { e ->
                if (e.from == _state.value.peerId) cleanup(CallStage.ENDED)
            }
        }
    }

    // 锁内「置位 remoteDescSet + 排空缓存候选」原子化：与 ICE 收集器的「判断 + 加入」互斥。
    // 置位与排空必须在同一临界区，否则先置位、排空前 ICE 线程读到 true 直排、本方再排空旧队列，
    // 顺序虽不丢但仍有窗口；一并纳入锁最稳。
    private fun drainIce() {
        synchronized(iceLock) {
            remoteDescSet = true
            pendingIce.forEach { peerConnection?.addIceCandidate(it) }
            pendingIce.clear()
        }
    }

    private fun createOfferAndSend() {
        val pc = peerConnection ?: return
        pc.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(desc: SessionDescription) {
                pc.setLocalDescription(SimpleSdpObserver(), desc)
                socketManager.emitCallOffer(_state.value.peerId, desc.description)
            }
        }, mediaConstraints())
    }

    private fun createAnswerAndSend() {
        val pc = peerConnection ?: return
        pc.createAnswer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(desc: SessionDescription) {
                pc.setLocalDescription(SimpleSdpObserver(), desc)
                socketManager.emitCallAnswer(_state.value.peerId, desc.description)
            }
        }, mediaConstraints())
    }

    private fun mediaConstraints() = MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (_state.value.isVideo) "true" else "false"))
    }

    // ── WebRTC 构建 ────────────────────────────────────────
    private fun createPeerConnection() {
        val f = factory ?: return
        synchronized(iceLock) { remoteDescSet = false; pendingIce.clear() }
        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        peerConnection = f.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                socketManager.emitCallIce(_state.value.peerId, candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex)
            }
            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>?) {
                (receiver.track() as? VideoTrack)?.let { vt ->
                    remoteVideoTrack = vt
                    _state.update { it.copy(remoteVideoActive = true) }
                }
            }
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                when (state) {
                    PeerConnection.IceConnectionState.CONNECTED,
                    PeerConnection.IceConnectionState.COMPLETED -> {
                        if (_state.value.connectedAt == 0L && _state.value.stage != CallStage.ENDED) playConnectedTone() // 首次接通→停回铃+接通音
                        _state.update {
                            if (it.stage != CallStage.ENDED)
                                it.copy(stage = CallStage.CONNECTED, connectedAt = if (it.connectedAt == 0L) android.os.SystemClock.elapsedRealtime() else it.connectedAt)
                            else it
                        }
                    }
                    PeerConnection.IceConnectionState.DISCONNECTED,
                    PeerConnection.IceConnectionState.FAILED,
                    PeerConnection.IceConnectionState.CLOSED -> { /* 由 call:end 或用户挂断收尾 */ }
                    else -> {}
                }
            }
            override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
            override fun onAddStream(p0: MediaStream?) {}
            override fun onRemoveStream(p0: MediaStream?) {}
            override fun onDataChannel(p0: org.webrtc.DataChannel?) {}
            override fun onRenegotiationNeeded() {}
        })
    }

    private fun createLocalTracks(video: Boolean) {
        val f = factory ?: return
        val pc = peerConnection ?: return
        // 音频
        audioSource = f.createAudioSource(MediaConstraints())
        localAudioTrack = f.createAudioTrack("audio0", audioSource).apply { setEnabled(true) }
        pc.addTrack(localAudioTrack, listOf(STREAM_ID))
        // 视频
        if (video) {
            val capturer = createCameraCapturer() ?: return
            videoCapturer = capturer
            surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
            videoSource = f.createVideoSource(false)
            capturer.initialize(surfaceHelper, context, videoSource!!.capturerObserver)
            runCatching { capturer.startCapture(1280, 720, 30) }
            localVideoTrack = f.createVideoTrack("video0", videoSource).apply { setEnabled(true) }
            pc.addTrack(localVideoTrack, listOf(STREAM_ID))
        }
    }

    private fun createCameraCapturer(): VideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val names = enumerator.deviceNames
        names.firstOrNull { enumerator.isFrontFacing(it) }?.let { return enumerator.createCapturer(it, null) }
        names.firstOrNull()?.let { return enumerator.createCapturer(it, null) }
        return null
    }

    // ── 清理 ──────────────────────────────────────────────
    private fun cleanup(finalStage: CallStage) {
        stopIncomingRing()                                 // 停被叫来电铃声（幂等，未响铃时 no-op）
        releaseTone()                                     // 停回铃/接通音并释放 ToneGenerator
        callTimeoutJob?.cancel(); callTimeoutJob = null   // 接通/挂断/被拒 → 取消呼出超时
        CallForegroundService.stop(context)               // 停前台服务（未起过则 no-op）
        notificationHelper.cancelCallNotification()        // 通话终结统一收口：清掉残留来电通知（幂等）
        runCatching { videoCapturer?.stopCapture() }
        runCatching { videoCapturer?.dispose() }
        videoCapturer = null
        surfaceHelper?.dispose(); surfaceHelper = null
        localVideoTrack = null
        remoteVideoTrack = null
        runCatching { videoSource?.dispose() }; videoSource = null
        runCatching { audioSource?.dispose() }; audioSource = null
        localAudioTrack = null
        runCatching { peerConnection?.close() }
        runCatching { peerConnection?.dispose() }
        peerConnection = null
        synchronized(iceLock) { remoteDescSet = false; pendingIce.clear() }
        val cur = _state.value
        val ended = if (cur.connectedAt > 0L && cur.endedAt == 0L) android.os.SystemClock.elapsedRealtime() else cur.endedAt
        _state.value = cur.copy(stage = finalStage, endedAt = ended)
    }

    // ── 通话提示音（回铃/接通）─────────────────────────────
    // 走 STREAM_VOICE_CALL：随听筒/扬声器路由，且不受媒体/通知音量与静音开关影响，与原生通话体验一致。
    @Volatile
    private var toneGen: android.media.ToneGenerator? = null

    private fun ensureToneGen(): android.media.ToneGenerator? {
        if (toneGen == null) {
            toneGen = runCatching {
                android.media.ToneGenerator(android.media.AudioManager.STREAM_VOICE_CALL, 70)
            }.getOrNull()
        }
        return toneGen
    }

    /** 主叫呼出→接通前的循环回铃音（“嘟——嘟——”）。 */
    @Synchronized
    private fun playRingbackTone() {
        runCatching { ensureToneGen()?.startTone(android.media.ToneGenerator.TONE_SUP_RINGTONE) }
    }

    /** 首次接通：停回铃并播一声短促接通提示音。 */
    @Synchronized
    private fun playConnectedTone() {
        val gen = ensureToneGen() ?: return
        runCatching { gen.stopTone() }
        runCatching { gen.startTone(android.media.ToneGenerator.TONE_PROP_ACK, 200) }
    }

    /** 停止并释放 ToneGenerator（通话结束/清理时调用；幂等）。 */
    @Synchronized
    private fun releaseTone() {
        runCatching { toneGen?.stopTone() }
        runCatching { toneGen?.release() }
        toneGen = null
    }

    // ── 被叫来电铃声 ───────────────────────────────────────
    // 被叫路径此前完全静音：只有主叫走 playRingbackTone；INCOMING 分支不播音、前台也不弹通知。
    // 用系统默认铃声循环播放（USAGE_NOTIFICATION_RINGTONE，随铃声音量/静音开关，与原生来电一致）；
    // MediaPlayer 初始化失败（如铃声 uri 不可用）时降级到 ToneGenerator 循环音。
    @Volatile
    private var ringPlayer: MediaPlayer? = null

    @Synchronized
    private fun startIncomingRing() {
        if (ringPlayer != null) return   // 幂等：已在响铃
        val started = runCatching {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE) ?: return@runCatching false
            val mp = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(context, uri)
                isLooping = true
                prepare()
                start()
            }
            ringPlayer = mp
            true
        }.getOrDefault(false)
        if (!started) {
            Log.w(TAG, "startIncomingRing: MediaPlayer 不可用，降级 ToneGenerator")
            runCatching { ensureToneGen()?.startTone(android.media.ToneGenerator.TONE_SUP_RINGTONE) }
        }
    }

    @Synchronized
    private fun stopIncomingRing() {
        runCatching { ringPlayer?.apply { if (isPlaying) stop(); release() } }
        ringPlayer = null
        runCatching { toneGen?.stopTone() }   // 若走了 ToneGenerator 降级路径，一并停止（不 release，供回铃音复用）
    }

    private companion object {
        const val STREAM_ID = "stream0"
        const val TAG = "CallManager"
    }
}

/** SdpObserver 默认空实现，按需重写 */
open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(desc: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String?) { Log.w("CallManager", "sdp create fail: $error") }
    override fun onSetFailure(error: String?) { Log.w("CallManager", "sdp set fail: $error") }
}
