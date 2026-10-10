'use strict';
const { authCookieOptions, walletCookieOptions, csrfCookieOptions } = require('../src/utils/cookies');
const req = (origin, https = true) => ({ headers: { ...(origin ? { origin } : {}), ...(https ? { 'x-forwarded-proto': 'https' } : {}) }, secure: false, get: () => 'liaotian99.com' });
describe('cookie policy matches browser and packaged-client origins', () => {
  test.each([authCookieOptions, walletCookieOptions, csrfCookieOptions])('opaque desktop origins retain secure cross-site cookies', options => {
    expect(options({ ...req(undefined), headers: { 'sec-fetch-site': 'cross-site', 'x-forwarded-proto': 'https' } })).toMatchObject({ secure: true, sameSite: 'none' });
    expect(options(req('null'))).toMatchObject({ secure: true, sameSite: 'none', path: '/' });
    expect(options(req('https://liaotian99.com'))).toMatchObject({ secure: true, sameSite: 'strict' });
    expect(options(req(undefined))).toMatchObject({ secure: true, sameSite: 'strict' });
    expect(options(req('http://liaotian99.com', false))).toMatchObject({ secure: false, sameSite: 'lax' });
  });
  test('account token and device wallet remain httpOnly', () => {
    expect(authCookieOptions(req('null')).httpOnly).toBe(true);
    expect(walletCookieOptions(req('null')).httpOnly).toBe(true);
    expect(csrfCookieOptions(req('null')).httpOnly).toBe(false);
  });
});
