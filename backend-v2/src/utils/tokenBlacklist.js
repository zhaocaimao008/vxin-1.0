'use strict';
/**
 * Token 黑名单（内存存储，可选扩展到 Redis）
 * Logout 时加入黑名单，拒绝后续使用
 */

// 内存黑名单（生产环境可改为 Redis）
const blacklist = new Set();

/**
 * 将 token 加入黑名单
 * @param {string} token - JWT token
 * @param {number} expiresAt - token 过期时间戳（秒）
 */
function addToBlacklist(token, expiresAt) {
  blacklist.add(token);

  // 在 token 过期时自动删除（释放内存）
  const now = Math.floor(Date.now() / 1000);
  const ttl = expiresAt - now;
  if (ttl > 0) {
    setTimeout(() => blacklist.delete(token), ttl * 1000);
  }
}

/**
 * 检查 token 是否在黑名单中
 * @param {string} token - JWT token
 * @returns {boolean}
 */
function isBlacklisted(token) {
  return blacklist.has(token);
}

/**
 * 清空黑名单（仅用于测试）
 */
function clear() {
  blacklist.clear();
}

module.exports = { addToBlacklist, isBlacklisted, clear };
