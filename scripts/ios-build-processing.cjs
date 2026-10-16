const crypto=require('node:crypto'),fs=require('node:fs');
const key=Buffer.from(process.env.ASC_API_KEY_BASE64,'base64').toString('utf8');
function token(){
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:'ES256',kid:process.env.ASC_KEY_ID,typ:'JWT'})).toString('base64url');
 const claims=Buffer.from(JSON.stringify({iss:process.env.ASC_ISSUER_ID,iat:now-30,exp:now+600,aud:'appstoreconnect-v1'})).toString('base64url');
 const input=header+'.'+claims;
 return input+'.'+crypto.sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
async function get(path){
 for(let attempt=0;attempt<5;attempt++){
  try{
   const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{headers:{Authorization:'Bearer '+token()},signal:AbortSignal.timeout(30000)});
   const data=await response.json();
   if(response.ok)return data;
   const error=Error('App Store Connect HTTP '+response.status+' for '+path+': '+JSON.stringify(data.errors?.map(e=>({status:e.status,code:e.code,title:e.title}))));
   if(response.status<500||attempt===4)throw error;
   console.log('Apple API temporary error, retrying:',response.status);
  }catch(error){
   if(attempt===4||error.message.startsWith('App Store Connect HTTP '))throw error;
   console.log('Apple API request failed, retrying:',error.message);
  }
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
}
(async()=>{
 const expectedVersion=process.env.EXPECTED_VERSION;
 const expectedBuild=process.env.EXPECTED_BUILD_NUMBER;
 if(!/^\d+\.\d+\.\d+$/.test(expectedVersion||'')||!/^\d+$/.test(expectedBuild||''))throw Error('Expected IPA version and build number are required');
 const app=(await get('apps?filter[bundleId]=com.vxin.app')).data[0];
 if(!app)throw Error('Expected com.vxin.app not found');
 for(let attempt=0;attempt<30;attempt++){
  const build=(await get('builds?filter[app]='+encodeURIComponent(app.id)+'&filter[version]='+expectedBuild)).data[0];
  const state=build?.attributes.processingState||'WAITING_FOR_BUILD';
  const result={bundleId:'com.vxin.app',version:expectedVersion,buildNumber:expectedBuild,buildId:build?.id||null,processingState:state,expired:build?.attributes.expired??null,checkedAt:new Date().toISOString(),externalReviewSubmitted:false};
  if(build){
   try{
    const detail=await get('builds/'+encodeURIComponent(build.id)+'/buildBetaDetail');
    result.betaState=detail.data.attributes;
   }catch(error){
    if(!error.message.startsWith('App Store Connect HTTP 404 '))throw error;
    result.betaState=null;
   }
  }
  fs.writeFileSync('ios-distribution-result.json',JSON.stringify(result,null,2));
  console.log('Apple processing state:',state);
  if(process.env.CHECK_ONCE==='true')return;
  if(state==='VALID'){console.log('Uploaded build is valid in App Store Connect');return;}
  if(['FAILED','INVALID'].includes(state))throw Error('Apple rejected processing: '+state);
  await new Promise(r=>setTimeout(r,30000));
 }
 throw Error('Apple processing still pending; inspect saved result');
})().catch(e=>{console.error(e.message);process.exit(1)});
