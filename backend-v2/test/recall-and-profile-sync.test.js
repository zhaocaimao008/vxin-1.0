'use strict';
/**
 * 撤回与资料变更的列表一致性（撤回仍为彻底删除，见 bee5b5d）：
 * - 撤回后会话列表预览不再显示被撤回的内容
 * - 红包/转账消息不能撤回（撤回会清空内容，对方无法领取/查看）
 * - 置顶消息被撤回后自动取消置顶
 * - 改昵称后好友马上拉会话列表即是新名字（不命中 2s 旧缓存）
 */
require('./testEnv');
const { request, app, makeUser, befriend, privateConversation } = require('./helpers');
const wallet = require('../src/modules/wallet/wallet.service');
const { db } = require('../src/db/connection');

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const recall = (u, id) => request(app).delete(`/api/messages/${id}`).set(auth(u)).send({ forEveryone: true });
const send = async (u, cid, content) => (await request(app).post(`/api/messages/${cid}`).set(auth(u)).send({ content, type: 'text' })).body;

describe('撤回', () => {
  let a, b, cid;
  beforeAll(async () => {
    a = await makeUser(); b = await makeUser();
    await befriend(a, b); cid = await privateConversation(a, b);
  });

  test('撤回后会话列表预览不再显示被撤回的内容', async () => {
    await send(a, cid, '上一条');
    const m = await send(a, cid, '说错了要撤回');
    await request(app).get('/api/messages/conversations').set(auth(b));   // 预热缓存
    expect((await recall(a, m.id)).status).toBe(200);
    const conv = (await request(app).get('/api/messages/conversations').set(auth(b))).body.find(c => c.id === cid);
    expect(conv.lastMessage).toBe('上一条');
  });

  test('红包和转账消息不能撤回', async () => {
    wallet.applyDelta(a.userId, 50, 'test_seed', null, '测试入账');
    const rp = await request(app).post('/api/messages/red-packet/send').set(auth(a)).send({ conversationId: cid, totalAmount: 5, totalCount: 1 });
    const tf = await request(app).post('/api/wallet/transfer').set(auth(a)).send({ to_user_id: b.userId, amount: 5 });
    for (const msgId of [rp.body.message?.id, tf.body.message?.id]) {
      expect(msgId).toBeTruthy();
      expect((await recall(a, msgId)).status).toBe(400);
      expect(db.prepare('SELECT deleted FROM messages WHERE id=?').get(msgId).deleted).toBe(0);
    }
  });

  test('置顶消息被撤回后自动取消置顶', async () => {
    const g = await request(app).post('/api/messages/conversation/group').set(auth(a)).send({ name: `置顶撤回${Date.now()}`, memberIds: [b.userId] });
    const gid = g.body.conversationId;
    const m = await send(a, gid, '置顶后撤回');
    expect((await request(app).post(`/api/messages/conversation/${gid}/pin-message`).set(auth(a)).send({ msgId: m.id })).status).toBe(200);
    expect((await recall(a, m.id)).status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) n FROM pinned_messages WHERE message_id=?').get(m.id).n).toBe(0);
  });
});

test('改昵称后好友立即拉到新会话名', async () => {
  const a = await makeUser(); const b = await makeUser();
  await befriend(a, b); await privateConversation(a, b);
  await request(app).get('/api/messages/conversations').set(auth(b));   // 预热 b 的会话缓存
  const name = `新名字${Date.now() % 100000}`;
  expect((await request(app).put('/api/users/profile').set(auth(a)).send({ username: name })).status).toBe(200);
  const convs = (await request(app).get('/api/messages/conversations').set(auth(b))).body;
  expect(convs.some(c => c.type === 'private' && c.name === name)).toBe(true);
});
