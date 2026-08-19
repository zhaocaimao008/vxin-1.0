'use strict';
/**
 * 后台安全：谷歌验证器(TOTP) + 可信设备/IP 白名单。
 * 策略「陌生设备/IP 拦截」：只有 (device_id, ip) 在白名单内才能直接登录；
 * 陌生组合必须提供正确的谷歌验证码，验证通过后该组合被加入白名单。
 */
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const { badRequest } = require('../../utils/http');
const totp = require('../../utils/totp');

// ── settings 读写 ──
function getSetting(key) { return db.prepare('SELECT value FROM admin_settings WHERE key=?').get(key)?.value ?? null; }
function setSetting(key, val) {
  db.prepare(`INSERT INTO admin_settings (key,value,updated_at) VALUES (?,?,strftime('%s','now'))
              ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, val);
}
function delSetting(key) { db.prepare('DELETE FROM admin_settings WHERE key=?').run(key); }

// ── 客户端信息 ──
function clientIp(req) {
  // 使用 Express 已按 trust proxy 解析的 req.ip，与路由层 IP 白名单来源一致，防 XFF 伪造
  const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';
  return ip.replace(/^::ffff:/, '');
}
function deviceLabel(ua = '') {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Linux/i.test(ua)) return 'Linux';
  return '浏览器';
}

// ── TOTP ──
function totpEnabled() { return getSetting('totp_enabled') === '1'; }
function totpSecret()  { return getSetting('totp_secret'); }
function verifyCode(code) {
  const secret = totpSecret();
  if (secret) {
    const lastCounter = parseInt(getSetting('totp_last_counter') || '0');
    const result = totp.verifyWithCounter(secret, code, 1, lastCounter);
    if (result.valid) {
      setSetting('totp_last_counter', String(result.counter));
      return true;
    }
  }
  // 恢复码兜底（一次性，丢失验证器时用于登录/关闭 TOTP）
  return verifyRecoveryCode(code);
}

// ── 恢复码（一次性，SHA-256 哈希存储，明文只展示一次）───────────
const RECOVERY_KEY = 'totp_recovery_codes';

function generateRecoveryCodes(count = 10) {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 位十六进制
    const code = raw.match(/.{1,4}/g).join('-'); // XXXX-XXXX-XXXX
    codes.push(code);
    hashes.push(crypto.createHash('sha256').update(raw).digest('hex'));
  }
  setSetting(RECOVERY_KEY, JSON.stringify(hashes));
  return codes;
}

function verifyRecoveryCode(code) {
  const raw = getSetting(RECOVERY_KEY);
  if (!raw) return false;
  let hashes;
  try { hashes = JSON.parse(raw); } catch { return false; }
  if (!Array.isArray(hashes)) return false;
  const input = String(code || '').trim().toUpperCase().replace(/-/g, '');
  const inputHash = crypto.createHash('sha256').update(input).digest('hex');
  const idx = hashes.findIndex(h => h === inputHash);
  if (idx === -1) return false;
  hashes[idx] = null; // 一次性使用
  setSetting(RECOVERY_KEY, JSON.stringify(hashes));
  return true;
}

function beginSetup() {
  const secret = totp.generateSecret();
  setSetting('totp_pending', secret); // 未启用，待验证后转正
  return { secret, otpauth: totp.otpauthURL(secret, { label: 'admin' }) };
}
function enableTotp(code) {
  const pending = getSetting('totp_pending');
  if (!pending) throw badRequest('请先获取绑定二维码');
  if (!totp.verify(pending, code)) throw badRequest('验证码错误，请确认手机时间与扫码无误');
  setSetting('totp_secret', pending);
  setSetting('totp_enabled', '1');
  delSetting('totp_pending');
}
function disableTotp(code) {
  if (!totpEnabled()) throw badRequest('谷歌验证未开启');
  if (!verifyCode(code)) throw badRequest('验证码错误');
  delSetting('totp_secret');
  delSetting('totp_enabled');
}

// ── 可信设备/IP ──
function isTrusted(deviceId, ip) {
  if (!deviceId) return false;
  return !!db.prepare('SELECT 1 FROM admin_trusted WHERE device_id=? AND ip=?').get(deviceId, ip);
}
function trust(deviceId, ip, label) {
  db.prepare(`INSERT INTO admin_trusted (id,device_id,ip,label) VALUES (?,?,?,?)
              ON CONFLICT(device_id,ip) DO UPDATE SET last_seen=strftime('%s','now')`)
    .run(uuidv4(), deviceId, ip, label || '');
}
function touch(deviceId, ip) {
  db.prepare("UPDATE admin_trusted SET last_seen=strftime('%s','now') WHERE device_id=? AND ip=?").run(deviceId, ip);
}
function listTrusted() {
  return db.prepare('SELECT id, device_id, ip, label, created_at, last_seen FROM admin_trusted ORDER BY last_seen DESC').all();
}
function revokeTrusted(id) {
  db.prepare('DELETE FROM admin_trusted WHERE id=?').run(id);
}

function status() {
  return { totpEnabled: totpEnabled(), trusted: listTrusted() };
}

module.exports = {
  clientIp, deviceLabel,
  totpEnabled, verifyCode, beginSetup, enableTotp, disableTotp,
  generateRecoveryCodes, verifyRecoveryCode,
  isTrusted, trust, touch, listTrusted, revokeTrusted, status,
};
