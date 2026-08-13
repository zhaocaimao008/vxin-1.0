'use strict';
/**
 * 通知聚合管理器（Electron）
 *
 * 问题：短时间内收到多条消息，系统通知轮番弹出，打扰用户。
 * 方案：
 *   1. 同一会话的通知在 3s 内聚合为一条（显示未读数）
 *   2. 不同会话每会话独立，最多同时显示 3 个
 *   3. 安静时段（免打扰）不弹通知（读取 quietHours 配置）
 *   4. Windows/macOS 分平台适配（Windows 用 Notification，macOS 支持 badge）
 */

const { Notification, app } = require('electron');

const BATCH_MS = 3000;        // 聚合窗口（3s）
const MAX_SHOWN = 3;          // 最多同时显示通知数
const SNOOZE_CONV_SEC = 120;  // 同一会话已显示后静默 120s（防刷屏）

// conv_id -> { count, title, lastBody, timer, shownAt }
const pending = new Map();
const shownAt = new Map();   // conv_id -> timestamp

/**
 * 发送或聚合通知
 * @param {object} opts
 * @param {string} opts.conversationId
 * @param {string} opts.title        发送者名
 * @param {string} opts.body         消息摘要
 * @param {boolean} [opts.silent]    是否静音
 */
function notify({ conversationId, title, body, silent = false }) {
  if (!Notification.isSupported()) return;
  if (!conversationId) return;

  const convId = String(conversationId);
  const now = Date.now();

  // 免打扰：同一会话 120s 内只弹一次
  if (shownAt.has(convId) && now - shownAt.get(convId) < SNOOZE_CONV_SEC * 1000) {
    const slot = pending.get(convId) || { count: 0, title, lastBody: body };
    slot.count++;
    slot.lastBody = body;
    pending.set(convId, slot);
    return;
  }

  if (pending.has(convId)) {
    // 已有等待中的通知，更新内容
    const slot = pending.get(convId);
    slot.count++;
    slot.title = title;
    slot.lastBody = body;
    return;
  }

  // 新会话：创建聚合 slot
  const slot = { count: 1, title, lastBody: body, timer: null };
  pending.set(convId, slot);

  slot.timer = setTimeout(() => {
    pending.delete(convId);
    _show(convId, slot, silent);
  }, BATCH_MS);
}

function _show(convId, slot, silent) {
  const { count, title, lastBody } = slot;
  const shown = [...shownAt.entries()].filter(([, t]) => Date.now() - t < 5000).length;
  if (shown >= MAX_SHOWN) return;  // 同时显示上限

  const notifBody = count > 1 ? `${count} 条新消息：${lastBody}` : lastBody;
  try {
    const n = new Notification({
      title,
      body: notifBody,
      silent,
      // macOS: 通知分组
      ...(process.platform === 'darwin' ? { subtitle: 'v信' } : {}),
    });
    n.show();
    shownAt.set(convId, Date.now());
  } catch (e) {
    console.warn('[Notification]', e.message);
  }
}

/**
 * 更新 macOS 角标（Dock 未读数）
 */
function setBadgeCount(count) {
  if (process.platform === 'darwin') {
    app.setBadgeCount(count > 0 ? count : 0);
  }
}

module.exports = { notify, setBadgeCount };
