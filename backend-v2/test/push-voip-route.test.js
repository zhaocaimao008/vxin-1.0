'use strict';
const { EventEmitter } = require('events');
const { generateKeyPairSync } = require('crypto');
jest.mock('http2', () => ({ connect: jest.fn() }));
const http2 = require('http2');
const { sendVoipPush } = require('../src/utils/push');

test.each([undefined, 'group-conversation'])('PushKit preserves the correct invitation route (%s)', async conversationId => {
  const saved = { APNS_KEY_ID: process.env.APNS_KEY_ID, APNS_TEAM_ID: process.env.APNS_TEAM_ID, APNS_P8: process.env.APNS_P8 };
  process.env.APNS_KEY_ID = 'test-key'; process.env.APNS_TEAM_ID = 'test-team';
  process.env.APNS_P8 = generateKeyPairSync('ec', { namedCurve: 'prime256v1', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
  const client = new EventEmitter(), req = new EventEmitter();
  let payload;
  req.setEncoding = () => {};
  req.end = body => { payload = JSON.parse(body); req.emit('response', { ':status': 200 }); req.emit('end'); };
  client.request = jest.fn(() => req); client.close = jest.fn(); http2.connect.mockReturnValue(client);
  try {
    await expect(sendVoipPush('fake-device', { callId: 'call-id', from: 'caller', callType: 'audio', conversationId })).resolves.toEqual({ ok: true });
    expect(payload.type).toBe(conversationId ? 'group_call' : 'call');
    expect(payload.conversationId).toBe(conversationId);
    expect(payload.callId).toBe('call-id');
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
