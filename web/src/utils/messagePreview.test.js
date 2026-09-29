import { expect, it } from 'vitest';
import { messagePreview, typeLabel } from './messagePreview';

it.each([
  ['transfer', '{"amount":25,"note":"车费","refId":"x"}', '[转账]'],
  ['red_packet', '{"packetId":"p","greeting":"hi"}', '[红包]'],
  ['contact_card', '{"id":"u","username":"a"}', '[名片]'],
  ['sticker', '/uploads/s.png', '[表情]'],
  ['text', '你好', '你好'],
])('%s never leaks raw content', (type, content, expected) => {
  expect(messagePreview({ type, content })).toBe(expected);
});

it('nudge names the current user as 你', () => {
  expect(messagePreview({ type: 'nudge', content: JSON.stringify({ actor: 'a', target: 'me', actorName: '小林' }) }, { id: 'me' })).toBe('小林 拍了拍 你');
});

it('unknown media type falls back to content, text has no label', () => {
  expect(typeLabel('text')).toBeNull();
});
