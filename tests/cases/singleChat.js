const api    = require('../utils/api');
const { connectSocket, waitForEvent, sendMessage } = require('../utils/socket');
const rep    = require('../utils/reporter');
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function runSingleChatTests(accounts) {
  rep.log('\n══ 单聊测试 ══');
  const a1 = accounts[0], a2 = accounts[1];
  const c1 = api.clientFromAccount(a1), c2 = api.clientFromAccount(a2);
  const { conversationId } = await api.createPrivateConv(c1, a2.id);
  try {
    const s1 = await connectSocket(c1.getCookie());
    const s2 = await connectSocket(c2.getCookie());
    s2.emit('join_conversation', { conversationId });
    await sleep(300);
    // 1. 发送接收
    const content = `Test ${Date.now()}`;
    const recvP = waitForEvent(s2, 'new_message', 5000);
    await sendMessage(s1, conversationId, content);
    const recv = await recvP;
    recv.content === content ? rep.pass('singleChat:sendReceive', content.slice(0,20)) : rep.fail('singleChat:sendReceive', new Error(`发"${content}" 收"${recv?.content}"`), 'high');
    // 2. 撤回
    const delP = waitForEvent(s2, 'message_deleted', 5000);
    await api.deleteMessage(c1, recv.id);
    const del = await delP;
    del.msgId === recv.id ? rep.pass('singleChat:recall', '撤回同步') : rep.fail('singleChat:recall', new Error('msgId不匹配'), 'medium');
    // 3. 引用回复
    const orig = await sendMessage(s1, conversationId, '原始消息');
    await sleep(200);
    s2.emit('send_message', { conversationId, content: '引用', type: 'text', reply_to_id: orig.id });
    const reply = await waitForEvent(s1, 'new_message', 5000);
    reply.replyTo?.id === orig.id ? rep.pass('singleChat:quotedReply', 'replyTo正确') : rep.fail('singleChat:quotedReply', new Error(`replyTo:${JSON.stringify(reply?.replyTo)}`), 'medium');
    // 4. 未读计数
    await api.markRead(c2, conversationId);
    await sleep(300);
    const unread = await api.getUnreadCounts(c2);
    !unread[conversationId] ? rep.pass('singleChat:unreadCleared', '未读数归零') : rep.fail('singleChat:unreadCleared', new Error(`未读:${unread[conversationId]}`), 'medium');
    // 5. 消息历史
    const msgs = await api.getMessages(c1, conversationId, { limit: 10 });
    Array.isArray(msgs) && msgs.length > 0 ? rep.pass('singleChat:history', `${msgs.length}条`) : rep.fail('singleChat:history', new Error('历史为空'), 'low');
    // 6. 断线重连补拉
    const tBefore = Math.floor(Date.now() / 1000) - 1;
    s1.disconnect(); await sleep(300);
    const gap = await sendMessage(s2, conversationId, '断线期间消息');
    await sleep(300);
    const mc = api.clientFromAccount(a1);
    const { data: missed } = await mc.get(`/api/messages/missed?after=${tBefore}`);
    Array.isArray(missed) && missed.find(m => m.id === gap.id) ? rep.pass('singleChat:reconnectCatchup', '补拉成功') : rep.fail('singleChat:reconnectCatchup', new Error('未补拉到消息'), 'high');
    s2.disconnect();
  } catch(e) { rep.fail('singleChat:tests', e, 'critical'); }
}
module.exports = { runSingleChatTests };
