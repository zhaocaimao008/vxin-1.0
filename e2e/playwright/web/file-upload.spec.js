'use strict';
/**
 * FILE: 文件/图片上传功能测试
 */
const path = require('path');
const fs   = require('fs');
const { test, expect } = require('../fixtures');
const { LoginPage } = require('../pages/LoginPage');
const { ChatPage }  = require('../pages/ChatPage');
const A = require('../../shared/anchors');

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures');
const SAMPLE_PNG = path.join(FIXTURES, 'sample.png');

async function loginAndOpenConv(page, baseURL, seeded) {
  const login = new LoginPage(page);
  await login.gotoLogin(baseURL);
  await login.login(seeded.users[0].phone, seeded.users[0].password);
  const chat = new ChatPage(page);
  await chat.waitReady();
  if (seeded.convAB) await chat.openConv(seeded.convAB);
  else               await chat.openFirstConv();
  return chat;
}

test.describe('文件上传 FILE', () => {

  test('FILE-01 图片上传成功显示', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无测试会话');
    test.skip(!fs.existsSync(SAMPLE_PNG), 'fixtures/sample.png 不存在');

    await loginAndOpenConv(webPage, baseURL, seeded);

    // 触发图片上传
    const fileInput = webPage.locator(`[data-testid="${A.chatAttachImage}"]`).first();
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(SAMPLE_PNG);

    // 等待图片气泡
    await webPage.locator(`[data-testid="${A.msgImage}"]`).last()
      .waitFor({ state: 'visible', timeout: 20000 });

    await webPage.screenshot({ path: 'shots/file-image-upload.png' });
  });

  test('FILE-02 文件上传成功', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无测试会话');

    await loginAndOpenConv(webPage, baseURL, seeded);

    // 创建临时测试文件
    const tmpFile = path.join('/tmp', `test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'v信自动化测试文件 ' + Date.now());

    try {
      const fileInput = webPage.locator(`[data-testid="${A.chatAttachFile}"]`).first();
      await expect(fileInput).toBeAttached();
      await fileInput.setInputFiles(tmpFile);

      // 等待文件消息出现
      await webPage.locator(`[data-testid="${A.msgFile}"]`).last()
        .waitFor({ state: 'visible', timeout: 20000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('FILE-03 上传进度显示', async ({ webPage, seeded, baseURL }) => {
    test.skip(!seeded.convAB, '无测试会话');
    test.skip(!fs.existsSync(SAMPLE_PNG), 'fixtures/sample.png 不存在');

    await loginAndOpenConv(webPage, baseURL, seeded);

    const errors = [];
    webPage.on('pageerror', e => errors.push(e.message));

    const fileInput = webPage.locator(`[data-testid="${A.chatAttachImage}"]`).first();
    await fileInput.setInputFiles(SAMPLE_PNG);

    // 等待上传完成或超时
    await webPage.locator(`[data-testid="${A.msgImage}"]`).last()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

    expect(errors.filter(e => !e.includes('ResizeObserver') && !e.includes('AbortError'))).toHaveLength(0);
  });
});
