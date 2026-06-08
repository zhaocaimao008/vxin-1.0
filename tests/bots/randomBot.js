/**
 * 随机行为机器人
 * 模拟真实用户：发消息、撤回、引用、点赞、改群公告、@成员 等
 */
const api    = require('../utils/api');
const { connectSocket, waitForEvent, sendMessage } = require('../utils/socket');
const rep    = require('../utils/reporter');
const FormData = require('form-data');
const axios    = require('axios');
const cfg    = require('../config');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }

const TEXT_POOL = [
  '你好啊', '在吗？', '哈哈哈哈', '好的收到', '稍等一下',
  '明白了', '666', '牛啊', '有道理', '不对吧',
  '我来测试一下', '今天天气不错', '晚饭吃什么', '加班中…',
  '马上好', '等我一下', '好的好的', '了解了解',
];
const EMOJI_POOL = ['😀','😂','🥰','😎','🤔','👍','🎉','🔥','💯','✅','❤️','🙏'];
const REACTIONS  = ['👍','❤️','😂','😮','😢','🔥'];

function minimalPng() {
  const zlib = require('zlib');
  const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  function chunk(type, data) {
    const c = Buffer.concat([type, data]);
    let crc = 0xFFFFFFFF;
    for (const b of c) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0); }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, type, data, crcBuf]);
  }
  const ihdr = chunk(Buffer.from('IHDR'), Buffer.from([0,0,0,1,0,0,0,1,8,2,0,0,0]));
  const idat = chunk(Buffer.from('IDAT'), zlib.deflateSync(Buffer.from([0,0xFF,0xFF,0xFF])));
  const iend = chunk(Buffer.from('IEND'), Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// 单个机器人的行为循环
async function botLoop(account, convId, peers, stopAt) {
  const client = api.clientFromAccount(account);
  let socket;
  try {
    socket = await connectSocket(client.getCookie());
    socket.emit('join_conversation', { conversationId: convId });
    await sleep(200 + rand(300));
  } catch (e) {
    rep.fail(`bot:connect:${account.username}`, e, 'medium');
    return;
  }

  const recentMsgIds = [];

  while (Date.now() < stopAt) {
    try {
      const action = rand(100);

      if (action < 40) {
        // 40% — 发文字
        const text = rand(3) === 0
          ? pick(EMOJI_POOL) + ' ' + pick(TEXT_POOL)
          : pick(TEXT_POOL);
        const msg = await sendMessage(socket, convId, text);
        recentMsgIds.push(msg.id);
        if (recentMsgIds.length > 10) recentMsgIds.shift();

      } else if (action < 50 && recentMsgIds.length) {
        // 10% — 撤回自己最近的消息
        const msgId = pick(recentMsgIds);
        try {
          await client.delete(`/api/messages/${msgId}`, { data: { forEveryone: false } });
        } catch {}

      } else if (action < 60 && recentMsgIds.length) {
        // 10% — 引用回复
        const replyTo = pick(recentMsgIds);
        socket.emit('send_message', {
          conversationId: convId,
          content: '引用: ' + pick(TEXT_POOL),
          type: 'text',
          reply_to_id: replyTo,
        }, () => {});

      } else if (action < 65 && recentMsgIds.length) {
        // 5% — 消息反应
        const msgId = pick(recentMsgIds);
        try {
          await client.post(`/api/messages/${msgId}/react`, { emoji: pick(REACTIONS) });
        } catch {}

      } else if (action < 72) {
        // 7% — 标记已读
        try {
          await api.markRead(client, convId);
        } catch {}

      } else if (action < 77) {
        // 5% — 上传图片
        try {
          const fd = new FormData();
          fd.append('file', minimalPng(), { filename: `bot_${Date.now()}.png`, contentType: 'image/png' });
          await axios.post(`${cfg.BASE_URL}/api/messages/${convId}/upload`, fd, {
            headers: { ...fd.getHeaders(), Cookie: client.getCookie() },
            validateStatus: () => true,
            timeout: 8000,
          });
        } catch {}

      } else if (action < 80) {
        // 3% — 上传文本文件
        try {
          const fd = new FormData();
          fd.append('file', Buffer.from(`Bot log ${Date.now()}`), { filename: `log_${Date.now()}.txt`, contentType: 'text/plain' });
          await axios.post(`${cfg.BASE_URL}/api/messages/${convId}/upload`, fd, {
            headers: { ...fd.getHeaders(), Cookie: client.getCookie() },
            validateStatus: () => true,
            timeout: 8000,
          });
        } catch {}

      } else {
        // 20% — 空闲
      }

    } catch (e) {
      rep.fail(`bot:action:${account.username}`, e, 'low');
    }

    // 随机间隔 300ms ~ 3s
    await sleep(300 + rand(2700));
  }

  try { socket.disconnect(); } catch {}
}

/**
 * 启动 N 个并发机器人，在给定会话中持续活动
 * @param {Array}  accounts  - 账号列表
 * @param {string} convId    - 目标会话 ID
 * @param {number} durationMs - 持续时间（毫秒）
 * @param {number} botCount  - 并发机器人数（默认 20）
 */
async function runRandomBots(accounts, convId, durationMs = 60_000, botCount = 20) {
  rep.log(`\n══ 随机机器人 (${botCount} bots, ${Math.round(durationMs/1000)}s) ══`);

  const stopAt = Date.now() + durationMs;
  const bots   = accounts.slice(0, botCount);
  const peers  = accounts.slice(botCount, botCount + 5);

  await Promise.all(bots.map(a => botLoop(a, convId, peers, stopAt)));

  rep.pass('randomBots:completed', `${botCount} bots 活动结束`);
}

module.exports = { runRandomBots };
