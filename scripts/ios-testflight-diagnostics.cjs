// Read only: App Store Connect launch signatures and tester crash feedback.
// Output excludes tester identities and full crash logs.
const crypto = require('node:crypto');

const key = Buffer.from(process.env.ASC_API_KEY_BASE64 || '', 'base64').toString('utf8');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: process.env.ASC_ISSUER_ID, iat: now - 30, exp: now + 600, aud: 'appstoreconnect-v1' })).toString('base64url');
  const input = `${header}.${claims}`;
  return `${input}.${crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

async function get(path) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw Error(`App Store Connect ${response.status}: ${(data.errors || []).map(e => e.code).join(',')}`);
  return data;
}

(async () => {
  const app = (await get('apps?filter[bundleId]=com.vxin.app')).data[0];
  if (!app) throw Error('com.vxin.app was not found');
  const build = (await get(`builds?filter[app]=${encodeURIComponent(app.id)}&filter[version]=1791594513`)).data[0];
  if (!build) throw Error('TestFlight build 1791594513 was not found');
  console.log('Inspecting TestFlight build 8.0.5 / 1791594513');

  for (const type of ['LAUNCHES', 'HANGS']) {
    try {
      const signatures = (await get(`builds/${build.id}/diagnosticSignatures?filter[diagnosticType]=${type}&limit=20`)).data;
      console.log(`${type} signatures: ${signatures.length}`);
      for (const item of signatures) {
        const { signature, weight } = item.attributes || {};
        console.log(JSON.stringify({ type, signature, weight }));
      }
    } catch (error) {
      console.log(`${type} diagnostics unavailable: ${error.message}`);
    }
  }

  try {
    const reports = (await get(`apps/${app.id}/betaFeedbackCrashSubmissions?limit=50`)).data;
    const current = reports.filter(item => item.relationships?.build?.data?.id === build.id);
    console.log(`Crash feedback: ${reports.length} recent reports, ${current.length} for this build`);
    for (const item of current) {
      const a = item.attributes || {};
      console.log(JSON.stringify({ createdDate: a.createdDate, deviceModel: a.deviceModel, osVersion: a.osVersion, appUptimeInMilliseconds: a.appUptimeInMilliseconds }));
      try {
        const log = (await get(`betaFeedbackCrashSubmissions/${item.id}/crashLog`)).data?.attributes?.logText || '';
        console.log(log.split('\n').filter(line => /^(Exception Type|Termination Reason|Triggered by Thread|Last Exception Backtrace|\d+\s+Vxin\b)/.test(line)).slice(0, 12).join('\n'));
      } catch (error) {
        console.log(`Crash log unavailable: ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`Crash feedback unavailable: ${error.message}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
