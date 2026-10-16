'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const cfg = JSON.parse(fs.readFileSync('ios/testflight-config.json', 'utf8'));
const demo = JSON.parse(process.env.VXIN_REVIEW_ACCOUNT_JSON || '{}');
const version = process.env.EXPECTED_VERSION;
const buildNumber = process.env.EXPECTED_BUILD_NUMBER;
const buildId = process.env.EXPECTED_BUILD_ID;
const result = { bundleId: 'com.vxin.app', version, buildNumber, buildId, externalReviewSubmitted: false, checkedAt: new Date().toISOString() };

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: process.env.ASC_ISSUER_ID, iat: now - 30, exp: now + 600, aud: 'appstoreconnect-v1' })).toString('base64url');
  const input = `${header}.${claims}`;
  const key = Buffer.from(process.env.ASC_API_KEY_BASE64 || '', 'base64').toString('utf8');
  return `${input}.${crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function api(path, method = 'GET', data, allow404 = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        ...(data ? { body: JSON.stringify({ data }) } : {}),
        signal: AbortSignal.timeout(30000),
      });
      if (allow404 && response.status === 404) return { data: null };
      const body = response.status === 204 ? {} : await response.json();
      if (response.ok) return body;
      const error = Error(`${method} ${path} HTTP ${response.status}: ${JSON.stringify(body.errors?.map(e => ({ code: e.code, title: e.title })))}`);
      if (method !== 'GET' || response.status < 500 || attempt === 4) throw error;
      console.log(`Apple API ${response.status}; retrying read`);
    } catch (error) {
      if (method !== 'GET' || attempt === 4 || error.message.startsWith(`${method} ${path} HTTP `)) throw error;
      console.log(`Apple API read timed out; retrying: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function localized(path, type, attributes, relationship) {
  const rows = (await api(path)).data;
  const current = rows.find(item => item.attributes.locale === 'zh-Hans');
  if (current) return api(`${type}/${current.id}`, 'PATCH', { type, id: current.id, attributes });
  return api(type, 'POST', { type, attributes: { ...attributes, locale: 'zh-Hans' }, relationships: relationship });
}

(async () => {
  assert(/^\d+\.\d+\.\d+$/.test(version || '') && /^\d+$/.test(buildNumber || '') && /^[a-f0-9-]{36}$/.test(buildId || ''), 'Exact build identity is required');
  assert(/^0\d{10}$/.test(demo.phone || '') && demo.password?.length >= 16, 'Private review account secret is missing');
  for (const key of ['contact_first', 'contact_last', 'contact_email', 'contact_phone', 'feedback_email', 'description', 'group_name']) assert(cfg[key]?.trim(), `Missing review metadata: ${key}`);

  const login = await fetch('https://vxinchat.com/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: demo.phone, password: demo.password }),
    signal: AbortSignal.timeout(30000),
  });
  assert(login.ok, `Review account login failed on current server: HTTP ${login.status}`);
  const auth = await login.json();
  assert.equal(auth.user.phone, demo.phone);
  result.demoLoginVerified = true;

  const app = (await api('apps?filter[bundleId]=com.vxin.app')).data[0];
  assert(app, 'Expected app not found');
  const build = (await api(`builds?filter[app]=${encodeURIComponent(app.id)}&filter[version]=${buildNumber}`)).data[0];
  assert.equal(build?.id, buildId, 'App Store Connect build ID does not match the validated IPA');
  assert.equal(build.attributes.processingState, 'VALID');
  assert.equal(build.attributes.expired, false);
  assert.equal(build.attributes.usesNonExemptEncryption, false);

  const group = (await api(`apps/${app.id}/betaGroups?limit=200`)).data.find(item => item.attributes.name === cfg.group_name);
  assert(group && !group.attributes.isInternalGroup && group.attributes.publicLinkEnabled, 'Existing public beta group is required');
  assert((await api(`betaGroups/${group.id}/betaTesters?limit=1`)).data.length > 0, 'Public beta group has no testers');
  result.groupId = group.id;
  console.log('Verified exact valid build, working demo login, and existing public tester group.');

  await localized(`apps/${app.id}/betaAppLocalizations`, 'betaAppLocalizations',
    { feedbackEmail: cfg.feedback_email, description: cfg.description },
    { app: { data: { type: 'apps', id: app.id } } });
  await localized(`builds/${build.id}/betaBuildLocalizations`, 'betaBuildLocalizations',
    { whatsNew: '修复 iOS 启动时旧服务器不可用导致的长时间停留，更新服务器地址与启动超时处理。' },
    { build: { data: { type: 'builds', id: build.id } } });

  const attributes = {
    contactFirstName: cfg.contact_first, contactLastName: cfg.contact_last,
    contactEmail: cfg.contact_email, contactPhone: cfg.contact_phone,
    demoAccountRequired: true, demoAccountName: demo.phone, demoAccountPassword: demo.password,
    notes: '服务器：https://vxinchat.com。请在默认的手机登录页使用演示账号和密码；该号码是专用测试标识，无需短信验证码。审核账号仅含专用测试数据。应用支持单聊、群聊和媒体消息，通话需允许麦克风和相机权限。',
  };
  const detail = (await api(`apps/${app.id}/betaAppReviewDetail`, 'GET', undefined, true)).data;
  if (detail) await api(`betaAppReviewDetails/${detail.id}`, 'PATCH', { type: 'betaAppReviewDetails', id: detail.id, attributes });
  else await api('betaAppReviewDetails', 'POST', { type: 'betaAppReviewDetails', attributes, relationships: { app: { data: { type: 'apps', id: app.id } } } });

  const assigned = (await api(`betaGroups?filter[builds]=${encodeURIComponent(build.id)}&limit=200`)).data;
  if (!assigned.some(item => item.id === group.id)) await api(`betaGroups/${group.id}/relationships/builds`, 'POST', [{ type: 'builds', id: build.id }]);
  result.groupAssigned = true;

  let submission = (await api(`builds/${build.id}/betaAppReviewSubmission`, 'GET', undefined, true)).data;
  if (!submission) submission = (await api('betaAppReviewSubmissions', 'POST', { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } })).data;
  result.externalReviewSubmitted = true;
  result.reviewState = submission.attributes?.betaReviewState;
  result.submissionId = submission.id;
  console.log(`Public beta build assigned; external review state: ${result.reviewState}`);
})().catch(error => {
  result.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => fs.writeFileSync('ios-current-review-result.json', JSON.stringify(result, null, 2)));
