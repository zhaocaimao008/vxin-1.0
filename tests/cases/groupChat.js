/**
 * 第四步：群聊测试
 */
const api    = require('../utils/api');
const { connectSocket, waitForEvent, sendMessage } = require('../utils/socket');
const rep    = require('../utils/reporter');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runGroupChatTests(accounts) {
  rep.log('\n══ 群聊测试 ══');

  const owner   = accounts[0];
  const members = accounts.slice(1, 6); // 5个成员

  const cOwner = api.clientFromAccount(owner);

  // ── 创建测试群 ────────────────────────────────────────────────
  let conversationId;
  try {
    const gr = await api.createGroup(cOwner, `测试群_${Date.now()}`, members.map(m => m.id));
    conversationId = gr.conversationId;
    rep.pass('groupChat:create', `群 ${conversationId.slice(0, 8)} 创建成功，${members.length + 1} 人`);
  } catch (e) {
    rep.fail('groupChat:create', e, 'critical', ['POST /api/messages/conversation/group']);
    return;
  }

  // ── 测试：群消息广播 ──────────────────────────────────────────
  try {
    const sOwner = await connectSocket(cOwner.getCookie());
    const cMem1  = api.clientFromAccount(members[0]);
    const sMem1  = await connectSocket(cMem1.getCookie());
    sMem1.emit('join_conversation', { conversationId });
    await sleep(300);

    const content    = `群消息 ${Date.now()}`;
    const recvPromise = waitForEvent(sMem1, 'new_message', 5000);
    await sendMessage(sOwner, conversationId, content);
    const recv = await recvPromise;

    if (recv.content === content) {
      rep.pass('groupChat:broadcast', '群消息广播正常');
    } else {
      rep.fail('groupChat:broadcast', new Error('群消息内容不匹配'), 'high');
    }

    // ── 测试：@成员消息 ────────────────────────────────────────
    const atContent  = `@${members[0].username} 你好`;
    const atPromise  = waitForEvent(sMem1, 'new_message', 5000);
    await sendMessage(sOwner, conversationId, atContent);
    const atRecv = await atPromise;
    if (atRecv.content.includes('@')) {
      rep.pass('groupChat:atMention', '@成员消息正常传递');
    } else {
      rep.fail('groupChat:atMention', new Error('@消息内容异常'), 'low');
    }

    // ── 测试：群公告 ────────────────────────────────────────────
    try {
      await cOwner.put(`/api/messages/conversation/${conversationId}`, { announcement: '这是群公告' });
      const info = await cOwner.get(`/api/messages/conversation/${conversationId}/info`);
      if (info.data.announcement === '这是群公告') {
        rep.pass('groupChat:announcement', '群公告设置读取正常');
      } else {
        rep.fail('groupChat:announcement', new Error('群公告内容不符'), 'medium');
      }
    } catch (e) {
      rep.fail('groupChat:announcement', e, 'medium');
    }

    // ── 测试：群昵称 ────────────────────────────────────────────
    try {
      await cOwner.put(`/api/messages/conversation/${conversationId}/nickname`, { nickname: '测试昵称' });
      const info = await cOwner.get(`/api/messages/conversation/${conversationId}/info`);
      const me = info.data.members?.find(m => m.id === owner.id);
      if (me?.nickname === '测试昵称') {
        rep.pass('groupChat:nickname', '群昵称设置正常');
      } else {
        rep.fail('groupChat:nickname', new Error(`群昵称: ${me?.nickname}`), 'low');
      }
    } catch (e) {
      rep.fail('groupChat:nickname', e, 'low');
    }

    // ── 测试：全群禁言 ─────────────────────────────────────────
    try {
      await cOwner.put(`/api/messages/conversation/${conversationId}/manage`, { mute_all: 1 });
      // 普通成员发消息应被拒绝
      const muteResult = await new Promise((resolve) => {
        sMem1.emit('send_message', { conversationId, content: '禁言测试', type: 'text' }, (ack) => {
          resolve(ack);
        });
        setTimeout(() => resolve({ success: true }), 3000); // 无 ack 算未拦截
      });
      if (!muteResult?.success) {
        rep.pass('groupChat:muteAll', '全群禁言拦截正常');
      } else {
        rep.fail('groupChat:muteAll', new Error('普通成员在禁言中仍可发消息'), 'high');
      }
      // 解除禁言
      await cOwner.put(`/api/messages/conversation/${conversationId}/manage`, { mute_all: 0 });
    } catch (e) {
      rep.fail('groupChat:muteAll', e, 'medium');
    }

    // ── 测试：踢人 ────────────────────────────────────────────
    try {
      const kickPromise = waitForEvent(sMem1, 'group_kicked', 5000);
      await cOwner.delete(`/api/messages/conversation/${conversationId}/members/${members[0].id}`);
      await kickPromise;
      rep.pass('groupChat:kick', '踢人事件正常推送');
    } catch (e) {
      rep.fail('groupChat:kick', e, 'medium');
    }

    sOwner.disconnect();
    sMem1.disconnect();
  } catch (e) {
    rep.fail('groupChat:tests', e, 'critical');
  }

  // ── 批量创建群（性能测试用）─────────────────────────────────
  rep.log(`  批量创建 ${cfg.GROUP_COUNT} 个群...`);
  const groupIds = [conversationId];
  const cfg2 = require('../config');
  for (let i = 0; i < cfg2.GROUP_COUNT - 1 && i < accounts.length - 5; i++) {
    try {
      const gr = await api.createGroup(cOwner, `压测群_${i + 1}`, accounts.slice(i + 1, i + 4).map(a => a.id));
      groupIds.push(gr.conversationId);
    } catch {}
    await sleep(50);
  }
  rep.pass('groupChat:bulkCreate', `${groupIds.length} 个群创建完成`);
  return groupIds;
}

const cfg = require('../config');
module.exports = { runGroupChatTests };
