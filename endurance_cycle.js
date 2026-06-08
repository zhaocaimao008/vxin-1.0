/**
 * 24小时耐久测试 — 每15分钟跑一轮 (单独运行，用于cron)
 * 
 * 用法: NODE_PATH=/root/v信/backend/node_modules node /root/v信/endurance_cycle.js
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const BASE = 'http://localhost:3002';
const BOTS_FILE = '/root/v信/backend/.bot_tokens.json';

function api(method, ep, body, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3002,
      path: ep,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    if (token) opts.headers['Cookie'] = `vxin_token=${encodeURIComponent(token)}`;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const db = new Database('/root/v信/backend/wechat.db');
  const rows = db.prepare("SELECT id, phone FROM users WHERE phone >= 17700000000 ORDER BY phone").all();
  db.close();
  const tokens = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf-8'));
  const bots = rows.map(r => ({ id: r.id, phone: r.phone, token: tokens[r.phone] })).filter(b => b.token);

  if (bots.length === 0) {
    console.log('ERROR: no bots');
    process.exit(1);
  }

  const results = { profile:0, contacts:0, messages:0, groups:0, errors:[] };
  const start = Date.now();

  // 1. 1500 profile (6 batches × 250)
  for (let i = 0; i < bots.length; i += 250) {
    const batch = bots.slice(i, i + 250);
    const r = await Promise.all(batch.map(b => api('GET', `/api/users/${b.id}`, null, b.token)));
    results.profile += r.filter(x => x.status === 200).length;
  }

  // 2. 1500 contacts (6 batches × 250)
  for (let i = 0; i < bots.length; i += 250) {
    const batch = bots.slice(i, i + 250);
    const r = await Promise.all(batch.map(b => api('GET', '/api/users/contacts', null, b.token)));
    results.contacts += r.filter(x => x.status === 200).length;
  }

  // 3. 100 messages
  let msgOk = 0;
  for (let i = 0; i < 100; i += 10) {
    const batch = [];
    for (let j = i; j < i + 10 && j < 100; j++) {
      const s = bots[j * 15 % bots.length];
      const r = bots[(j * 15 + 1) % bots.length];
      batch.push(
        api('POST', '/api/messages/conversation/private', { userId: r.id }, s.token).then(conv => {
          if (conv.status === 200 && conv.data?.conversationId) {
            return api('POST', `/api/messages/${conv.data.conversationId}`, { content: `耐久 ${Date.now()}`, type: 'text' }, s.token);
          }
          return conv;
        })
      );
    }
    const r = await Promise.all(batch);
    msgOk += r.filter(x => x.status === 200).length;
  }
  results.messages = msgOk;

  // 4. Create 5 groups
  let grpOk = 0;
  const groupReqs = [];
  for (let g = 0; g < 5; g++) {
    const c = bots[g * 300 % bots.length];
    const mids = [];
    for (let m = 0; m < 10; m++) mids.push(bots[(g * 300 + m + 1) % bots.length].id);
    groupReqs.push(api('POST', '/api/messages/conversation/group', { name: `耐久群${g}_${Date.now()}`, memberIds: mids }, c.token));
  }
  const grpResults = await Promise.all(groupReqs);
  grpOk = grpResults.filter(r => r.status === 200).length;
  results.groups = grpOk;

  // Send messages in created groups
  for (const gr of grpResults) {
    if (gr.status === 200 && gr.data?.conversationId) {
      await api('POST', `/api/messages/${gr.data.conversationId}`, { content: '群耐久测试', type: 'text' }, bots[0].token);
    }
  }

  // 5. Mixed 200 search + profile updates
  let mixedOk = 0;
  const mixedReqs = [];
  for (let i = 0; i < 200; i++) {
    const b = bots[i % bots.length];
    if (i < 80) mixedReqs.push(api('GET', `/api/users/${b.id}`, null, b.token));
    else if (i < 160) mixedReqs.push(api('GET', '/api/users/contacts', null, b.token));
    else mixedReqs.push(api('GET', '/api/users/search?q=%E6%9C%BA%E5%99%A8%E4%BA%BA', null, b.token));
  }
  const mixedResults = await Promise.all(mixedReqs);
  mixedOk = mixedResults.filter(r => r.status === 200).length;

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const total = results.profile + results.contacts + results.messages + results.groups + mixedOk + 5; // 5 group messages
  const success = results.profile + results.contacts + results.messages + mixedOk;

  // Report
  const now = new Date().toISOString();
  const ok = results.profile >= 1490 && results.contacts >= 1490 && results.messages >= 95 && results.groups >= 5 && mixedOk >= 195;
  
  console.log(`${now} | 资料:${results.profile}/1500 好友:${results.contacts}/1500 消息:${results.messages}/100 群:${results.groups}/5 混合:${mixedOk}/200 | ${elapsed}s | ${ok ? '✅' : '⚠️'}`);

  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
