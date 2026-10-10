"""Use only dedicated synthetic accounts. Never save app profiles or credential-bearing UI trees."""
import json,os,re,subprocess,time,urllib.request,xml.etree.ElementTree as ET,shlex,sys
from pathlib import Path
state=json.loads(os.environ['VXIN_ACCEPTANCE_ACCOUNTS_JSON']);platform=sys.argv[1];out=Path(os.environ.get('QA_OUTPUT','native-evidence'));out.mkdir(exist_ok=True,parents=True)
checks=[];driver=None
def api(user,path,body=None,method=None):
    r=urllib.request.Request(state['base']+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+user['token']} if user.get('token') else {})},method=method or ('POST' if body is not None else 'GET'))
    with urllib.request.urlopen(r,timeout=25) as response:return json.load(response)
def wait(fn,timeout=45):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        try:
            value=fn()
            if value:return value
        except Exception:pass
        time.sleep(1)
    raise RuntimeError('Timed out waiting for the current acceptance step')
def adb(*args):return subprocess.check_output(['adb',*args],stderr=subprocess.DEVNULL)
class Android:
    def tree(self):
        adb('shell','uiautomator','dump','/sdcard/vxin-qa-window.xml')
        return ET.fromstring(adb('shell','cat','/sdcard/vxin-qa-window.xml'))
    def element(self,tid=None,text=None):
        return next((x for x in self.tree().iter('node') if (tid and x.get('resource-id')==tid) or (text and x.get('text')==text)),None)
    def get(self,tid=None,text=None):
        return wait(lambda:self.element(tid,text) is not None and self.element(tid,text))
    def click(self,tid=None,text=None):
        # ElementTree leaves are falsey, so locate through an explicit list wrapper.
        node=wait(lambda:[x] if (x:=self.element(tid,text)) is not None else None)[0]
        x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')));adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
    def type(self,tid,text):
        self.click(tid);adb('shell','input','text',shlex.quote(text))
    def visible(self,text):return self.element(text=text) is not None
    def back(self):adb('shell','input','keyevent','4')
    def screenshot(self,name):(out/name).write_bytes(adb('exec-out','screencap','-p'))
    def input_value(self,tid):
        n=self.element(tid);return n.get('text') if n is not None else ''
    def relaunch(self):
        adb('shell','am','force-stop','com.vxin.app');adb('shell','am','start','-W','-n','com.vxin.app/.MainActivity')
class IOS:
    def __init__(self):
        global driver
        from appium import webdriver
        from appium.options.ios import XCUITestOptions
        opts=XCUITestOptions();opts.platform_name='iOS';opts.automation_name='XCUITest';opts.udid=os.environ['IOS_UDID'];opts.bundle_id='com.vxin.app';opts.no_reset=True;opts.auto_accept_alerts=True;opts.new_command_timeout=120
        driver=webdriver.Remote('http://127.0.0.1:4723',options=opts);self.d=driver
    def element(self,tid=None,text=None):
        from appium.webdriver.common.appiumby import AppiumBy
        return self.d.find_element(AppiumBy.ACCESSIBILITY_ID,tid or text)
    def click(self,tid=None,text=None):wait(lambda:self.element(tid,text)).click()
    def type(self,tid,text):el=wait(lambda:self.element(tid));el.click();el.send_keys(text)
    def visible(self,text):
        from appium.webdriver.common.appiumby import AppiumBy
        return bool(self.d.find_elements(AppiumBy.IOS_PREDICATE,f'label == "{text}" OR value == "{text}"'))
    def back(self):
        from appium.webdriver.common.appiumby import AppiumBy
        self.d.find_element(AppiumBy.XPATH,'//XCUIElementTypeNavigationBar/XCUIElementTypeButton[1]').click()
    def screenshot(self,name):self.d.save_screenshot(str(out/name))
    def input_value(self,tid):return self.element(tid).get_attribute('value')
    def relaunch(self):self.d.terminate_app('com.vxin.app');self.d.activate_app('com.vxin.app')
try:
    a,b=state['accounts'][:2]
    b['token']=api(b,'/api/auth/login',{'loginType':'vxin','identifier':b['identifier'],'password':b['password']})['token']
    app=Android() if platform=='android' else IOS()
    app.click(text='v信登录');app.type('login-vxin-input',a['identifier']);app.type('login-password-input',a['password'])
    if platform=='android':app.back() # dismiss keyboard before agreement below the form
    app.click('login-agreement-checkbox');app.click('login-submit-btn');app.click('conv-item-'+state['privateId']);checks.append('real-login')
    stamp=str(int(time.time()));sent=platform+'-send-'+stamp
    app.type('chat-msg-input',sent);app.click('chat-send-btn')
    rows=wait(lambda: [x for x in api(b,'/api/messages/'+state['privateId']+'?limit=50') if x['content']==sent])
    assert len(rows)==1;checks.append('sent-once')
    reply=platform+'-receive-'+stamp;api(b,'/api/messages/'+state['privateId'],{'content':reply,'type':'text'})
    wait(lambda:app.visible(reply));checks.append('realtime-receive')
    draft=platform+'-draft-'+stamp;app.type('chat-msg-input',draft)
    if platform=='android':app.back()
    app.back();app.click('conv-item-'+state['privateId']);assert app.input_value('chat-msg-input')==draft;checks.append('draft-navigation')
    app.relaunch();app.click('conv-item-'+state['privateId']);assert app.input_value('chat-msg-input')==draft;checks.append('draft-process-restart')
    app.screenshot(platform+'-live-chat.png')
    # Verify group navigation and receive, scoped to the same two QA accounts.
    app.back();app.click('conv-item-'+state['groupId']);group=platform+'-group-'+stamp
    api(b,'/api/messages/'+state['groupId'],{'content':group,'type':'text'});wait(lambda:app.visible(group));checks.append('group-receive')
    app.screenshot(platform+'-live-group.png')
    result={'platform':platform,'device':'emulator' if platform=='android' else 'simulator','passed':True,'checks':checks}
except Exception as error:
    # Driver exceptions may echo input commands containing a password. Record type and stage only.
    result={'platform':platform,'passed':False,'checks':checks,'errorType':type(error).__name__,'failedAfter':checks[-1] if checks else 'login'}
    try:app.screenshot(platform+'-failure.png')
    except Exception:pass
finally:
    if driver:
        try:driver.quit()
        except Exception:pass
    (out/(platform+'-acceptance.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(0 if result['passed'] else 1)
