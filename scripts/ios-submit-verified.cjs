'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),assert=require('node:assert/strict');
const cfg=JSON.parse(fs.readFileSync('ios/testflight-config.json','utf8'));
const buildNumber='1791594513',expectedBuild='d177eb8d-047b-453f-a6ed-e6a5ab75f584';
const demo=JSON.parse(process.env.VXIN_REVIEW_ACCOUNT_JSON||'{}');
const result={bundleId:'com.vxin.app',version:'8.0.5',buildNumber,externalReviewSubmitted:false,checkedAt:new Date().toISOString()};
function token(){
 const now=Math.floor(Date.now()/1000),head=Buffer.from(JSON.stringify({alg:'ES256',kid:process.env.ASC_KEY_ID,typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:process.env.ASC_ISSUER_ID,iat:now-30,exp:now+600,aud:'appstoreconnect-v1'})).toString('base64url');
 const input=head+'.'+body,key=Buffer.from(process.env.ASC_API_KEY_BASE64,'base64').toString('utf8');
 return input+'.'+crypto.sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
async function api(path,method='GET',data,allow404=false){
 const r=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},...(data?{body:JSON.stringify({data})}:{}),signal:AbortSignal.timeout(40000)});
 if(allow404&&r.status===404)return {data:null};const body=r.status===204?{}:await r.json();
 if(!r.ok)throw Error(method+' '+path+' HTTP '+r.status+' '+JSON.stringify(body.errors?.map(e=>({code:e.code,title:e.title}))));return body;
}
async function localized(path,type,attributes,relationship){
 const rows=(await api(path)).data,cur=rows.find(x=>x.attributes.locale==='zh-Hans');
 if(cur)return api(type+'/'+cur.id,'PATCH',{type,id:cur.id,attributes});
 return api(type,'POST',{type,attributes:{...attributes,locale:'zh-Hans'},relationships:relationship});
}
(async()=>{
 assert(/^\d{6}$/.test(demo.identifier)&&demo.password?.length>=16,'Private review account secret is missing');
 for(const key of ['contact_first','contact_last','contact_email','contact_phone','feedback_email','description'])assert(cfg[key]?.trim(),'Missing review metadata: '+key);
 assert(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.contact_email));assert(/^\+?[1-9]\d{7,14}$/.test(cfg.contact_phone));
 const login=await fetch('https://liaotian99.com/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loginType:'vxin',identifier:demo.identifier,password:demo.password}),signal:AbortSignal.timeout(30000)});
 assert(login.ok,'Review account must be usable before Apple submission');const auth=await login.json();assert.equal(auth.user.wechat_id,demo.identifier);result.demoLoginVerified=true;
 const app=(await api('apps?filter[bundleId]=com.vxin.app')).data[0];assert(app);
 const build=(await api('builds?filter[app]='+app.id+'&filter[version]='+buildNumber)).data[0];assert.equal(build?.id,expectedBuild);assert.equal(build.attributes.processingState,'VALID');assert.equal(build.attributes.expired,false);result.buildId=build.id;
 assert.equal(build.attributes.usesNonExemptEncryption,false,'Encryption declaration must already exist on the verified build');
 console.log('Verified exact Apple build and a working dedicated review account.');
 await localized('apps/'+app.id+'/betaAppLocalizations','betaAppLocalizations',{feedbackEmail:cfg.feedback_email,description:cfg.description},{app:{data:{type:'apps',id:app.id}}});
 await localized('builds/'+build.id+'/betaBuildLocalizations','betaBuildLocalizations',{whatsNew:'本次版本统一品牌与跨端界面。请验证登录、单聊与群聊、图片和语音收发、搜索和断线恢复。'},{build:{data:{type:'builds',id:build.id}}});
 const attributes={contactFirstName:cfg.contact_first,contactLastName:cfg.contact_last,contactEmail:cfg.contact_email,contactPhone:cfg.contact_phone,demoAccountRequired:true,demoAccountName:demo.identifier,demoAccountPassword:demo.password,notes:'服务器：https://liaotian99.com。请在登录页切换到 v信号登录，使用演示账号和密码；无需短信验证码。审核账号仅含专用测试数据。应用支持单聊、群聊和媒体消息，通话需允许麦克风和相机权限。'};
 const detail=(await api('apps/'+app.id+'/betaAppReviewDetail','GET',undefined,true)).data;
 if(detail)await api('betaAppReviewDetails/'+detail.id,'PATCH',{type:'betaAppReviewDetails',id:detail.id,attributes});
 else await api('betaAppReviewDetails','POST',{type:'betaAppReviewDetails',attributes,relationships:{app:{data:{type:'apps',id:app.id}}}});
 const groupName='跨端验收 8.0.5';
 let group=(await api('apps/'+app.id+'/betaGroups?limit=200')).data.find(x=>x.attributes.name===groupName);
 if(!group)group=(await api('betaGroups','POST',{type:'betaGroups',attributes:{name:groupName,isInternalGroup:false,publicLinkEnabled:false},relationships:{app:{data:{type:'apps',id:app.id}}}})).data;
 assert.equal(group.attributes.isInternalGroup,false);assert(!group.attributes.publicLinkEnabled,'Review group must not publish a public invitation');
 assert.equal((await api('betaGroups/'+group.id+'/betaTesters?limit=1')).data.length,0,'Only a dedicated empty group may be modified');
 await api('betaGroups/'+group.id+'/relationships/builds','POST',[{type:'builds',id:build.id}]);
 let submission=(await api('builds/'+build.id+'/betaAppReviewSubmission','GET',undefined,true)).data;
 if(!submission)submission=(await api('betaAppReviewSubmissions','POST',{type:'betaAppReviewSubmissions',relationships:{build:{data:{type:'builds',id:build.id}}}})).data;
 result.externalReviewSubmitted=true;result.reviewState=submission.attributes?.betaReviewState;result.submissionId=submission.id;result.groupId=group.id;result.testersInvited=0;
 result.betaState=(await api('builds/'+build.id+'/buildBetaDetail')).data.attributes;
 console.log('External Beta review submission recorded; no testers invited.');
})().catch(e=>{result.error=e.message;console.error(e.message);process.exitCode=1}).finally(()=>fs.writeFileSync('ios-external-review-result.json',JSON.stringify(result,null,2)));
