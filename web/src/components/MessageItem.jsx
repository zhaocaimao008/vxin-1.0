import React, { memo } from 'react';
import Avatar from './Avatar';
import { mediaUrl } from '../utils/url';
import { formatFull } from '../utils/time';
import VoicePlayer from './VoicePlayer';
import { showToast } from '../utils/toast';
import { downloadFile } from '../utils/download';
import { getAspect, rememberAspect } from '../utils/imgDimCache';
import { linkify } from '../utils/linkify';
import { IcoFile, IcoRedPacket, IcoTransfer } from './Icons';

// chat-window 改版：气泡内右下角时间戳只需要 HH:MM，不带日期——formatFull() 对非
// 当天消息会返回"昨天 HH:MM"/"M月D日 HH:MM"这种带日期的长字符串，塞进气泡角落的小
// 时间戳位会跟设计稿（每条消息都只显示 10:23 这种纯时间）对不上，所以气泡内联时间戳
// 单独用这个只取 HH:MM 的小函数，不复用 formatFull（气泡的 title 悬浮提示仍用
// formatFull，那里需要完整日期）。
function formatBubbleTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 图片加载失败占位图（过期/被删的云文件）：灰底 + 可见文字，保证不显示浏览器裂图
const IMG_BROKEN = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90'>" +
  "<rect width='120' height='90' fill='#f0f0f0'/>" +
  "<text x='60' y='49' font-size='12' fill='#999' text-anchor='middle'>图片加载失败</text></svg>"
);

// Time divider rendered as a list item
export const TimeDivider = memo(function TimeDivider({ time }) {
  return (
    <div className="wc-msg-time">
      <span>{formatFull(time * 1000)}</span>
    </div>
  );
});

const MessageItem = memo(function MessageItem({ item, cbRef, measure }) {
  const { msg, isMine, isLastMine, isSelected, isHighlighted, multiSelect,
    convType, userId, groupSettings, myGroupRole, members,
    consecutive } = item;

  const cbs = cbRef.current;

  // 拍一拍：居中系统提示「你 拍了拍 X」/「X 拍了拍 你」/「X 拍了拍 Y」
  if (msg.type === 'nudge') {
    let n;
    try { n = JSON.parse(msg.content); } catch { n = {}; }
    const actorName = String(n.actor) === String(userId) ? '你' : (n.actorName || '某人');
    const targetName = String(n.target) === String(userId) ? '你' : (n.targetName || '某人');
    return (
      <div className="wc-msg-time">
        <span>{actorName} 拍了拍 {targetName}</span>
      </div>
    );
  }

  const showRead      = isMine && msg._read      && convType === 'private';
  const showDelivered = isMine && msg._delivered && convType === 'private' && !msg._read;
  // 定时消息标记：由后端调度器发出的消息带 is_scheduled=1
  const isScheduled   = !!msg.is_scheduled;

  // 已读/发送状态图标：逻辑完全不变，只是渲染位置按 msg.type 二选一（见下方使用处）。
  const readReceiptEl = isMine ? (
    msg._status === 'sending' ? (
      <div className="wc-msg-read"><span className="wc-msg-spinner" /></div>
    ) : msg._status === 'error' ? (
      <div
        className="wc-msg-read wc-msg-status-error-icon"
        data-testid="msg-send-failed"
        title="发送失败，点击重发"
        role="button" tabIndex={0} aria-label="发送失败，点击重发"
        onClick={() => cbs.retryMessage(msg)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cbs.retryMessage(msg); } }}
      >❗</div>
    ) : isLastMine && convType === 'private' ? (
      showRead ? (
        /* 双勾-已读：绿色 */
        <div className="wc-msg-read wc-msg-status-read" data-testid="msg-read-status" title="已读">
          <svg className="wc-tick-icon wc-tick-read" viewBox="0 0 18 12" aria-hidden="true">
            <path d="M1 6l4 4L12 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M6 10l4-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M10 1l6 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      ) : showDelivered ? (
        /* 双勾-已送达：灰色 */
        <div className="wc-msg-read wc-msg-status-delivered" title="已送达">
          <svg className="wc-tick-icon wc-tick-delivered" viewBox="0 0 18 12" aria-hidden="true">
            <path d="M1 6l4 4L12 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M6 10l4-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M10 1l6 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      ) : (
        /* 单勾-已发送 */
        <div className="wc-msg-read wc-msg-status-sent" title="已发送">
          <svg className="wc-tick-icon wc-tick-sent" viewBox="0 0 12 10" aria-hidden="true">
            <path d="M1 5l3.5 3.5L11 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      )
    ) : null
  ) : null;

  const canClickAvatar = (() => {
    if (isMine || convType !== 'group') return true;
    if (!groupSettings.no_private_chat) return true;
    if (myGroupRole === 'owner' || myGroupRole === 'admin') return true;
    const senderMember = members.find(m => m.id === msg.sender_id);
    return senderMember?.role === 'owner' || senderMember?.role === 'admin';
  })();

  // 头像交互：单击与双击都打开好友资料卡（对齐用户直觉，双击必达资料页）。
  //   拍一拍(nudge) 改由资料卡内的「拍一拍」按钮触发，避免与看资料手势冲突、也更易发现。
  // 计时器句柄挂在事件的 currentTarget(DOM 节点)上，避免在 memo 组件里加 hook 破坏 hook 顺序。
  const doAvatarProfile = () => {
    if (!canClickAvatar) { showToast('群主已开启禁止私聊'); return; }
    if (!isMine) cbs.setShowUserProfile(msg.sender_id);
  };
  const handleAvatarClick = (e) => {
    if (isMine || multiSelect) { doAvatarProfile(); return; }
    const el = e.currentTarget;
    // 单击消抖：若紧接着来了双击，仍是打开资料卡（同一动作），避免连开两次
    if (el._openTimer) return;
    el._openTimer = setTimeout(() => { el._openTimer = null; doAvatarProfile(); }, 220);
  };
  const handleAvatarDblClick = (e) => {
    const el = e.currentTarget;
    if (el._openTimer) { clearTimeout(el._openTimer); el._openTimer = null; }
    doAvatarProfile(); // 双击 → 直达好友资料卡
  };

  return (
    <div
      id={`msg-${msg.id}`}
      data-msg-id={msg.id}
      className={`wc-msg-row${isMine ? ' mine' : ''}${consecutive ? ' consecutive' : ''}${multiSelect ? ' multiselect-row' : ''}${isHighlighted ? ' wc-msg-hl' : ''}`}
      onClick={multiSelect ? () => cbs.toggleMsgSelect(msg.id) : undefined}
      onKeyDown={multiSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cbs.toggleMsgSelect(msg.id); } } : undefined}
      role={multiSelect ? 'checkbox' : undefined}
      aria-checked={multiSelect ? isSelected : undefined}
      tabIndex={multiSelect ? 0 : undefined}
      style={multiSelect ? { cursor: 'pointer' } : {}}
    >
      {multiSelect && (
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 8, flexShrink: 0, alignSelf: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 'var(--radius-full)', border: `2px solid ${isSelected ? 'var(--green)' : 'var(--border-default)'}`, background: isSelected ? 'var(--green)' : 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background var(--dur-fast), border-color var(--dur-fast)' }}>
            {isSelected && <span style={{ color: 'var(--text-inverse)', fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
      )}
      <div
        className="wc-msg-avatar"
        onClick={!multiSelect ? handleAvatarClick : undefined}
        onDoubleClick={!multiSelect && !isMine ? handleAvatarDblClick : undefined}
        title={!isMine ? '点击查看资料' : undefined}
        style={{ cursor: !multiSelect && canClickAvatar && !isMine ? 'pointer' : 'default' }}
      >
        <Avatar src={msg.senderAvatar} name={msg.senderName} size={36} />
      </div>
      <div className="wc-msg-body">
        {!isMine && convType === 'group' && !consecutive && (
          <div
            className="wc-msg-sender"
            onClick={!multiSelect ? doAvatarProfile : undefined}
            role={!multiSelect && canClickAvatar ? 'button' : undefined}
            tabIndex={!multiSelect && canClickAvatar ? 0 : undefined}
            onKeyDown={!multiSelect && canClickAvatar ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doAvatarProfile(); } }) : undefined}
            style={!multiSelect && canClickAvatar ? { cursor: 'pointer' } : undefined}
            title={canClickAvatar ? '点击查看资料' : undefined}
          >{msg.senderName}</div>
        )}
        <div className="wc-msg-bubble-wrap">
          {/* chat-window 改版：文本消息的已读标记挪进气泡内部右下角(见下方
              wc-msg-time-small)，非文本消息(图片/文件/红包等，本轮不动)保持原来
              挂在气泡外侧的位置——readReceiptEl 只算一次，两处按 msg.type 二选一用。 */}
          {isMine && msg.type !== 'text' && readReceiptEl}
          {/* 定时消息标记：气泡左上角「定时」角标 */}
          {isScheduled && (
            <span
              data-testid="msg-scheduled-badge"
              title="定时发送的消息"
              style={{
                position: 'absolute', top: 2, left: isMine ? 'auto' : 2, right: isMine ? 2 : 'auto',
                fontSize: 'var(--text-2xs)', padding: '1px 5px', borderRadius: 'var(--radius-badge)',
                background: 'rgba(87,107,149,.85)', color: '#fff',
                pointerEvents: 'none', zIndex: 1,
              }}
            >定时</span>
          )}
          <div
            data-testid={`msg-bubble-${msg.id}`}
            className={`wc-msg-bubble ${isMine ? 'mine' : 'other'}`}
            title={msg.created_at ? formatFull(msg.created_at * 1000) : undefined}
            onContextMenu={e => cbs.handleContextMenu(e, msg)}
          >
            {msg.replyTo && (
              <div className={`wc-msg-reply gi-cp${(msg.type === 'image' || msg.type === 'video' || msg.type === 'sticker') ? ' wc-msg-reply--on-media' : ''}`} role="button" tabIndex={0} data-testid="msg-reply-preview"
                aria-label="跳转到被引用的消息"
                onClick={e => { e.stopPropagation(); cbs.scrollToMsg(msg.replyTo.id); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); cbs.scrollToMsg(msg.replyTo.id); } }}>
                <div className="wc-msg-reply-name">{msg.replyTo.senderName}</div>
                {!msg.replyTo.deleted && (msg.replyTo.type === 'image' || msg.replyTo.type === 'sticker') && msg.replyTo.file_url ? (
                  <div className="wc-msg-reply-media">
                    {/* width/height 显式声明：缩略图未解码前就按 34×34 预留盒子，
                        使本行首帧高度即等于 estimateHeight 的预留值，杜绝图片解码后
                        撑高本行、下一行事后回落造成的重叠/抖动。 */}
                    <img loading="lazy" width={34} height={34} decoding="async" src={mediaUrl(msg.replyTo.file_url)} alt="" className="wc-msg-reply-thumb"
                      onLoad={() => measure?.()}
                      onError={e => { e.currentTarget.style.display = 'none'; measure?.(); }} />
                  </div>
                ) : (
                  <div className="wc-msg-reply-text">
                    {msg.replyTo.deleted ? '消息已撤回' : msg.replyTo.type === 'image' ? '[图片]' : msg.replyTo.type === 'voice' ? '[语音]' : msg.replyTo.type === 'video' ? '[视频]' : msg.replyTo.type === 'red_packet' ? '[红包]' : msg.replyTo.type === 'file' ? '[文件]' : msg.replyTo.type === 'sticker' ? '[表情]' : (msg.replyTo.type === 'contact_card' || msg.replyTo.type === 'contact') ? '[名片]' : msg.replyTo.content}
                  </div>
                )}
              </div>
            )}
            {msg.type === 'text' && (
              <>
                <span>
                  {linkify(msg.content)}
                  {msg.edited ? <span className="wc-msg-edited" data-testid="msg-edited-flag" style={{ color: isMine ? 'rgba(0,0,0,.35)' : 'var(--text-tertiary)' }}>已编辑</span> : null}
                </span>
                {/* chat-window 改版：气泡内右下角时间戳 + (己方)已读标记，
                    只对文本消息生效——图片/文件等媒体卡片本轮不动，样式不受影响。
                    estimateHeight.js 的 TEXT_TIMESTAMP_ROW_HEIGHT 常量必须和这行的
                    实际高度保持一致，否则虚拟列表首帧行高估算会跟真实渲染脱节。 */}
                <div className="wc-msg-time-small" data-testid="msg-inline-time">
                  <span>{msg.created_at ? formatBubbleTime(msg.created_at * 1000) : ''}</span>
                  {readReceiptEl}
                </div>
              </>
            )}
            {msg.type === 'image' && (() => {
              const imgSrc = mediaUrl(msg.file_url);
              // 已知宽高比 → 预留正确高度，消除加载时的布局抖动(滚回历史不再跳)
              const aspect = getAspect(imgSrc);
              // aspect-ratio 需配合一个确定的宽度才能预留高度：竖图按 max-height 反推宽度，
              // 横图/方图取 max-width(240)，避免占位框比真实图片更宽。
              const aspectStyle = aspect
                ? { aspectRatio: String(aspect), width: aspect < 0.75 ? `${Math.round(320 * aspect)}px` : 'min(240px, 62vw)' }
                : undefined;
              return (
                <img loading="lazy"
                  data-testid="msg-image"
                  src={imgSrc}
                  alt="消息图片"
                  className="wc-msg-img"
                  style={aspectStyle}
                  decoding="async"
                  fetchPriority="auto"
                  width={aspect && aspect < 0.75 ? Math.round(320 * aspect) : 240}
                  height={aspect ? Math.round((aspect && aspect < 0.75 ? Math.round(320 * aspect) : 240) / aspect) : 180}
                  role="button" tabIndex={0} aria-label="查看大图"
                  onClick={() => cbs.setLightboxUrl(imgSrc)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cbs.setLightboxUrl(imgSrc); } }}
                  onLoad={e => {
                    const el = e.currentTarget;
                    rememberAspect(imgSrc, el.naturalWidth, el.naturalHeight);
                    el.classList.add('loaded');
                    // 图片解码完成→立即同步重测本行高度，修正 react-window 的预加载高度缓存。
                    // 仅靠 ResizeObserver(异步)在 Chromium/Electron 上可能晚于下一行按旧高排版，
                    // 导致下一条(文字)贴到/压到图片上。此处在 onLoad 直接测量，闭合竞态。
                    measure?.();
                    cbs.onImageLoad?.();
                  }}
                  onError={e => { const el = e.currentTarget; el.onerror = null; el.src = IMG_BROKEN; el.alt = '图片加载失败'; el.style.cursor = 'default'; el.style.pointerEvents = 'none'; el.tabIndex = -1; el.classList.add('loaded'); measure?.(); }}
                />
              );
            })()}
            {msg.type === 'voice' && (
              <VoicePlayer url={mediaUrl(msg.file_url)} msgId={msg.id} isMine={isMine} transcript={msg.transcript} />
            )}
            {msg.type === 'video' && (() => {
              const vidSrc = mediaUrl(msg.file_url);
              // 复用图片的宽高比缓存，视频加载 metadata 前也能预留正确高度,消除布局抖动
              const vAspect = getAspect(vidSrc);
              // 用 #t=0.1 让浏览器抓取首帧作为封面缩略图（不自动播放，点击才全屏播放）
              const posterSrc = vidSrc.includes('#') ? vidSrc : `${vidSrc}#t=0.1`;
              const openPreview = () => cbs.setVideoUrl?.({ url: vidSrc, name: msg.content });
              return (
                <div
                  className="wc-msg-video-wrap"
                  role="button" tabIndex={0} aria-label="播放视频"
                  onClick={openPreview}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(); } }}
                  style={{
                    position: 'relative', display: 'inline-block', cursor: 'pointer',
                    borderRadius: 'var(--radius-input, 8px)', overflow: 'hidden', background: '#000',
                    ...(vAspect ? { aspectRatio: String(vAspect), width: 'min(240px, 62vw)' } : { width: 'min(240px, 62vw)' }),
                  }}
                >
                  {/* 首帧缩略图（preload=metadata + #t=0.1 抓封面，不播放、不显控件） */}
                  <video
                    src={posterSrc}
                    preload="metadata"
                    muted
                    playsInline
                    tabIndex={-1}
                    className="wc-msg-video"
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    onLoadedMetadata={e => {
                      const v = e.currentTarget;
                      rememberAspect(vidSrc, v.videoWidth, v.videoHeight);
                      measure?.(); // 视频 metadata 到达→按真实宽高比撑开后同步重测本行
                    }}
                  />
                  {/* 中央播放按钮浮层 */}
                  <span aria-hidden="true" style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: '#fff', marginLeft: 3 }}>
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </span>
                </div>
              );
            })()}
            {msg.type === 'file' && (
              <a href={mediaUrl(msg.file_url)}
                 onClick={(e) => { e.preventDefault(); downloadFile(msg.file_url, msg.content); }}
                 className="wc-msg-file-link" data-testid="msg-file">
                <div className="wc-msg-file-icon"><IcoFile size={26} /></div>
                <div>
                  <div className="wc-msg-file-name">{msg.content}</div>
                  <div className="wc-msg-file-size">点击下载</div>
                </div>
              </a>
            )}
            {msg.type === 'sticker' && (
              <img loading="lazy" src={mediaUrl(msg.file_url || msg.content)} alt="sticker" className="wc-msg-sticker" onLoad={() => measure?.()} onError={e => { e.currentTarget.style.display = 'none'; measure?.(); }} style={{ maxWidth: 120, maxHeight: 120 }} />
            )}
            {msg.type === 'contact_card' && (() => {
              let card = {};
              try { card = JSON.parse(msg.content); } catch { card = {}; }
              return (
                <div
                  onClick={() => card.uid && cbs.setShowUserProfile(card.uid)}
                  className="wc-contact-card"
                  role="button" tabIndex={0}
                  aria-label={`查看${card.username || '用户'}的名片`}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && card.uid) { e.preventDefault(); cbs.setShowUserProfile(card.uid); } }}
                >
                  <div className="wc-contact-card-body">
                    <Avatar src={card.avatar} name={card.username} size={44} style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                    <div className="wc-contact-card-info">
                      <div className="wc-contact-card-name">{card.username || '用户'}</div>
                      {card.wechat_id && <div className="wc-contact-card-wechat">v信号：{card.wechat_id}</div>}
                    </div>
                  </div>
                  <div className="wc-contact-card-footer">个人名片</div>
                </div>
              );
            })()}
            {msg.type === 'red_packet' && (() => {
              let rp = {};
              try { rp = JSON.parse(msg.content); } catch { rp = {}; }
              return (
                <div
                  onClick={() => cbs.openRedPacket(rp.packetId)}
                  className="wc-redpacket-card"
                  role="button" tabIndex={0}
                  aria-label="打开红包"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cbs.openRedPacket(rp.packetId); } }}
                >
                  <div className="wc-redpacket-body">
                    <div className="wc-redpacket-icon"><IcoRedPacket size={28} /></div>
                    <div className="wc-redpacket-info">
                      <div className="wc-redpacket-greeting">
                        {rp.greeting || '恭喜发财，大吉大利'}
                      </div>
                      <div className="wc-redpacket-hint">点击领取红包</div>
                    </div>
                  </div>
                  <div className="wc-redpacket-footer">v信红包</div>
                </div>
              );
            })()}
            {msg.type === 'transfer' && (() => {
              let tf;
              try { tf = JSON.parse(msg.content); } catch { tf = {}; }
              // 转账即到账，无需收款按钮，直接显示已收钱状态
              const isReceiver = !isMine;
              return (
                <div className="wc-transfer-card" aria-label={`转账 ${tf.amount} 金币`}>
                  <div className="wc-transfer-body">
                    <div className="wc-transfer-icon"><IcoTransfer size={26} /></div>
                    <div className="wc-transfer-info">
                      <div className="wc-transfer-amount">¥ {tf.amount} 金币</div>
                      {tf.note ? <div className="wc-transfer-note">{tf.note}</div> : null}
                    </div>
                  </div>
                  <div className="wc-transfer-footer">
                    {isReceiver ? '已收钱' : '转账成功'}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        {convType === 'group' && isMine && msg.readCount > 0 && (
          <div className="wc-group-read-count">{msg.readCount}人已读</div>
        )}
        {msg.reactions?.length > 0 && (
          <div className="wc-reactions">
            {msg.reactions.map(r => (
              <div
                key={r.emoji}
                className={`wc-reaction-pill${r.userIds.map(String).includes(String(userId)) ? ' mine' : ''}`}
                onClick={() => cbs.toggleReaction(msg.id, r.emoji)}
                role="button" tabIndex={0}
                aria-label={`${r.emoji} ${r.count > 1 ? r.count + '人' : ''}${r.userIds.map(String).includes(String(userId)) ? '，已回应' : '，点击回应'}`}
                aria-pressed={r.userIds.map(String).includes(String(userId))}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cbs.toggleReaction(msg.id, r.emoji); } }}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span>{r.count}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => prev.item === next.item && prev.cbRef === next.cbRef && prev.measure === next.measure);

export default MessageItem;
