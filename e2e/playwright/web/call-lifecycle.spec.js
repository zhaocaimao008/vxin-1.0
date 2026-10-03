'use strict';
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage } = require('../pages/ChatPage');
const { seedUsers, uniquePhone, befriendAndOpenConv } = require('../../shared/backend/seed');
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});
async function pair(makeCtx,baseURL){
 const users=await seedUsers([uniquePhone(),uniquePhone()].map(phone=>({username:`VA${phone}`,phone})));
 const conv=await befriendAndOpenConv(users[0],users[1]);
 async function login(user){
  const context=await makeCtx();await context.grantPermissions(['microphone']);
  await context.addInitScript(()=>{const Native=RTCPeerConnection;window.auditPeers=[];window.RTCPeerConnection=class extends Native{constructor(config){super(config);window.auditPeers.push(this);}};});
  const page=await context.newPage(),chat=new ChatPage(page),lp=new LoginPage(page);
  await lp.gotoLogin(baseURL);await lp.login(user.phone,user.password);await chat.waitReady();await chat.openConv(conv);await chat.waitSocketConnected();
  return {context,page,chat};
 }
 const a=await login(users[0]),b=await login(users[1]);
 return {a,b,users,login,async call(){await a.chat.startCall('audio');await b.page.getByTestId('call-accept-btn').click();for(const p of [a.page,b.page])await p.waitForFunction(()=>window.auditPeers.at(-1)?.connectionState==='connected',null,{timeout:20000});}};
}
test('REGRESSION: closing an idle second device must not hang up the active audio call',async({makeCtx,baseURL},info)=>{
 const p=await pair(makeCtx,baseURL), spare=await p.login(p.users[0]);
 await p.call();
 await p.b.page.evaluate(()=>{window.auditEnds=[];window.__vxinSocket.on('call:end',e=>window.auditEnds.push(e));});
 await spare.context.close();await p.b.page.waitForTimeout(700);
 const result=await p.b.page.evaluate(()=>({ends:window.auditEnds.map(e=>({reason:e.reason})),state:window.auditPeers.at(-1)?.connectionState,text:document.querySelector('[data-testid=call-modal]')?.innerText}));
 await info.attach('idle-device-disconnect.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 console.log('IDLE_DEVICE_RESULT',JSON.stringify(result));
 expect(result.ends).toHaveLength(0);
 expect(result.state).toBe('connected');
});
test('REGRESSION: minimized voice hangup button must terminate the real call',async({makeCtx,baseURL},info)=>{
 const p=await pair(makeCtx,baseURL);await p.call();
 await p.a.page.getByRole('button',{name:'缩小',exact:true}).click();
 await p.a.page.getByRole('button',{name:'挂断',exact:true}).click();
 await p.a.page.waitForTimeout(700);
 const result=await p.a.page.evaluate(()=>({state:window.auditPeers.at(-1)?.connectionState,expanded:!!document.querySelector('[data-testid=call-modal]')}));
 await info.attach('minimized-hangup.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 console.log('MINIMIZED_HANGUP_RESULT',JSON.stringify(result));
 expect(result.state).toBe('closed');
});

test('late microphone permission after hangup releases every track and never rings the peer',async({makeCtx,baseURL})=>{
 const p=await pair(makeCtx,baseURL);
 await p.a.page.evaluate(()=>{
  const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.lateMedia=[];
  navigator.mediaDevices.getUserMedia=async constraints=>{
   const stream=await gum(constraints);window.lateMedia.push(stream);
   await new Promise(resolve=>window.releaseMedia=resolve);return stream;
  };
 });
 await p.a.chat.startCall('audio');
 await p.a.page.waitForFunction(()=>window.releaseMedia);
 await p.a.page.getByTestId('call-hangup-btn').click();
 await expect(p.a.page.getByTestId('call-modal')).toBeHidden();
 await p.a.page.evaluate(()=>window.releaseMedia());
 await expect.poll(()=>p.a.page.evaluate(()=>window.lateMedia.flatMap(s=>s.getTracks()).every(t=>t.readyState==='ended'))).toBe(true);
 expect(await p.a.page.evaluate(()=>window.auditPeers.length)).toBe(0);
 await expect(p.b.page.getByTestId('call-modal')).toBeHidden();
});

test('an answered call with no offer times out on the callee and releases both peers',async({makeCtx,baseURL})=>{
 const p=await pair(makeCtx,baseURL);
 await p.a.page.evaluate(()=>{
  const socket=window.__vxinSocket, emit=socket.emit.bind(socket);
  socket.emit=(event,...args)=>event==='call:offer' ? socket : emit(event,...args);
 });
 await p.a.chat.startCall('audio');
 await p.b.page.clock.install();
 await p.b.page.getByTestId('call-accept-btn').click();
 await p.b.page.waitForFunction(()=>window.auditPeers.length===1);
 await p.b.page.clock.fastForward(31000);
 await expect.poll(()=>p.b.page.evaluate(()=>window.auditPeers[0].connectionState)).toBe('closed');
 await expect.poll(()=>p.a.page.evaluate(()=>window.auditPeers[0].connectionState)).toBe('closed');
});

test('another callee device cannot reject or hang up the accepted session',async({makeCtx,baseURL})=>{
 const p=await pair(makeCtx,baseURL),spare=await p.login(p.users[1]);
 await p.call();
 await expect(spare.page.getByTestId('call-modal')).toBeHidden();
 await spare.page.evaluate(peer=>{
  window.__vxinSocket.emit('call:response',{to:peer,accepted:false});
  window.__vxinSocket.emit('call:end',{to:peer});
 },p.users[0].id);
 await spare.context.close();
 await p.a.page.waitForTimeout(700);
 for(const page of [p.a.page,p.b.page]) expect(await page.evaluate(()=>window.auditPeers.at(-1).connectionState)).toBe('connected');
});
