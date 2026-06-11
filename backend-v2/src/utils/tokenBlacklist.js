'use strict';
/**
 * Token 黑名单 —— 支持内存和 Redis 存储（生产用 Redis）
 * Logout 时加入黑名单，拒绝后续使用
 */

const redis = require('redis');

let redisClient = null;
let useRedis = false;

// 本地备用黑名单（Redis 不可用时）
const memoryBlacklist = new Set();

async function initRedis() {
  try {
    redisClient = redis.createClient({
      host: 'localhost',
      port: 6379,
      db: 1,  // 使用 db 1，cache 用 db 0
    });

    redisClient.on('error', err => {
      console.warn('[TokenBlacklist] Redis error, falling back to memory:', err.message);
      useRedis = false;
    });

    await redisClient.connect();
    useRedis = true;
    console.log('[TokenBlacklist] Using Redis storage');
  } catch (err) {
    console.warn('[TokenBlacklist] Redis unavailable, using memory fallback:', err.message);
    useRedis = false;
  }
}

/**
 * 将 token 加入黑名单
 * @param {string} token - JWT token
 * @param {number} expiresAt - token 过期时间戳（秒）
 */
async function addToBlacklist(token, expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = expiresAt - now;

  if (ttl <= 0) return;

  const key = `blacklist:${token}`;

  try {
    if (useRedis && redisClient) {
      // Redis: 设置 key，过期时间为 ttl
      await redisClient.setEx(key, ttl, '1');
    } else {
      // 内存：加入 Set，定时删除
      memoryBlacklist.add(token);
      setTimeout(() => memoryBlacklist.delete(token), ttl * 1000);
    }
  } catch (err) {
    console.error('[TokenBlacklist] Add error:', err.message);
    // 降级到内存
    memoryBlacklist.add(token);
    setTimeout(() => memoryBlacklist.delete(token), ttl * 1000);
  }
}

/**
 * 检查 token 是否在黑名单中
 * @param {string} token - JWT token
 * @returns {boolean}
 */
async function isBlacklisted(token) {
  const key = `blacklist:${token}`;

  try {
    if (useRedis && redisClient) {
      const exists = await redisClient.exists(key);
      return exists === 1;
    }
  } catch (err) {
    console.error('[TokenBlacklist] Check error:', err.message);
  }

  // 降级到内存检查
  return memoryBlacklist.has(token);
}

/**
 * 清空黑名单（仅用于测试）
 */
async function clear() {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys('blacklist:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (err) {
    console.error('[TokenBlacklist] Clear error:', err.message);
  }
  memoryBlacklist.clear();
}

// 启动时初始化 Redis
initRedis();

module.exports = { addToBlacklist, isBlacklisted, clear };
