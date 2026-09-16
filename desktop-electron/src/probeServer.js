'use strict';
const { fetchBuffer } = require('./fetchBuffer');

// Probe only /health, without session credentials or redirects. Return no response body to the renderer.
async function probeServer(value) {
  let url;
  try {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) throw Error();
    url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error();
  } catch { return { ok: false, msg: '请输入有效的 http:// 或 https:// 服务器地址' }; }
  try {
    const body = await fetchBuffer(url.href.replace(/\/+$/, '') + '/health', { allowHttp: true, timeout: 6000, maxBytes: 65536 });
    const data = JSON.parse(body.toString('utf8'));
    return data?.ok === true && data?.db === 'ok'
      ? { ok: true, msg: '连接成功 ✓' }
      : { ok: false, msg: '该地址不是可用的 v信服务器' };
  } catch (error) {
    const status = /^HTTP (\d{3})$/.exec(error.message)?.[1];
    return { ok: false, msg: status ? `服务器返回 ${status}` : '无法连接到该服务器' };
  }
}
module.exports = { probeServer };
