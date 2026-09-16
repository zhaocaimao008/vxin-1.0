'use strict';
const { test, expect } = require('../fixtures');

test('AUTH-LINKS current manifests select immutable Windows and Android packages', async ({ webPage, baseURL }) => {
  await webPage.route('**/downloads/updates/latest.yml', route => route.fulfill({ body: 'version: 8.0.99\npath: vxin-8.0.99-setup.exe\n' }));
  await webPage.route('**/downloads/vxin-android-version.json', route => route.fulfill({ json: { versionName: '8.0.99', url: '/downloads/vxin-android-8.0.99.apk' } }));
  await webPage.goto(baseURL + '/login');
  await expect(webPage.getByRole('link', { name: 'Windows 版' })).toHaveAttribute('href', /\/downloads\/vxin-8\.0\.99-setup\.exe$/);
  await expect(webPage.getByRole('link', { name: 'Android 版' })).toHaveAttribute('href', /\/downloads\/vxin-android-8\.0\.99\.apk$/);
});

test('AUTH-DOCS privacy is readable on narrow screens without losing form input', async ({ webPage, baseURL }) => {
  await webPage.setViewportSize({ width: 320, height: 568 });
  await webPage.addInitScript(() => localStorage.setItem('wc_theme', 'dark'));
  await webPage.goto(baseURL + '/login');
  await webPage.getByTestId('login-phone-input').fill('13912345678');
  await webPage.getByRole('link', { name: '《隐私政策》', exact: true }).click();
  const dialog = webPage.getByRole('dialog', { name: '隐私政策', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.auth-privacy-content').getByRole('heading', { name: '隐私政策', exact: true })).toBeVisible();
  await expect(dialog.locator('.auth-privacy-content a').first()).toHaveCSS('color', 'rgb(7, 93, 68)');
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(568);
  await dialog.getByRole('button', { name: '关闭文档' }).click();
  await expect(webPage.getByTestId('login-phone-input')).toHaveValue('13912345678');
  await webPage.getByRole('link', { name: '帮助中心', exact: true }).click();
  await webPage.getByRole('dialog', { name: '帮助中心', exact: true }).getByRole('link', { name: '找回密码', exact: true }).click();
  await expect(webPage).toHaveURL(/forgot-password/);
});

test('AUTH-REGISTER documents can be opened and dismissed while retaining the account', async ({ webPage, baseURL }) => {
  await webPage.goto(baseURL + '/register');
  await webPage.getByTestId('register-phone-input').fill('13912345679');
  await webPage.getByRole('link', { name: '《用户协议》', exact: true }).click();
  const dialog = webPage.getByRole('dialog', { name: '用户协议', exact: true });
  await expect(dialog).toContainText('当前未提供用户协议正文');
  await webPage.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(webPage.getByTestId('register-phone-input')).toHaveValue('13912345679');
});
