'use strict';
/**
 * 回归：转账与编辑消息也必须遵守拉黑 / 屏蔽陌生人 / 全员禁言。
 *
 * 此前其余发送路径（文字、文件、转发、红包、定时、拍一拍）都走 privateSendGuard，
 * 但转账（会在私聊落一条带附言的 transfer 消息）与编辑（实时推送 message_edited）没有：
 * 被拉黑者可以借转账附言或改旧消息继续骚扰；全员禁言时普通成员可改旧消息"发言"。
 */
require('./testEnv');
const { request, app, makeUser, befriend, privateConversation } = require('./helpers');

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

describe('拉黑后转账与编辑被拒', () => {
  let u1, u2, convId, oldMsgId;

  beforeAll(async () => {
    u1 = await makeUser();
    u2 = await makeUser();
    await befriend(u1, u2);
    convId = await privateConversation(u1, u2);
    const seed = await request(app).post(`/api/messages/${convId}`).set(auth(u1)).send({ content: '拉黑前的消息', type: 'text' });
    expect(seed.status).toBe(200);
    oldMsgId = seed.body.id;
    const r = await request(app).post('/api/wallet/recharge').set(auth(u1)).send({ amount: 100 });
    expect(r.status).toBe(200);
    // u2 拉黑 u1
    const b = await request(app).post(`/api/users/block/${u1.userId}`).set(auth(u2));
    expect(b.status).toBe(200);
  });

  test('被拉黑者转账被拒，余额不变、不落消息', async () => {
    const before = (await request(app).get('/api/wallet').set(auth(u1))).body.balance;
    const res = await request(app).post('/api/wallet/transfer').set(auth(u1))
      .send({ to_user_id: u2.userId, amount: 10, note: '借转账骚扰' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/拒收/);
    expect(res.body.error).toMatch(/转账未发出/);
    expect((await request(app).get('/api/wallet').set(auth(u1))).body.balance).toBe(before);
  });

  test('被拉黑者编辑旧消息被拒，内容不变', async () => {
    const res = await request(app).put(`/api/messages/${oldMsgId}/edit`).set(auth(u1)).send({ content: '改成骚扰内容' });
    expect(res.status).toBe(403);
    const { db } = require('../src/db/connection');
    expect(db.prepare('SELECT content FROM messages WHERE id=?').get(oldMsgId).content).toBe('拉黑前的消息');
  });

  test('解除拉黑后可正常转账与编辑', async () => {
    const u = await request(app).delete(`/api/users/block/${u1.userId}`).set(auth(u2));
    expect(u.status).toBe(200);
    const t = await request(app).post('/api/wallet/transfer').set(auth(u1)).send({ to_user_id: u2.userId, amount: 10 });
    expect(t.status).toBe(200);
    const e = await request(app).put(`/api/messages/${oldMsgId}/edit`).set(auth(u1)).send({ content: '正常修改' });
    expect(e.status).toBe(200);
  });
});

describe('全员禁言时普通成员不能靠编辑发言', () => {
  let owner, member, convId, msgId;

  beforeAll(async () => {
    owner = await makeUser();
    member = await makeUser();
    await befriend(owner, member);
    const g = await request(app).post('/api/messages/conversation/group').set(auth(owner))
      .send({ name: `禁言编辑_${Date.now()}`, memberIds: [member.userId] });
    convId = g.body.conversationId;
    expect(convId).toBeTruthy();
    const m = await request(app).post(`/api/messages/${convId}`).set(auth(member)).send({ content: '禁言前', type: 'text' });
    expect(m.status).toBe(200);
    msgId = m.body.id;
    const r = await request(app).put(`/api/messages/conversation/${convId}/manage`).set(auth(owner)).send({ mute_all: true });
    expect(r.status).toBe(200);
  });

  test('普通成员编辑被拒', async () => {
    const res = await request(app).put(`/api/messages/${msgId}/edit`).set(auth(member)).send({ content: '禁言中偷偷发言' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/禁言/);
  });
});
