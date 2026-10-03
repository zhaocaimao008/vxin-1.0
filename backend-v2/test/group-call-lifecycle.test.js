'use strict';
jest.mock('../src/utils/push', () => ({ pushCallInvite: jest.fn().mockResolvedValue(), pushToUser: jest.fn().mockResolvedValue() }));
const { randomUUID } = require('crypto');
const { makeUser, befriend, privateConversation } = require('./helpers');
const { db } = require('../src/db/connection');
const registerGroup = require('../src/realtime/handlers/groupCall');
const registerCall = require('../src/realtime/handlers/call');
let devices = [];
function device(userId) {
  const handlers = {}, events = [];
  const io = { to: room => ({ emit: (event, data) => events.push({ room, event, data }),
    except: excluded => ({ emit: (event, data) => events.push({ room, excluded, event, data }) }) }) };
  const socket = { id: randomUUID(), user: { id: userId }, on: (event, fn) => {
    (handlers[event] ||= []).push(fn);
  }, emit: (event, data) => events.push({ room: 'self', event, data }), to: io.to };
  registerCall(io, socket); registerGroup(io, socket);
  const d = { socket, events, send: (event, data) => handlers[event]?.forEach(fn => fn(data)) };
  devices.push(d); return d;
}
async function group() {
  const a = await makeUser(), b = await makeUser(), conv = randomUUID();
  await befriend(a, b); await privateConversation(a, b);
  db.prepare("INSERT INTO conversations (id,type,name) VALUES (?,'group','voice regression')").run(conv);
  for (const u of [a, b]) db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(conv, u.userId);
  const x = device(a.userId), y = device(b.userId);
  x.send('group_call:start', { conversationId: conv, type: 'audio', requestId: 'request-1' });
  const callId = x.events.find(e => e.event === 'group_call:started').data.callId;
  return { x, y, a, b, conv, callId };
}
afterEach(() => { for (const d of devices) d.send('disconnect'); devices = []; });

test('group media is routed only to the participating device', async () => {
  const {x,y,a,b,callId}=await group(); y.send('group_call:join',{callId});
  const spare=device(b.userId); spare.send('group_call:join',{callId});
  expect(spare.events.at(-1).data.reason).toBe('busy'); spare.events.length=0;
  spare.send('group_call:answer',{callId,to:a.userId,answer:{type:'answer',sdp:'stale'}});
  spare.send('group_call:leave',{callId}); spare.send('disconnect');
  expect(spare.events).toHaveLength(0);
  expect(registerGroup._state.groupCalls.get(callId).members.has(b.userId)).toBe(true);
  x.send('group_call:offer',{callId,to:b.userId,offer:{type:'offer',sdp:'valid'}});
  expect(x.events.at(-1)).toMatchObject({event:'group_call:offer',room:y.socket.id});
});

test('disconnect of actual participant removes it even with another online device',async()=>{
  const {x,y,b,callId}=await group(); y.send('group_call:join',{callId}); device(b.userId);
  y.send('disconnect');
  expect(registerGroup._state.groupCalls.get(callId).members.has(b.userId)).toBe(false);
  expect(y.events.at(-1)).toMatchObject({event:'group_call:peer_left',room:x.socket.id});
});

test('pending start can be cancelled by request ID; last leave dismisses invitations',async()=>{
  const {x,callId,conv}=await group();
  x.send('group_call:leave',{requestId:'other'});
  expect(registerGroup._state.groupCalls.has(callId)).toBe(true);
  x.send('group_call:leave',{requestId:'request-1'});
  expect(registerGroup._state.groupCalls.has(callId)).toBe(false);
  expect(x.events.at(-1)).toMatchObject({event:'group_call:ended',room:conv,data:{callId}});
});

test('direct calls cannot overlap a group call, and released membership permits direct calls',async()=>{
  const {x,y,a,callId}=await group();
  y.send('call:request',{to:a.userId,type:'audio'});
  expect(y.events.find(e=>e.event==='call:response')).toMatchObject({data:{accepted:false,busy:true}});
  x.send('group_call:leave',{callId});
  const spare=device(a.userId); spare.send('call:request',{to:y.socket.user.id,type:'audio'});
  expect(spare.events.some(e=>e.event==='call:incoming')).toBe(true);
});

test('an active direct caller cannot join a group call',async()=>{
  const {x,y,a,b,callId}=await group();
  x.send('group_call:leave',{callId});
  y.send('call:request',{to:a.userId,type:'audio'});
  // Use another group with a third member as host.
  const c=await makeUser(), conv=randomUUID(), z=device(c.userId);
  db.prepare("INSERT INTO conversations (id,type) VALUES (?,'group')").run(conv);
  for(const id of [c.userId,b.userId]) db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(conv,id);
  z.send('group_call:start',{conversationId:conv,type:'audio'});
  const id=z.events.find(e=>e.event==='group_call:started').data.callId;
  y.events.length=0; y.send('group_call:join',{callId:id});
  expect(y.events.at(-1)).toMatchObject({event:'group_call:error',data:{reason:'busy',callId:id}});
});

test.each(['start','join','offer','answer','ice','leave'])('malformed group_call:%s cannot crash handler',async event=>{
  const u=await makeUser(),d=device(u.userId);
  for(const p of [null,undefined,[],42,'bad',{}, {callId:{}}]) expect(()=>d.send(`group_call:${event}`,p)).not.toThrow();
  expect(d.events.every(e=>e.event==='group_call:error'&&e.data.reason==='invalid_payload')).toBe(true);
});
