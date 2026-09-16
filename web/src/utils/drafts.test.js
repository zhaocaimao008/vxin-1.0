import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readDraft, readAllDrafts, saveDraft, clearDrafts } from './drafts';
import { createMessageScope } from './messageScope';

const a = createMessageScope('a', 'https://one.example');
const b = createMessageScope('b', 'https://one.example');
const other = createMessageScope('a', 'https://two.example');
beforeEach(() => {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: key => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = String(value); } },
    removeItem: { value: key => { delete storage[key]; } },
  });
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(type, { detail }) { this.type = type; this.detail = detail; } });
});
afterEach(() => vi.unstubAllGlobals());

it('restores Unicode drafts and advertises their account to the conversation list', () => {
  saveDraft('group', '你好 👋', a);
  expect(readDraft('group', a)).toBe('你好 👋');
  expect(readAllDrafts(a)).toEqual({ group: '你好 👋' });
  expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ detail: { convId: 'group', text: '你好 👋', scopeKey: a.key } }));
});
it('does not expose a draft to another account or server or use ambiguous old keys', () => {
  localStorage.setItem('draft_group', 'old private draft');
  saveDraft('group', 'private draft', a);
  expect(readDraft('group', b)).toBe('');
  expect(readAllDrafts(b)).toEqual({});
  expect(readDraft('group', other)).toBe('');
});
it('removes sent drafts and clears only the departing account plus legacy records', () => {
  saveDraft('group', 'a draft', a);
  saveDraft('group', 'b draft', b);
  saveDraft('other', 'sent', a);
  saveDraft('other', '', a);
  expect(readDraft('other', a)).toBe('');
  clearDrafts(a);
  expect(readAllDrafts(a)).toEqual({});
  expect(readDraft('group', b)).toBe('b draft');
});
it('storage failures never throw into the input handler', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('full'); } });
  expect(readDraft('group', a)).toBe('');
  expect(() => saveDraft('group', 'draft', a)).not.toThrow();
});
