'use strict';
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');
const { seedUsers, uniquePhone, befriendAndOpenConv, authReq } = require('../../shared/backend/seed');

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

async function setup(makeCtx, baseURL, relay = false, count = 3) {
  const users = await seedUsers(Array.from({length:count},()=>{const phone=uniquePhone();return {phone,username:`Group${phone}`};}));
  for(const user of users.slice(1)) await befriendAndOpenConv(users[0],user);
  const group = await authReq('POST','/api/messages/conversation/group',users[0].token,{name:`Voice${Date.now()}`,memberIds:users.slice(1).map(u=>u.id)});
  const id=group.id || group.conversationId;
  async function login(user) {
    const context=await makeCtx();await context.grantPermissions(['microphone','camera']);
    await context.addInitScript(forceRelay=>{
      const Native=RTCPeerConnection;window.groupPeers=[];window.groupStreams=[];
      window.RTCPeerConnection=class extends Native {constructor(config){super({...config,...(forceRelay?{iceTransportPolicy:'relay'}:{})});window.groupPeers.push(this);}};
      const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=async c=>{const s=await gum(c);window.groupStreams.push(s);return s;};
    },relay);
    const page=await context.newPage(), chat=new ChatPage(page), lp=new LoginPage(page);
    await lp.gotoLogin(baseURL);await lp.login(user.phone,user.password);await chat.waitReady();await chat.openConv(id);await chat.waitSocketConnected();
    return {page,context};
  }
  const clients=[];for(const user of users)clients.push(await login(user));
  return {users,clients,login};
}
async function stats(page) {
  return page.evaluate(async()=>Promise.all(window.groupPeers.filter(pc=>pc.connectionState!=='closed').map(async pc=>{
    const rows=await pc.getStats(),values=[...rows.values()];
    const transport=values.find(s=>s.type==='transport'&&s.selectedCandidatePairId),pair=transport&&rows.get(transport.selectedCandidatePairId);
    return {state:pc.connectionState,audio:values.find(s=>s.type==='inbound-rtp'&&s.kind==='audio')?.bytesReceived||0,
      video:values.find(s=>s.type==='inbound-rtp'&&s.kind==='video')?.framesDecoded||0,
      candidate:pair&&rows.get(pair.localCandidateId)?.candidateType};
  })));
}
for(const relay of [false,true]) for(const kind of ['audio','video']) {
  test(`GROUP MEDIA three participants ${kind} ${relay?'TURN relay':'direct'}`,async({makeCtx,baseURL},info)=>{
    test.skip(relay&&!process.env.TURN_URLS,'Requires isolated TURN server');
    const {clients,users,login}=await setup(makeCtx,baseURL,relay);
    const pages=clients.map(c=>c.page);
    await pages[0].getByRole('button',{name:kind==='audio'?'群语音通话':'群视频通话',exact:true}).click();
    for(const page of pages.slice(1))await page.getByRole('button',{name:'加入',exact:true}).click();
    for(const page of pages)await expect.poll(async()=>{
      const peers=await stats(page);return peers.length===2&&peers.every(s=>s.state==='connected'&&s.audio>0&&(kind==='audio'||s.video>0)&&(!relay||s.candidate==='relay'));
    },{timeout:25000}).toBe(true);
    await info.attach('three-party-media.json',{body:JSON.stringify(await Promise.all(pages.map(stats)),null,2),contentType:'application/json'});
    const spare=await login(users[0]);await spare.context.close();
    for(const page of pages)expect((await stats(page)).every(s=>s.state==='connected')).toBe(true);
    await pages[0].getByRole('button',{name:'静音',exact:true}).click();
    expect(await pages[0].evaluate(()=>window.groupStreams[0].getAudioTracks()[0].enabled)).toBe(false);
    await pages[0].getByRole('button',{name:'挂断',exact:true}).click();
    for(const page of pages.slice(1))await expect.poll(async()=> (await stats(page)).length).toBe(1);
    for(const page of pages.slice(1))await page.getByRole('button',{name:'挂断',exact:true}).click();
    for(const page of pages) {
      await expect(page.getByRole('dialog',{name:'群通话'})).toBeHidden();
      expect(await page.evaluate(()=>window.groupPeers.every(pc=>pc.connectionState==='closed')&&window.groupStreams.flatMap(s=>s.getTracks()).every(t=>t.readyState==='ended'))).toBe(true);
    }
  });
}

test('group permission arriving after hangup stops tracks and sends no invite',async({makeCtx,baseURL})=>{
  const {clients}=await setup(makeCtx,baseURL,false,2),[a,b]=clients.map(c=>c.page);
  await a.evaluate(()=>{const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await gum(c);await new Promise(r=>window.releaseGroupMedia=r);return s;};});
  await a.getByRole('button',{name:'群语音通话',exact:true}).click();await a.waitForFunction(()=>window.releaseGroupMedia);
  await a.getByRole('button',{name:'挂断',exact:true}).click();await a.evaluate(()=>window.releaseGroupMedia());
  await expect.poll(()=>a.evaluate(()=>window.groupStreams.flatMap(s=>s.getTracks()).every(t=>t.readyState==='ended'))).toBe(true);
  await expect(b.getByRole('button',{name:'加入',exact:true})).toBeHidden();
});

test('group without SDP times out; ending the last participant clears invitation',async({makeCtx,baseURL})=>{
  const {clients}=await setup(makeCtx,baseURL,false,3),[a,b,c]=clients.map(x=>x.page);
  await a.evaluate(()=>{const socket=window.__vxinSocket,emit=socket.emit.bind(socket);socket.emit=(e,...args)=>e==='group_call:offer'?socket:emit(e,...args);});
  await a.getByRole('button',{name:'群语音通话',exact:true}).click();
  await b.clock.install();await b.getByRole('button',{name:'加入',exact:true}).click();
  await b.waitForFunction(()=>window.groupPeers.length===1);await b.clock.fastForward(31000);
  await expect(b.getByRole('dialog',{name:'群通话'})).toBeHidden();
  await a.getByRole('button',{name:'挂断',exact:true}).click();
  await expect(c.getByRole('button',{name:'加入',exact:true})).toBeHidden();
});
