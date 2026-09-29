// 消息类型 → 列表预览/通知/引用条里的简短文字。所有展示「一条消息的摘要」的地方都用它，
// 避免某处漏掉新类型后直接把 JSON content(转账、红包、拍一拍、名片)显示给用户。
const LABELS = {
  image: '[图片]',
  voice: '[语音]',
  video: '[视频]',
  file: '[文件]',
  sticker: '[表情]',
  contact_card: '[名片]',
  contact: '[名片]',
  red_packet: '[红包]',
  transfer: '[转账]',
  location: '[位置]',
};

export function typeLabel(type) {
  return LABELS[type] || null;
}

/** msg: { type, content, deleted }；me: 当前用户(用于拍一拍的「你」) */
export function messagePreview(msg, me = null) {
  if (!msg) return '';
  if (msg.deleted) return '消息已撤回';
  if (msg.type === 'nudge') {
    try {
      const n = JSON.parse(msg.content);
      const a = String(n.actor) === String(me?.id) ? '你' : (n.actorName || '某人');
      const b = String(n.target) === String(me?.id) ? '你' : (n.targetName || '某人');
      return `${a} 拍了拍 ${b}`;
    } catch { return '[拍一拍]'; }
  }
  const label = typeLabel(msg.type);
  if (label) return label;
  return typeof msg.content === 'string' ? msg.content : '';
}
