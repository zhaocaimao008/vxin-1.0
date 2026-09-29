'use strict';
/**
 * 红包卡片状态：历史消息里的红包要按查看者标注 已领取 / 已被领完 / 已过期，
 * 否则领过的红包刷新后仍显示「点击领取红包」。
 */
const { request, app, makeUser, befriend, privateConversation } = require('./helpers');
const wallet = require('../src/modules/wallet/wallet.service');
const { db } = require('../src/db/connection');

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const rpState = async (u, convId, packetId) => {
  const r = await request(app).get(`/api/messages/${convId}`).set(auth(u));
  expect(r.status).toBe(200);
  const list = Array.isArray(r.body) ? r.body : r.body.messages;
  const m = list.find(x => x.type === 'red_packet' && JSON.parse(x.content).packetId === packetId);
  return m.rpState;
};

describe('红包卡片状态', () => {
  let sender, receiver, convId;
  beforeAll(async () => {
    sender = await makeUser(); receiver = await makeUser();
    await befriend(sender, receiver);
    convId = await privateConversation(sender, receiver);
    wallet.applyDelta(sender.userId, 100, 'test_seed', null, '测试入账');
  });
  const send = async () => (await request(app).post('/api/messages/red-packet/send').set(auth(sender))
    .send({ conversationId: convId, totalAmount: 5, totalCount: 1 })).body.packetId;

  test('未领取时不带状态，领取后领取者看到已领取、发送者看到已被领完', async () => {
    const pid = await send();
    expect(await rpState(receiver, convId, pid)).toBeUndefined();
    expect((await request(app).post(`/api/redpackets/${pid}/claim`).set(auth(receiver))).status).toBe(200);
    expect(await rpState(receiver, convId, pid)).toBe('claimed');
    expect(await rpState(sender, convId, pid)).toBe('empty');
  });

  test('过期红包显示已过期', async () => {
    const pid = await send();
    db.prepare("UPDATE red_packets SET status='expired' WHERE id=?").run(pid);
    expect(await rpState(receiver, convId, pid)).toBe('expired');
  });
});
