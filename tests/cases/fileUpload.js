/**
 * 第六步：文件上传测试
 */
const api      = require('../utils/api');
const FormData = require('form-data');
const rep      = require('../utils/reporter');
const axios    = require('axios');
const cfg      = require('../config');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 生成最小有效 PNG（1×1 像素）
function minimalPng() {
  const zlib = require('zlib');
  const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  function chunk(type, data) {
    const crc = require('zlib').crc32Buffer
      ? 0 // fallback
      : (() => { const c = Buffer.concat([type, data]); let crc = 0xFFFFFFFF; for (const b of c) { crc ^= b; for (let i=0;i<8;i++) crc = (crc>>>1)^(crc&1?0xEDB88320:0); } return (crc^0xFFFFFFFF)>>>0; })();
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc);
    return Buffer.concat([len, type, data, crcBuf]);
  }
  const ihdr = chunk(Buffer.from('IHDR'), Buffer.from([0,0,0,1,0,0,0,1,8,2,0,0,0]));
  const idat = chunk(Buffer.from('IDAT'), zlib.deflateSync(Buffer.from([0,0xFF,0xFF,0xFF])));
  const iend = chunk(Buffer.from('IEND'), Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// 最小有效 JPEG
function minimalJpeg() {
  return Buffer.from([
    0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,
    0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xD9
  ]);
}

async function runFileTests(accounts, conversationId) {
  rep.log('\n══ 文件上传测试 ══');

  const a = accounts[0];
  const client = api.clientFromAccount(a);
  const cookie = client.getCookie();

  // 获取一个可用的会话
  let convId = conversationId;
  if (!convId) {
    const convs = await api.getConversations(client);
    convId = convs[0]?.id;
  }
  if (!convId) {
    rep.fail('fileUpload:noConversation', new Error('无可用会话'), 'high');
    return;
  }

  const cases = [
    // [文件名, 内容, Content-Type, 预期: pass=true/fail=false]
    ['test.png',  minimalPng(),  'image/png',  true,  'PNG 图片'],
    ['test.jpg',  minimalJpeg(), 'image/jpeg', true,  'JPEG 图片'],
    ['test.pdf',  Buffer.from('%PDF-1.4 test'), 'application/pdf', true, 'PDF 文档'],
    ['test.txt',  Buffer.from('hello world'),   'text/plain',       true,  '纯文本'],
    // 危险文件
    ['evil.exe',  Buffer.from('MZ\x90\x00'), 'application/octet-stream', false, 'EXE 文件'],
    ['hack.sh',   Buffer.from('#!/bin/bash'), 'application/x-sh',         false, 'Shell 脚本'],
    ['virus.bat', Buffer.from('@echo off'),   'application/x-msdos-program', false, 'BAT 批处理'],
    ['bad.ps1',   Buffer.from('Get-Process'), 'application/x-powershell',  false, 'PowerShell'],
    // MIME 伪造：exe 内容但声称是 jpeg
    ['fake.jpg',  Buffer.from('MZ\x90\x00'), 'image/jpeg', false, 'EXE 伪造为 JPEG'],
  ];

  for (const [filename, content, mime, shouldPass, label] of cases) {
    try {
      const fd = new FormData();
      fd.append('file', content, { filename, contentType: mime });

      const response = await axios.post(
        `${cfg.BASE_URL}/api/messages/${convId}/upload`,
        fd,
        {
          headers: { ...fd.getHeaders(), Cookie: cookie },
          validateStatus: () => true,
          timeout: 10000,
        }
      );

      const ok = response.status === 200 || response.status === 201;

      if (shouldPass && ok) {
        rep.pass(`fileUpload:${filename}`, `${label} 上传成功 (${response.status})`);
      } else if (!shouldPass && !ok) {
        rep.pass(`fileUpload:block:${filename}`, `${label} 被正确拦截 (${response.status}: ${response.data?.error?.slice(0,50)})`);
      } else if (shouldPass && !ok) {
        rep.fail(`fileUpload:${filename}`, new Error(`${label} 应通过但被拒绝: ${response.data?.error}`), 'high', [`上传 ${filename}`]);
      } else {
        rep.fail(`fileUpload:block:${filename}`, new Error(`${label} 应被拦截但上传成功 (${response.status})`), 'critical', [`上传 ${filename}`, '文件安全漏洞']);
      }
    } catch (e) {
      rep.fail(`fileUpload:${filename}`, e, 'medium');
    }
    await sleep(200);
  }
}

module.exports = { runFileTests };
