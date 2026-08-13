/**
 * 输入净化工具（纵深防御）
 *
 * 后端已做参数化查询（防 SQL 注入）和 DOMPurify（防 XSS），
 * 前端在发送前也做基础净化，实现双重防护。
 *
 * 注意：这不是安全的唯一防线，只是纵深防御的一环。
 */

/**
 * 净化用户名/群名等短文本输入
 * - 去掉首尾空格
 * - 折叠连续空格
 * - 长度裁剪
 * - 移除控制字符（0x00-0x1F 除 \t\n\r 外）
 */
export function sanitizeText(text, maxLen = 100) {
  if (typeof text !== 'string') return '';
  /* eslint-disable no-control-regex */
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 控制字符
    .replace(/\s+/g, ' ')                                 // 折叠空格
    .trim()
    .slice(0, maxLen);
  /* eslint-enable no-control-regex */
}

/**
 * 净化消息内容（允许换行，但移除控制字符）
 */
export function sanitizeMessage(text, maxLen = 2000) {
  if (typeof text !== 'string') return '';
  /* eslint-disable no-control-regex */
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 控制字符（保留 \t \n \r）
    .slice(0, maxLen);
  /* eslint-enable no-control-regex */
}

/**
 * 净化 URL（确保只有 http/https 协议，防止 javascript: XSS）
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return url;
  } catch {
    return '';
  }
}

/**
 * 净化文件名（移除路径分隔符和特殊字符）
 */
export function sanitizeFilename(name) {
  if (typeof name !== 'string') return 'file';
  return name
    .replace(/[/\\:*?"<>|]/g, '_') // Windows/Unix 非法文件名字符
    .replace(/\.{2,}/g, '.')         // 防止路径穿越 ../
    .replace(/^\.+/, '')             // 去掉开头的 .
    .trim()
    .slice(0, 255)
    || 'file';
}
