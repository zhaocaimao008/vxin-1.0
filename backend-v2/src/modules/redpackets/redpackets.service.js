'use strict';
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const { writeBatch } = require('../../db/writer');
const { badRequest, forbidden, notFound } = require('../../utils/http');
const { isMember, requireMember } = require('../messages/shared');

// ── 发红包（建红包 + 发一条 red_packet 类型消息）─────────────────
async function send(io, userId, { conversationId, totalAmount, totalCount, greeting }) {
  if (!conversationId || !totalAmount || !totalCount) throw badRequest('参数缺失');
  if (totalAmount < 1 || totalAmount > 20000) throw badRequest('金额范围 1-20000 金币');
  if (totalCount < 1 || totalCount > 100) throw badRequest('红包个数 1-100');
  if (totalAmount < totalCount) throw badRequest('总金额不能小于红包个数（每个至少 1 金币）');
  if (greeting && (typeof greeting !== 'string' || greeting.length > 100))
    throw badRequest('祝福语最多 100 字');
  requireMember(conversationId, userId, '无权操作');

  const packetId = uuidv4();
  const greet = (typeof greeting === 'string' && greeting.trim()) ? greeting.trim() : '恭喜发财，大吉大利';
  const msgContent = JSON.stringify({ packetId, greeting: greet, totalCount, totalAmount });
  const msgId = uuidv4();
  // P0-1：建红包 + 发红包消息原子批次走 worker（两条要么全成功要么全失败），await 落库后读回
  await writeBatch([
    { sql: 'INSERT INTO red_packets (id,sender_id,conversation_id,total_amount,total_count,greeting) VALUES (?,?,?,?,?,?)',
      params: [packetId, userId, conversationId, totalAmount, totalCount, greet] },
    { sql: 'INSERT INTO messages (id,conversation_id,sender_id,type,content) VALUES (?,?,?,?,?)',
      params: [msgId, conversationId, userId, 'red_packet', msgContent] },
  ]);
  const msg = db.prepare('SELECT m.*, u.username as senderName, u.avatar as senderAvatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(msgId);
  msg.reactions = [];
  if (io) io.to(conversationId).emit('new_message', msg);
  return { packetId, message: msg };
}

// ── 红包详情 ────────────────────────────────────────────────────
function detail(userId, packetId) {
  const packet = db.prepare('SELECT rp.*, u.username as senderName FROM red_packets rp JOIN users u ON u.id=rp.sender_id WHERE rp.id=?').get(packetId);
  if (!packet) throw notFound('红包不存在');
  requireMember(packet.conversation_id, userId, '无权查看');
  const claims = db.prepare('SELECT rpc.*, u.username FROM red_packet_claims rpc JOIN users u ON u.id=rpc.user_id WHERE rpc.packet_id=? ORDER BY rpc.claimed_at').all(packetId);
  return { ...packet, claims, myClaim: claims.find(c => c.user_id === userId) || null };
}

// ── 领红包（EXCLUSIVE 事务防并发超发）────────────────────────────
// ⚠ P0-1 例外：本函数刻意保留主连接同步 EXCLUSIVE 事务，绝不可拆到 worker。
//   领红包是"读 claimed_count → 判断是否领完 → 计算金额 → 写入"的读-判-写闭环，
//   必须在单连接单事务内原子完成，才能防止并发超发。拆成异步 worker 写会丢失这一原子性。
function claim(io, userId, packetId) {
  const packet = db.prepare('SELECT * FROM red_packets WHERE id=?').get(packetId);
  if (!packet) throw notFound('红包不存在');
  requireMember(packet.conversation_id, userId, '无权领取');

  let claimResult;
  try {
    claimResult = db.transaction(() => {
      const existing = db.prepare('SELECT amount FROM red_packet_claims WHERE packet_id=? AND user_id=?').get(packetId, userId);
      if (existing) return { error: '已领取过', amount: existing.amount };

      const fresh = db.prepare('SELECT * FROM red_packets WHERE id=?').get(packetId);
      if (fresh.claimed_count >= fresh.total_count) return { error: '红包已被领完' };
      // 24h 过期不可领（即便定时任务尚未标记）
      if (Math.floor(Date.now() / 1000) - fresh.created_at > 24 * 3600) return { error: '红包已过期' };

      const sumRow = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM red_packet_claims WHERE packet_id=?').get(packetId);
      const remaining = fresh.total_amount - sumRow.s;
      if (remaining <= 0) return { error: '红包已被领完' };

      const leftCount = fresh.total_count - fresh.claimed_count;
      let amount;
      if (leftCount === 1) {
        amount = remaining;
      } else {
        const max = Math.max(1, Math.floor(remaining / leftCount * 2));
        amount = Math.max(1, Math.min(remaining - (leftCount - 1), Math.floor(Math.random() * max) + 1));
      }
      db.prepare('INSERT INTO red_packet_claims (packet_id,user_id,amount) VALUES (?,?,?)').run(packetId, userId, amount);
      db.prepare('UPDATE red_packets SET claimed_count=claimed_count+1 WHERE id=?').run(packetId);
      return { amount };
    }).exclusive();   // ← 单次调用执行 EXCLUSIVE 事务（原版误写 .exclusive()() 双重调用，生产环境领红包恒报 500）
  } catch (e) {
    console.error('[redpacket] claim 失败:', e.code, e.message);
    throw new Error('领取失败，请重试');
  }

  if (claimResult.error) {
    const err = badRequest(claimResult.error);
    err.amount = claimResult.amount; // controller 透传给前端
    throw err;
  }

  const claimer = db.prepare('SELECT username FROM users WHERE id=?').get(userId);
  if (io) io.to(packet.conversation_id).emit('red_packet_claimed', { packetId, userId, username: claimer?.username, amount: claimResult.amount });
  return { amount: claimResult.amount };
}

module.exports = { send, detail, claim };
