'use strict';
/**
 * 回归：建群 / 入群 / 改群名 / 踢人 / 退群 / 解散后，相关成员马上拉会话列表必须是新状态。
 *
 * 会话列表有 2s 进程内缓存，客户端收到 new_conversation / group_* 事件会立即重拉；
 * 这些操作此前不失效缓存，重拉命中旧数据后列表就一直缺新群（或留着已退出的群）。
 */
require('./testEnv');
const { request, app, makeUser, befriend } = require('./helpers');

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const list = async (u) => {
  const r = await request(app).get('/api/messages/conversations').set(auth(u));
  expect(r.status).toBe(200);
  return r.body;
};
const has = (convs, id) => convs.some(c => c.id === id);

describe('群变动后会话列表立即刷新', () => {
  let owner, a, b, gid;

  beforeAll(async () => {
    owner = await makeUser(); a = await makeUser(); b = await makeUser();
    await befriend(owner, a); await befriend(owner, b);
  });

  test('建群后群主与成员立即看到新群', async () => {
    await list(owner); await list(a);   // 预热缓存
    const g = await request(app).post('/api/messages/conversation/group').set(auth(owner))
      .send({ name: `新鲜度_${Date.now()}`, memberIds: [a.userId] });
    expect(g.status).toBe(200);
    gid = g.body.conversationId;
    expect(has(await list(owner), gid)).toBe(true);
    expect(has(await list(a), gid)).toBe(true);
  });

  test('邀请入群后被邀者立即看到', async () => {
    await list(b);
    const r = await request(app).post(`/api/messages/conversation/${gid}/invite`).set(auth(owner)).send({ userIds: [b.userId] });
    expect(r.status).toBe(200);
    expect(has(await list(b), gid)).toBe(true);
  });

  test('改群名后成员立即看到新名字', async () => {
    await list(a);
    const r = await request(app).put(`/api/messages/conversation/${gid}`).set(auth(owner)).send({ name: '改名后的群' });
    expect(r.status).toBe(200);
    expect((await list(a)).find(c => c.id === gid).name).toBe('改名后的群');
  });

  test('被踢 / 退群后列表立即移除', async () => {
    await list(b); await list(a);
    expect((await request(app).delete(`/api/messages/conversation/${gid}/members/${b.userId}`).set(auth(owner))).status).toBe(200);
    expect(has(await list(b), gid)).toBe(false);
    expect((await request(app).post(`/api/messages/conversation/${gid}/leave`).set(auth(a))).status).toBe(200);
    expect(has(await list(a), gid)).toBe(false);
  });

  test('解散后群主列表立即移除', async () => {
    await list(owner);
    expect((await request(app).post(`/api/messages/conversation/${gid}/dissolve`).set(auth(owner))).status).toBe(200);
    expect(has(await list(owner), gid)).toBe(false);
  });
});
