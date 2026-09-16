'use strict';
const http = require('http');
const https = require('https');

/** HTTPS by default; an explicitly selected HTTP backend may opt in. Update feeds cannot downgrade. */
function fetchBuffer(url, { allowMissing = false, allowHttp = false, timeout = 15000, maxBytes = 5 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : (allowHttp && target.protocol === 'http:' ? http : null);
    if (!transport) return reject(new Error('仅支持 HTTPS；自定义 HTTP 服务器需显式允许'));
    const req = transport.get(target, { timeout }, res => {
      if (allowMissing && (res.statusCode === 404 || res.statusCode === 403)) {
        res.resume(); resolve(null); return;
      }
      if (res.statusCode !== 200) {
        res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) { reject(new Error('响应超过大小上限')); res.destroy(); req.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('响应传输中断')));
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}

module.exports = { fetchBuffer };
