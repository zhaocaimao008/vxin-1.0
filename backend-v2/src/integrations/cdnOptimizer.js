'use strict';
/**
 * CDN 加速 + 静态资源优化
 * 压缩响应、缓存头、资源指纹、预加载提示
 */
const path = require('path');
const crypto = require('crypto');

// CDN 域名（从环境变量读取，空则回退到本地）
const CDN_BASE = process.env.CDN_BASE_URL || '';

// 静态资源缓存策略
const CACHE_POLICIES = {
  // 内容不变资源（图片/视频/附件）- 1年强缓存
  immutable: 'public, max-age=31536000, immutable',
  // 版本化资源（带 hash 的 JS/CSS）- 1年强缓存
  versioned: 'public, max-age=31536000, immutable',
  // 普通 API 响应 - 不缓存
  noStore: 'no-store, no-cache, must-revalidate',
  // 公共数据（如配置）- 短期缓存
  short: 'public, max-age=300, stale-while-revalidate=60',
};

// 根据扩展名推断最佳 Cache-Control
function getCachePolicy(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const media = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg',
                  '.mp4', '.webm', '.mp3', '.ogg', '.wav',
                  '.pdf', '.zip', '.tar', '.gz'];
  if (media.includes(ext)) return CACHE_POLICIES.immutable;
  if (['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) return CACHE_POLICIES.versioned;
  return CACHE_POLICIES.short;
}

// 将本地 /uploads/xxx 路径重写为 CDN URL
function toCdnUrl(localUrl) {
  if (!CDN_BASE || !localUrl || localUrl.startsWith('/uploads/')) return localUrl;
  if (localUrl.startsWith('http://') || localUrl.startsWith('https://')) return localUrl;
  const clean = localUrl.replace(/^\/uploads\//, '');
  return `${CDN_BASE.replace(/\/$/, '')}/uploads/${clean}`;
}

// 批量重写响应体中的 /uploads/ URL
function rewriteUrlsInObject(obj) {
  if (!CDN_BASE) return obj;
  if (!obj || typeof obj !== 'object') return obj;

  const str = JSON.stringify(obj);
  const rewritten = str.replace(/\/uploads\//g, `${CDN_BASE.replace(/\/$/, '')}/uploads/`);
  try {
    return JSON.parse(rewritten);
  } catch {
    return obj;
  }
}

// 计算文件内容的 ETag（弱 ETag，轻量）
function computeEtag(content) {
  return `"${crypto.createHash('md5').update(content).digest('hex').slice(0, 16)}"`;
}

/**
 * Express 中间件：为 /uploads 静态资源添加最优缓存头
 */
function uploadsCacheMiddleware(req, res, next) {
  // 上传附件的权限由下载门控决定，不得提升 private/no-store 为 public。
  // 追加 CDN 友好的安全头
  res.setHeader('Vary', 'Accept-Encoding, Accept');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}

/**
 * Express 中间件：自动将 API 响应中的 /uploads/ 替换成 CDN URL
 */
function cdnRewriteMiddleware(req, res, next) {
  // 受保护的 /uploads 必须经过应用鉴权，不能重写到绕过门控的公共 CDN。
  return next();


}

/**
 * 添加资源预加载提示（Link: rel=preload header）
 */
function addPreloadHints(res, resources = []) {
  const links = resources.map(({ url, as, type }) => {
    let hint = `<${url}>; rel=preload; as=${as}`;
    if (type) hint += `; type=${type}`;
    return hint;
  });
  if (links.length > 0) {
    res.setHeader('Link', links.join(', '));
  }
}

/**
 * 获取 CDN 配置状态
 */
function getCdnStatus() {
  return {
    cdnEnabled: !!CDN_BASE,
    cdnBase: CDN_BASE || '(本地，未配置 CDN)',
    policies: CACHE_POLICIES,
  };
}

module.exports = {
  toCdnUrl,
  rewriteUrlsInObject,
  computeEtag,
  uploadsCacheMiddleware,
  cdnRewriteMiddleware,
  addPreloadHints,
  getCdnStatus,
  CACHE_POLICIES,
};
