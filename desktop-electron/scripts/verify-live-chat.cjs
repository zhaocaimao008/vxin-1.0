const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async(page,out)=>{
 const state=JSON.parse(process.env.VXIN_ACCEPTANCE_ACCOUNTS_JSON||'{}');assert(state.accounts?.length>=2,'Private acceptance account secret is required');
 const [a,b]=state.accounts;
 async function api(account,url,body,method='POST'){
  const r=await fetch(state.base+url,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+account.token},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert(r.ok,'QA API HTTP '+r.status);return d;
 }
 const auth=await api(b,'/api/auth/login',{loginType:'vxin',identifier:b.identifier,password:b.password});b.token=auth.token;
 await page.getByRole('button',{name:'v信登录',exact:true}).click();await page.getByTestId('login-vxin-input').fill(a.identifier);await page.getByTestId('login-password-input').fill(a.password);
 for(const cb of await page.locator('input[type=checkbox]').all())await cb.check({force:true});
 await page.getByTestId('login-submit-btn').click();await page.getByTestId('conv-item-'+state.privateId).click({timeout:30000});
 const stamp=Date.now().toString(36),sent='Windows验收 '+stamp;
 await page.getByTestId('chat-msg-input').fill(sent);await page.getByTestId('chat-send-btn').click();
 let rows=[];for(let i=0;i<30;i++){rows=await api(b,'/api/messages/'+state.privateId+'?limit=50',undefined,'GET');if(rows.some(x=>x.content===sent))break;await page.waitForTimeout(500);}assert.equal(rows.filter(x=>x.content===sent).length,1);
 const reply='Windows收到 '+stamp;await api(b,'/api/messages/'+state.privateId,{content:reply,type:'text'});await page.locator('[data-testid^="msg-bubble-"]').filter({hasText:reply}).last().waitFor({timeout:20000});
 const draft='Windows草稿 '+stamp;await page.getByTestId('chat-msg-input').fill(draft);await page.reload();await page.getByTestId('conv-item-'+state.privateId).click({timeout:30000});assert.equal(await page.getByTestId('chat-msg-input').inputValue(),draft);await page.getByTestId('chat-msg-input').fill('');
 await page.screenshot({path:path.join(out,'windows-live-chat.png')});
 return {login:true,sentOnce:true,received:true,draftAfterReload:true};
};
