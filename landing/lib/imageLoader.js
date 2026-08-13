/**
 * Next.js 自定义图片 Loader（静态导出专用）
 *
 * 策略：
 * - 本地图片（/images/...）→ 直接返回原路径（Nginx/CDN 侧处理格式转换）
 * - 外部图片（https://...）→ 透传原 URL，由浏览器决定
 *
 * Nginx 侧配置 WebP 自动转换（已在 nginx.conf 中添加）：
 *   add_header Vary "Accept";
 *   if ($http_accept ~* "webp") { rewrite ^(/images/.+)\.(png|jpg)$ $1.webp; }
 *
 * 扩展：换 Cloudflare 时将 URL 改为:
 *   return `https://dipsin.com/cdn-cgi/image/width=${width},format=auto/${src}`;
 */
export default function imageLoader({ src, width, quality }) {
  if (src.startsWith('http')) return src;  // 外部图片直接透传
  // Cloudflare Image Resizing（如果启用）
  if (process.env.NEXT_PUBLIC_CDN_HOST) {
    return `${process.env.NEXT_PUBLIC_CDN_HOST}/cdn-cgi/image/width=${width},quality=${quality || 85},format=auto${src}`;
  }
  // 默认：返回原路径，由 Nginx 处理 WebP 转换
  return src;
}
