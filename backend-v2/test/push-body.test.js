'use strict';
/** 回归：锁屏推送正文不能把 JSON content(转账/红包/拍一拍)或文件地址原样显示给用户。 */
require('./testEnv');
const { buildBody } = require('../src/utils/push');

test.each([
  ['transfer', '{"amount":25,"note":"车费","refId":"r"}', '[转账]'],
  ['nudge', '{"actor":"a","target":"b"}', '[拍一拍]'],
  ['sticker', '/uploads/stickers/x.png', '[表情]'],
  ['video', 'clip.mp4', '[视频]'],
  ['some_future_type', '{"x":1}', '[消息]'],
])('%s → %s', (type, content, expected) => {
  expect(buildBody(type, content)).toBe(expected);
});

test('text keeps its content', () => {
  expect(buildBody('text', '在吗')).toBe('在吗');
  expect(buildBody(undefined, '在吗')).toBe('在吗');
});
