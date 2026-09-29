'use strict';
/**
 * 回归：来电与发消息同口径——对方开启「屏蔽陌生人」且主叫已不是其好友时，不能再通过
 * 旧私聊会话发起来电(此前只检查了拉黑)。直接驱动 call:request 处理器，记录 io 派发。
 */
const { request, app, makeUser, befriend, privateConversation } = require('./helpers');
const registerCallHandler = require('../src/realtime/handlers/call');

function harness(userId) {
  const handlers = {}; const toSelf = []; const incoming = [];
  const socket = { user: { id: userId }, on: (ev, fn) => { handlers[ev] = fn; }, emit: (ev, p) => toSelf.push([ev, p]) };
  const io = { to: room => ({ emit: (ev, p) => { if (ev === 'call:incoming') incoming.push([room, p]); } }) };
  registerCallHandler(io, socket);
  return { handlers, toSelf, incoming };
}

describe('屏蔽陌生人后不能来电', () => {
  let a, b;
  beforeAll(async () => {
    a = await makeUser(); b = await makeUser();
    await befriend(a, b); await privateConversation(a, b);
  });

  test('好友之间可以正常来电', () => {
    const h = harness(a.userId);
    h.handlers['call:request']({ to: b.userId, type: 'audio' });
    expect(h.incoming.map(x => x[0])).toContain(`user_${b.userId}`);
  });

  test('对方开启屏蔽陌生人并删好友后，来电被拒且不会响铃', async () => {
    await request(app).put('/api/users/me/settings').set('Authorization', `Bearer ${b.token}`).send({ blockUnknownMessages: true });
    await request(app).delete(`/api/users/contacts/${a.userId}`).set('Authorization', `Bearer ${b.token}`);
    await new Promise(r => setTimeout(r, 5100)); // 跨过主叫 5s 冷却
    const h = harness(a.userId);
    h.handlers['call:request']({ to: b.userId, type: 'audio' });
    expect(h.incoming).toHaveLength(0);
    expect(h.toSelf).toContainEqual(['call:response', { from: b.userId, accepted: false }]);
  }, 15000);
});
