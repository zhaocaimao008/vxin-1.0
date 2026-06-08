const fs   = require('fs');
const path = require('path');
const cfg  = require('../config');

const REPORT_FILE = path.join(cfg.REPORTS_DIR, 'bug-report.json');
const LOG_FILE    = path.join(cfg.REPORTS_DIR, 'test.log');

// 确保目录存在
fs.mkdirSync(cfg.REPORTS_DIR, { recursive: true });
fs.mkdirSync(cfg.SCREENSHOTS_DIR, { recursive: true });

const bugs   = [];
const passed = [];
const logs   = [];

function ts() { return new Date().toISOString(); }

function log(msg) {
  const line = `[${ts()}] ${msg}`;
  logs.push(line);
  console.log(line);
}

function pass(testName, detail = '') {
  passed.push({ time: ts(), test: testName, detail });
  log(`✅ PASS  ${testName}${detail ? ' — ' + detail : ''}`);
}

function fail(testName, error, severity = 'medium', steps = []) {
  const bug = {
    time: ts(),
    test: testName,
    error: String(error),
    stack: error?.stack || '',
    severity,   // critical | high | medium | low
    steps,
    reproduced: false,
  };
  bugs.push(bug);
  log(`❌ FAIL  [${severity.toUpperCase()}] ${testName} — ${error}`);
  save();
}

function save() {
  fs.writeFileSync(REPORT_FILE, JSON.stringify({ bugs, passed, logs }, null, 2));
  fs.appendFileSync(LOG_FILE, logs.slice(-1)[0] + '\n');
}

function summary() {
  return { total: passed.length + bugs.length, passed: passed.length, failed: bugs.length, bugs };
}

module.exports = { log, pass, fail, save, summary, bugs, passed };
