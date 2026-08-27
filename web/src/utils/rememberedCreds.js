// ================================================================
// rememberedCreds.js — 「记住账户和密码」本地凭证存储
// ----------------------------------------------------------------
// 用途：登录页勾选「记住密码」后，把 手机号 + 密码 存到本地，
// 下次打开登录页 / 点「最近登录」某账户时自动回填，免手输。
//
// ⚠ 安全边界（务必知悉）：
//   · 客户端存储的凭证本质上无法防御 XSS——能执行 JS 的攻击者即可读取。
//     真正的鉴权凭证始终只在后端签发的 httpOnly Cookie / Bearer token 中。
//   · 此处仅为「登录页自动回填」的便利功能，默认关闭，需用户主动勾选。
//   · 存储前做可逆混淆（XOR + base64），只为防止本地明文肉眼可见 / 被顺手
//     翻到，绝非加密。不要据此认为密码在本地是「安全」的。
//   · 桌面端(Electron)/移动端(Capacitor)本就用 Bearer token 持久化免登录，
//     此功能主要惠及网页端「登出后再登录」与多账户切换回填。
//
// 存储结构：localStorage['vxin_remembered_creds_v1'] = JSON({ [phone]: obf(password) })
// 与「最近登录」(vxin_accounts_v2) 解耦：账户记录只存 {id,user}，绝不含密码。
// ================================================================

const KEY = 'vxin_remembered_creds_v1';
const KEY_SEED = 'vxin_remembered_key_v1';
// 固定混淆密钥：仅用于可逆混淆，不承担安全职责（见上方安全边界说明）。
// 审计加固（Web #4）：不再用固定密钥——改用首次使用时随机生成、存于本设备的
// 设备密钥（每设备不同，避免「仓库内固定密钥可直接还原全部已存密码」）。
const LEGACY_OBF_KEY = 'vxin::remember::v1';
let _deviceKey = null;

// 取设备随机密钥（首次生成并持久化；localStorage 不可用时退回首访随机值）
function deviceKey() {
  if (_deviceKey) return _deviceKey;
  try {
    let k = localStorage.getItem(KEY_SEED);
    if (!k || k.length < 16) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      k = btoa(String.fromCharCode(...bytes));
      localStorage.setItem(KEY_SEED, k);
    }
    _deviceKey = k;
  } catch {
    _deviceKey = LEGACY_OBF_KEY;
  }
  return _deviceKey;
}

// XOR + base64 可逆混淆。对 Unicode 密码安全（先 encodeURIComponent 转字节域）。
// @param key 混淆密钥
function obfuscateWith(plain, key) {
  try {
    const s = unescape(encodeURIComponent(String(plain)));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(out);
  } catch {
    return '';
  }
}

function deobfuscateWith(obf, key) {
  try {
    const s = atob(String(obf));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return decodeURIComponent(escape(out));
  } catch {
    return '';
  }
}

function obfuscate(plain) { return obfuscateWith(plain, deviceKey()); }

// 兼容旧数据：先用设备密钥解，失败则试旧固定密钥（旧版本写入的数据）
function deobfuscate(obf) {
  const v = deobfuscateWith(obf, deviceKey());
  if (v) return v;
  return deobfuscateWith(obf, LEGACY_OBF_KEY);
}

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* localStorage 满/隐私模式：静默忽略，记住密码仅为便利功能 */
  }
}

/** 保存某手机号的密码（勾选「记住密码」且登录成功后调用）。 */
export function saveCred(phone, password) {
  if (!phone || !password) return;
  const map = readAll();
  map[phone] = obfuscate(password);
  writeAll(map);
}

/** 读取某手机号已记住的密码；无则返回 ''。 */
export function loadCred(phone) {
  if (!phone) return '';
  const obf = readAll()[phone];
  return obf ? deobfuscate(obf) : '';
}

/** 是否存在某手机号的已记住密码。 */
export function hasCred(phone) {
  return !!phone && !!readAll()[phone];
}

/** 移除某手机号的记住密码（取消勾选 / 移除账户 / 登出该账户时调用）。 */
export function removeCred(phone) {
  if (!phone) return;
  const map = readAll();
  if (phone in map) {
    delete map[phone];
    writeAll(map);
  }
}

/** 返回最近一次记住的手机号（登录页默认回填用）；无则返回 ''。 */
export function lastRememberedPhone() {
  const phones = Object.keys(readAll());
  return phones.length ? phones[phones.length - 1] : '';
}
