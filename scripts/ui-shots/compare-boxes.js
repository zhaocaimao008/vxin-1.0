#!/usr/bin/env node
'use strict';
/**
 * 比对 capture.js --boxes 产出的两份 boxes.json（before/after），
 * 输出逐元素 x/y/width/height 对比表（Markdown），并把超过 1px 的位移单独列出。
 *
 * 用法：node compare-boxes.js before-boxes.json after-boxes.json
 */
const fs = require('fs');

const [, , beforeFile, afterFile] = process.argv;
if (!beforeFile || !afterFile) {
  console.error('用法: node compare-boxes.js <before-boxes.json> <after-boxes.json>');
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));

const THRESHOLD = 1; // px

function fmtBox(b) {
  if (!b) return '(未找到)';
  return `x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} w=${b.width.toFixed(1)} h=${b.height.toFixed(1)}`;
}

function diffOf(b1, b2) {
  if (!b1 || !b2) return b1 === b2 ? 0 : Infinity;
  return Math.max(Math.abs(b1.x - b2.x), Math.abs(b1.y - b2.y), Math.abs(b1.width - b2.width), Math.abs(b1.height - b2.height));
}

function compareScreen(screenName, beforeScreen, afterScreen) {
  const rows = [];
  const shifted = [];
  const labels = new Set([...Object.keys(beforeScreen || {}), ...Object.keys(afterScreen || {})]);
  for (const label of labels) {
    const b = beforeScreen?.[label];
    const a = afterScreen?.[label];
    if (Array.isArray(b) || Array.isArray(a)) {
      const arrB = Array.isArray(b) ? b : [];
      const arrA = Array.isArray(a) ? a : [];
      const len = Math.max(arrB.length, arrA.length);
      for (let i = 0; i < len; i++) {
        const bi = arrB[i], ai = arrA[i];
        const d = diffOf(bi, ai);
        const name = `${label}[${i}]`;
        rows.push([name, fmtBox(bi), fmtBox(ai), d > THRESHOLD ? `是 (${d.toFixed(1)}px)` : '否']);
        if (d > THRESHOLD) shifted.push({ screen: screenName, name, before: bi, after: ai, delta: d });
      }
    } else {
      const d = diffOf(b, a);
      rows.push([label, fmtBox(b), fmtBox(a), d > THRESHOLD ? `是 (${d.toFixed(1)}px)` : '否']);
      if (d > THRESHOLD) shifted.push({ screen: screenName, name: label, before: b, after: a, delta: d });
    }
  }
  return { rows, shifted };
}

const SCREEN_LABELS = {
  double: '我的（WebSettingsShell 双栏）',
  single: '我的（单栏卡片列表）',
  contacts: '通讯录',
  chatWindow: '聊天详情页',
  profileDetail: '个人资料详情页（桌面）',
};
const screens = Object.keys(SCREEN_LABELS).filter(s => before[s] || after[s]);
let md = '';
let allShifted = [];
for (const s of screens) {
  const { rows, shifted } = compareScreen(s, before[s], after[s]);
  md += `\n## ${SCREEN_LABELS[s]}\n\n`;
  md += '| 元素 | before | after | 是否位移(>1px) |\n|---|---|---|---|\n';
  for (const r of rows) md += `| ${r.join(' | ')} |\n`;
  allShifted = allShifted.concat(shifted);
}

console.log(md);

if (allShifted.length) {
  console.log('\n=== 超过 1px 的位移，逐条列出 ===\n');
  allShifted.forEach(s => {
    console.log(`[${s.screen}] ${s.name}: delta=${s.delta.toFixed(1)}px`);
    console.log('  before:', fmtBox(s.before));
    console.log('  after :', fmtBox(s.after));
  });
} else {
  console.log('\n=== 没有任何元素位移超过 1px ===');
}
