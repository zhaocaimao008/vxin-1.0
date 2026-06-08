/**
 * 第五步：多端同步测试
 */
const api    = require('../utils/api');
const { connectSocket, waitForEvent, sendMessage } = require('../utils/socket');
const rep    = require('../utils/reporter');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runMultiDeviceTests(accounts, conversationId) {
  rep.log('\n══ 多端同步测试 ══');

  const user = accounts[0];
  const peer = accounts[1];

  // 同一账号打开 3 个 Socket（模拟 Web + Desktop + Mobile）
  const clients = [];
  for (let i = 0; i < 3; i++) clients.push(api.clientFromAccount(user));

  const peerClient = api.clientFromAccount(peer);

  let convId = conversationId;
  if (!convId) {
    const { conversationId: cid } = await api.createPrivateConv(clients[0], peer.id);
    convId = cid;
  }

  try {
    // 三端同时连接
    const sockets = await Promise.all(clients.map(c => connectSocket(c.getCookie())));
    const peerSocket = await connectSocket(peerClient.getCookie());

    sockets.forEach(s => s.emit('join_conversation', { conversationId: convId }));
    peerSocket.emit('join_conversation', { conversationId: convId });
    await sleep(400);

    // ── 测试1：消息三端同步 ───────────────────────────────────
    const recv0 = waitForEvent(sockets[0], 'new_message', 5000);
    const recv1 = waitForEvent(sockets[1], 'new_message', 5000);
    const recv2 = waitForEvent(sockets[2], 'new_message', 5000);
    const content = `多端同步 ${Date.now()}`;
    await sendMessage(peerSocket, convId, content);

    const [m0, m1, m2] = await Promise.all([recv0, recv1, recv2]);
    if (m0.content === content && m1.content === content && m2.content === content) {
      rep.pass('multiDevice:messageSyncAll3', '消息同步到全部3端');
    } else {
      rep.fail('multiDevice:messageSyncAll3', new Error(`端0:${m0?.content} 端1:${m1?.content} 端2:${m2?.content}`), 'critical');
    }

    // ── 测试2：撤回三端同步 ───────────────────────────────────
    const sentMsg = await sendMessage(peerSocket, convId, '将要撤回的消息');
    await sleep(200);
    const del0 = waitForEvent(sockets[0], 'message_deleted', 5000);
    const del1 = waitForEvent(sockets[1], 'message_deleted', 5000);
    await peerClient.delete(`/api/messages/${sentMsg.id}`, { data: { forEveryone: true } });
    const [d0, d1] = await Promise.all([del0, del1]);
    if (d0.msgId === sentMsg.id && d1.msgId === sentMsg.id) {
      rep.pass('multiDevice:recallSync', '撤回同步到多端');
    } else {
      rep.fail('multiDevice:recallSync', new Error('撤回事件未同步'), 'high');
    }

    // ── 测试3：已读未读同步 ───────────────────────────────────
    await sendMessage(peerSocket, convId, '未读测试消息');
    await sleep(300);
    // 端0 标记已读
    await api.markRead(clients[0], convId);
    await sleep(300);
    // 验证 unread-counts 在服务端归零
    const unread = await api.getUnreadCounts(clients[0]);
    if (!unread[convId]) {
      rep.pass('multiDevice:readSync', '已读后服务端未读数归零');
    } else {
      rep.fail('multiDevice:readSync', new Error(`服务端未读数: ${unread[convId]}`), 'medium');
    }

    // ── 测试4：最后一台断线才触发离线 ────────────────────────
    sockets[0].disconnect();
    sockets[1].disconnect();
    await sleep(500);
    // 此时 sockets[2] 仍在线，user 应该仍是 online
    const { data: userInfo } = await peerClient.get(`/api/users/${user.id}`);
    if (userInfo.status === 'online') {
      rep.pass('multiDevice:partialDisconnect', '2端断线后1端在线，状态仍为 online');
    } else {
      rep.fail('multiDevice:partialDisconnect', new Error(`状态为 ${userInfo.status}，应为 online`), 'high');
    }

    sockets[2].disconnect();
    await sleep(500);
    const { data: userInfoOffline } = await peerClient.get(`/api/users/${user.id}`);
    if (userInfoOffline.status === 'offline') {
      rep.pass('multiDevice:allDisconnect', '全部端断线后状态变为 offline');
    } else {
      rep.fail('multiDevice:allDisconnect', new Error(`状态为 ${userInfoOffline.status}，应为 offline`), 'medium');
    }

    peerSocket.disconnect();
  } catch (e) {
    rep.fail('multiDevice:setup', e, 'critical');
  }
}

module.exports = { runMultiDeviceTests };
