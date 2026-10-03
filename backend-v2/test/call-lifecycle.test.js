'use strict';
jest.mock('../src/utils/push', () => ({ pushCallInvite: jest.fn().mockResolvedValue(), pushToUser: jest.fn().mockResolvedValue() }));
const { makeUser, befriend, privateConversation } = require('./helpers');
const { db } = require('../src/db/connection');
const registerCall = require('../src/realtime/handlers/call');
const registerGroupCall = require('../src/realtime/handlers/groupCall');
const presence = require('../src/realtime/presence');
const { pushCallInvite } = require('../src/utils/push');
const { randomUUID } = require('crypto');
let users;
const liveHarnesses = [];
function harness(id) {
  const events = [], handlers = {};
  const io = { to: room => ({
    emit: (event, data) => events.push({ room, event, data }),
    except: excluded => ({ emit: (event, data) => events.push({ room, excluded, event, data }) }),
  }) };
  const socket = { id: randomUUID(), user: { id }, on: (e, fn) => handlers[e] = fn,
    emit: (event, data) => events.push({ room: 'self', event, data }), to: io.to };
  registerCall(io, socket);
  const h = { events, handlers, io, socket }; liveHarnesses.push(h); return h;
}
beforeAll(async () => {
  users = [];
  for (let i = 0; i < 24; i++) users.push(await makeUser());
  for (let i = 0; i < 24; i += 2) { await befriend(users[i], users[i+1]); await privateConversation(users[i], users[i+1]); }
});
afterEach(() => {
  for (const h of liveHarnesses.splice(0)) { h.handlers['call:end']?.({ to: h.peer }); h.handlers['group_call:leave']?.({ callId: registerGroupCall._state.userCall.get(h.socket.user.id) }); }
  presence.onlineUsers.clear();
  for (const c of registerGroupCall._state.groupCalls.values()) clearTimeout(c.timer);
  registerGroupCall._state.groupCalls.clear(); registerGroupCall._state.userCall.clear();
});
function pair(n) {
  const a = harness(users[n].userId), b = harness(users[n+1].userId);
  a.peer = b.socket.user.id; b.peer = a.socket.user.id;
  a.handlers['call:request']({ to: a.peer, type: 'audio' });
  return { a, b };
}
test('baseline: accepted call forwards offer and hangup completes log', () => {
  const { a,b } = pair(0);
  b.handlers['call:response']({ to:b.peer, accepted:true });
  a.handlers['call:offer']({ to:a.peer, offer:{ type:'offer', sdp:'audit' } });
  expect(a.events.some(x=>x.event==='call:offer')).toBe(true);
  a.handlers['call:end']({ to:a.peer });
  expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=? AND callee_id=?').get(a.socket.user.id,a.peer).status).toBe('completed');
});
test('P1: disconnecting an unused second device must preserve active call', () => {
  const { a,b } = pair(2);
  b.handlers['call:response']({ to:b.peer, accepted:true });
  const spare = harness(a.socket.user.id);
  presence.onlineUsers.set(a.socket.user.id,new Set([a.socket.id,spare.socket.id]));
  spare.handlers.disconnect();
  expect(spare.events.filter(x=>x.event==='call:end')).toHaveLength(0);
  expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=?').get(a.socket.user.id).status).toBe('ongoing');
});
test('P1: rejection on another device must not terminate an already accepted call', () => {
  const { a,b } = pair(4);
  b.handlers['call:response']({ to:b.peer, accepted:true });
  const spare = harness(b.socket.user.id);
  spare.handlers['call:response']({ to:a.socket.user.id, accepted:false });
  expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=?').get(a.socket.user.id).status).toBe('ongoing');
});
test('P2: cooldown must reply explicitly so caller does not wait for nonexistent call', () => {
  const { a } = pair(6);
  a.handlers['call:end']({ to:a.peer }); a.events.length=0;
  a.handlers['call:request']({ to:a.peer, type:'audio' });
  expect(a.events.some(x=>x.room==='self' && ['call:error','call:response'].includes(x.event))).toBe(true);
});
test('P1: malformed socket call packet must not throw out of handler', () => {
  const a=harness(users[8].userId);
  expect(()=>a.handlers['call:request'](null)).not.toThrow();
});
test('P2: unanswered timeout must preserve missed-call status', () => {
  jest.useFakeTimers();
  try {
    const { a }=pair(10);
    jest.advanceTimersByTime(120001);
    expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=?').get(a.socket.user.id).status).toBe('missed');
  } finally { jest.useRealTimers(); }
});
test('P1: group push must identify the group session for native clients', () => {
  const a=harness(users[12].userId), b=users[13].userId, id=randomUUID();
  db.prepare("INSERT INTO conversations (id,type,name) VALUES (?,'group','voice audit')").run(id);
  for (const uid of [a.socket.user.id,b]) db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(id,uid);
  registerGroupCall(a.io, a.socket);
  pushCallInvite.mockClear();
  a.handlers['group_call:start']({ conversationId:id,type:'audio' });
  expect(pushCallInvite).toHaveBeenCalled();
  const push=pushCallInvite.mock.calls[0][0];
  expect(push.conversationId).toBe(id);
});
test('baseline: stranger cannot inject offer into unrelated users', () => {
  const a=harness(users[14].userId);
  a.handlers['call:offer']({ to:users[15].userId,offer:{type:'offer',sdp:'injection'} });
  expect(a.events).toHaveLength(0);
});

test('only the accepting socket receives SDP; sibling devices are dismissed', () => {
  const {a,b}=pair(16);
  b.handlers['call:response']({to:b.peer, accepted:true});
  expect(b.events.find(x=>x.data.reason==='answered_elsewhere')).toMatchObject({room:`user_${a.peer}`,excluded:b.socket.id});
  a.handlers['call:offer']({to:a.peer,offer:{type:'offer',sdp:'valid'}});
  expect(a.events.find(x=>x.event==='call:offer').room).toBe(b.socket.id);
  const spare=harness(b.socket.user.id);
  spare.handlers['call:end']({to:a.socket.user.id});
  spare.handlers['call:answer']({to:a.socket.user.id,answer:{type:'answer',sdp:'stale'}});
  expect(spare.events).toHaveLength(0);
  expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=?').get(a.socket.user.id).status).toBe('ongoing');
});
test('disconnecting the actual accepting socket ends the caller session', () => {
  const {a,b}=pair(18);
  b.handlers['call:response']({to:b.peer,accepted:true});b.events.length=0;
  b.handlers.disconnect();
  expect(b.events.find(x=>x.room===a.socket.id)).toMatchObject({event:'call:end',data:{reason:'disconnected'}});
  expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=?').get(a.socket.user.id).status).toBe('completed');
});
test('stale call ID cannot end or alter the current call', () => {
  const {a,b}=pair(20);
  b.handlers['call:response']({to:b.peer,accepted:true});
  a.handlers['call:end']({to:a.peer,callId:'previous-call'});
  expect(db.prepare('SELECT status FROM call_logs WHERE caller_id=?').get(a.socket.user.id).status).toBe('ongoing');
});
test.each(['call:request','call:response','call:offer','call:answer','call:ice','call:end'])('%s rejects malformed payloads without throwing',event=>{
  const h=harness(users[22].userId);
  for(const value of [null,undefined,[],{},'bad',42,{to:{invalid:true}}]) expect(()=>h.handlers[event](value)).not.toThrow();
  expect(h.events.every(x=>x.room==='self'&&x.event==='call:error')).toBe(true);
});
