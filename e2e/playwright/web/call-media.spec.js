'use strict';
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

async function observeMedia(context, relay) {
  await context.grantPermissions(['microphone', 'camera']);
  await context.addInitScript(forceRelay => {
    const Native = window.RTCPeerConnection;
    window.__mediaPeers = [];
    window.RTCPeerConnection = class extends Native {
      constructor(config) {
        super({ ...config, ...(forceRelay ? { iceTransportPolicy: 'relay' } : {}) });
        window.__mediaPeers.push(this);
      }
    };
  }, relay);
}

async function mediaStats(page) {
  return page.evaluate(async () => {
    const pc = window.__mediaPeers.at(-1);
    if (!pc) return null;
    const stats = await pc.getStats();
    const incoming = [...stats.values()].filter(s => s.type === 'inbound-rtp');
    const transport = [...stats.values()].find(s => s.type === 'transport' && s.selectedCandidatePairId);
    const pair = transport && stats.get(transport.selectedCandidatePairId);
    return {
      state: pc.connectionState,
      audio: incoming.find(s => s.kind === 'audio')?.bytesReceived || 0,
      video: incoming.find(s => s.kind === 'video')?.framesDecoded || 0,
      candidate: pair && stats.get(pair.localCandidateId)?.candidateType,
      tracks: pc.getSenders().map(s => ({ kind: s.track?.kind, enabled: s.track?.enabled, state: s.track?.readyState })),
    };
  });
}

for (const relay of [false, true]) {
  for (const kind of ['audio', 'video']) {
    test(`MEDIA ${kind} ${relay ? 'TURN relay' : 'direct'} 双向媒体、静音、挂断释放`, async ({ makeCtx, seeded, baseURL }, info) => {
      test.skip(relay && !process.env.TURN_URLS, '此项必须配置独立 coturn 和 TURN_SECRET；未配置不计为通过');
      const contexts = await Promise.all([makeCtx(), makeCtx()]);
      await Promise.all(contexts.map(ctx => observeMedia(ctx, relay)));
      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
      const chats = pages.map(page => new ChatPage(page));
      for (let i = 0; i < pages.length; i++) {
        const login = new LoginPage(pages[i]);
        await login.gotoLogin(baseURL);
        await login.login(seeded.users[i].phone, seeded.users[i].password);
        await chats[i].waitReady();
        await chats[i].openConv(seeded.convAB);
      }
      await chats[0].startCall(kind);
      await pages[1].getByTestId('call-accept-btn').click();
      for (const page of pages) {
        await expect.poll(async () => {
          const s = await mediaStats(page);
          return !!s && s.state === 'connected' && s.audio > 0 && (kind === 'audio' || s.video > 0) && (!relay || s.candidate === 'relay');
        }, { timeout: 25000 }).toBe(true);
      }
      await info.attach('bidirectional-media.json', { body: JSON.stringify(await Promise.all(pages.map(mediaStats)), null, 2), contentType: 'application/json' });
      await pages[0].getByRole('button', { name: '静音', exact: true }).click();
      await expect.poll(async () => (await mediaStats(pages[0])).tracks.find(t => t.kind === 'audio').enabled).toBe(false);
      await chats[0].hangup();
      for (const page of pages) {
        await expect(page.getByTestId('call-modal')).toBeHidden();
        await expect.poll(() => page.evaluate(() => window.__mediaPeers.every(pc => pc.connectionState === 'closed'))).toBe(true);
      }
    });
  }
}
