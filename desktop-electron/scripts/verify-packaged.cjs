const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const { _electron: electron }=require(path.join(process.env.QA_MODULES,'playwright'));
const root=path.resolve(__dirname,'..');
const out=path.resolve(process.env.QA_OUTPUT);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const packaged=path.join(root,'dist/win-unpacked');
 const exe=fs.readdirSync(packaged).find(n=>n.endsWith('.exe')&&!n.startsWith('Uninstall'));
 assert(exe,'Packaged exe not found');
 const app=await electron.launch({executablePath:path.join(packaged,exe),args:['--user-data-dir='+path.join(out,'profile')],env:{...process.env,APPDATA:path.join(out,'appdata'),LOCALAPPDATA:path.join(out,'localappdata')},timeout:60000});
 try {
  let page;
  for(let n=0;n<150;n++){page=app.windows().find(p=>p.url().includes('/web/dist/index.html'));if(page)break;await new Promise(r=>setTimeout(r,200));}
  assert(page,'Main window not found');
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.locator('.auth-page').waitFor({timeout:30000});
  const security=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/web/dist/'));const p=w.webContents.getLastWebPreferences();return {sandbox:p.sandbox,contextIsolation:p.contextIsolation,nodeIntegration:p.nodeIntegration};});
  assert.equal(security.sandbox,true);assert.equal(security.contextIsolation,true);assert.equal(security.nodeIntegration,false);
  const scenes=[];
  for(const [theme,width,height] of [['light',1440,900],['dark',1440,900],['light',900,600]]){
   await page.evaluate(t=>localStorage.setItem('wc_theme',t),theme);
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/web/dist/')).setContentSize(...size),[width,height]);
   await page.reload();await page.locator('.auth-page').waitFor();await page.waitForTimeout(800);
   const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dark:document.body.classList.contains('dark-mode'),password:!!document.querySelector('input[type=password]')}));
   assert(state.password);assert(state.scroll<=state.width);assert.equal(state.dark,theme==='dark');
   await page.screenshot({path:path.join(out,'login-'+theme+'-'+width+'.png'),fullPage:true});scenes.push({theme,width,height,...state});
  }
  const connection=await page.evaluate(async()=>{const cfg=JSON.parse(localStorage.getItem('vxin_remote_config'));const response=await fetch(cfg.api+'/api/config');const body=await response.json();return {endpoint:cfg.api,ok:response.ok&&!!body.features};});
  assert.equal(connection.endpoint,'https://liaotian99.com');assert(connection.ok);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({os:process.platform,scenes,security,connection,errors},null,2));
  console.log('Packaged Windows runtime and production API checks passed');
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
