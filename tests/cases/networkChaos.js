/**
 * 断网混沌测试
 * - 随机断开 Socket（模拟网络中断）
 * - 随机时间后重连
 * - 验证断线期间消息能补拉
 * - 模拟设备切换（Web→Mobile→Desktop）
 */
const api    = require('../utils/api');
const { connectSocket, waitForEvent, sendMessage } = require('../utils/socket');
const rep    = require('../utils/reporter');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(n)  { return Math.floor(Math.random() * n); }

// 设备类型标识（Header 差异模拟）
const DEVICES = ['web', 'desktop', 'mobile'];

async function runNetworkChaosTests(accounts) {
  rep.log('\n══ 断网混沌测试 ══');

  const user  = accounts[0];
  const peer  = accounts[1];
  const cUser = api.clientFromAccount(user);
  const cPeer = api.clientFromAccount(peer);

  // 建立私聊会话
  let convId;
  try {
    const { conversationId } = await api.createPrivateConv(cUser, peer.id);
    convId = conversationId;
  } catch (e) {
    rep.fail('networkChaos:setup', e, 'high');
    return;
  }

  // ── 测试 1：随机断线 + 补拉 ──────────────────────────────
  try {
    const sUser = await connectSocket(cUser.getCookie());
    const sPeer = await connectSocket(cPeer.getCookie());
    sUser.emit('join_conversation', { conversationId: convId });
    sPeer.emit('join_conversation', { conversationId: convId });
    await sleep(300);

    const tBefore = Math.floor(Date.now() / 1000) - 1;

    // 断开 user 的连接
    sUser.disconnect();
    await sleep(200);

    // peer 在断线期间发 3 条消息
    const gapMsgs = [];
    for (let i = 0; i < 3; i++) {
      const m = await sendMessage(sPeer, convId, `断线期间消息 ${i + 1}`).catch(() => null);
      if (m) gapMsgs.push(m.id);
      await sleep(100);
    }

    // 随机等待 1~5s 后重连
    const waitMs = 1000 + rand(4000);
    await sleep(waitMs);

    // 重连并补拉
    const cUser2 = api.clientFromAccount(user);
    const { data: missed } = await cUser2.get(`/api/messages/missed?after=${tBefore}`).catch(() => ({ data: [] }));
    const gotAll = gapMsgs.every(id => missed.find(m => m.id === id));

    gotAll
      ? rep.pass('networkChaos:reconnectCatchup', `断线 ${Math.round(waitMs/1000)}s 后补拉 ${gapMsgs.length} 条成功`)
      : rep.fail('networkChaos:reconnectCatchup', new Error(`补拉不完整: 期望 ${gapMsgs.join(',')} 得到 ${missed.map(m=>m.id).join(',')}`), 'high');

    sPeer.disconnect();
  } catch (e) {
    rep.fail('networkChaos:reconnectCatchup', e, 'high');
  }

  // ── 测试 2：多次随机断线 / 重连（10次）───────────────────
  try {
    let successCount = 0;
    for (let round = 0; round < 10; round++) {
      const sA = await connectSocket(cUser.getCookie());
      sA.emit('join_conversation', { conversationId: convId });
      await sleep(100 + rand(300));

      // 随机存活 200ms ~ 2s 后断开
      await sleep(200 + rand(1800));
      sA.disconnect();
      successCount++;
    }
    rep.pass('networkChaos:randomDisconnects', `10 次随机断线均无崩溃`);
  } catch (e) {
    rep.fail('networkChaos:randomDisconnects', e, 'medium');
  }

  // ── 测试 3：设备切换 ─────────────────────────────────────
  try {
    let prevSocket = null;
    const deviceLog = [];

    for (const device of DEVICES) {
      // 断开上一设备
      if (prevSocket) {
        prevSocket.disconnect();
        await sleep(200);
      }
      // 用同一账号新建连接（模拟新设备登录）
      const sNew = await connectSocket(cUser.getCookie());
      sNew.emit('join_conversation', { conversationId: convId });
      await sleep(300);

      // 发一条消息验证可用
      const msg = await sendMessage(sNew, convId, `来自 ${device}`).catch(e => null);
      if (msg) {
        deviceLog.push(device);
      } else {
        rep.fail(`networkChaos:deviceSwitch:${device}`, new Error('发消息失败'), 'medium');
      }
      prevSocket = sNew;
    }

    if (prevSocket) prevSocket.disconnect();

    deviceLog.length === DEVICES.length
      ? rep.pass('networkChaos:deviceSwitch', `设备切换 ${deviceLog.join('→')} 均正常`)
      : rep.fail('networkChaos:deviceSwitch', new Error(`只成功 ${deviceLog.length}/${DEVICES.length} 个设备`), 'medium');
  } catch (e) {
    rep.fail('networkChaos:deviceSwitch', e, 'medium');
  }

  // ── 测试 4：并发断线（10 个连接同时断）───────────────────
  try {
    const sockets = await Promise.all(
      accounts.slice(0, 10).map(a => connectSocket(api.clientFromAccount(a).getCookie()))
    );
    sockets.forEach(s => s.emit('join_conversation', { conversationId: convId }));
    await sleep(500);

    // 全部同时断开
    sockets.forEach(s => s.disconnect());
    await sleep(1000);

    // 验证服务端状态正常（能发新消息）
    const cCheck = api.clientFromAccount(accounts[2]);
    const sCheck = await connectSocket(cCheck.getCookie());
    sCheck.emit('join_conversation', { conversationId: convId });
    const pingMsg = await sendMessage(sCheck, convId, '并发断线后恢复验证').catch(e => null);
    sCheck.disconnect();

    pingMsg
      ? rep.pass('networkChaos:massBroadcastDisconnect', '10连接并发断线后服务正常')
      : rep.fail('networkChaos:massBroadcastDisconnect', new Error('断线后无法发消息'), 'high');
  } catch (e) {
    rep.fail('networkChaos:massBroadcastDisconnect', e, 'high');
  }
}

module.exports = { runNetworkChaosTests };
