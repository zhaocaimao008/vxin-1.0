'use strict';
/**
 * Redis 缓存工具 —— 支持对话列表、用户信息、搜索结果
 * TTL: 对话列表 5min, 用户信息 30min, 搜索 10min
 */

const redis = require('redis');

let client = null;

function init() {
  if (client) return Promise.resolve();

  client = redis.createClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  return new Promise((resolve, reject) => {
    client.on('error', err => console.error('[Redis Cache] Error:', err));
    client.on('connect', () => {
      console.log('[Redis Cache] Connected');
      resolve();
    });
    client.connect().catch(reject);
  });
}

// 缓存键生成器
const keys = {
  conversations: userId => `conv:${userId}`,
  user: userId => `user:${userId}`,
  search: (userId, query) => `search:${userId}:${query}`,
  userSessions: userId => `sessions:${userId}`,
};

// 获取缓存
async function get(key) {
  try {
    if (!client) await init();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[Cache] Get error:', err.message);
    return null;
  }
}

// 设置缓存（带 TTL）
async function set(key, value, ttlSeconds = 300) {
  try {
    if (!client) await init();
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error('[Cache] Set error:', err.message);
  }
}

// 删除缓存
async function del(key) {
  try {
    if (!client) await init();
    await client.del(key);
  } catch (err) {
    console.error('[Cache] Del error:', err.message);
  }
}

// 删除匹配模式的缓存（如用户的所有缓存）
async function delPattern(pattern) {
  try {
    if (!client) await init();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    console.error('[Cache] DelPattern error:', err.message);
  }
}

// 清空所有缓存
async function flush() {
  try {
    if (!client) await init();
    await client.flushDb();
  } catch (err) {
    console.error('[Cache] Flush error:', err.message);
  }
}

module.exports = {
  init,
  keys,
  get,
  set,
  del,
  delPattern,
  flush,
};
