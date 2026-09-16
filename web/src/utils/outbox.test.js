import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loadOutbox, upsertOutbox, removeFromOutbox, clearOutbox } from './outbox';
import { createMessageScope } from './messageScope';

const alice = createMessageScope('alice', 'https://one.example/');
const bob = createMessageScope('bob', 'https://one.example');
const otherServer = createMessageScope('alice', 'https://two.example');
const draft = { id: 'tmp1', conversation_id: 'group', sender_id: 'alice', type: 'text', content: 'private draft' };

beforeEach(() => {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: key => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = String(value); } },
    removeItem: { value: key => { delete storage[key]; } },
  });
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('failed message ownership', () => {
  it('persists and removes the current account draft', () => {
    upsertOutbox('group', draft, alice);
    expect(loadOutbox('group', alice)).toEqual([expect.objectContaining({ content: draft.content, _status: 'error' })]);
    removeFromOutbox('group', draft.id, alice);
    expect(loadOutbox('group', alice)).toEqual([]);
  });
  it('isolates both accounts and servers sharing conversation IDs', () => {
    upsertOutbox('group', draft, alice);
    expect(loadOutbox('group', bob)).toEqual([]);
    expect(loadOutbox('group', otherServer)).toEqual([]);
    expect(loadOutbox('group', alice)).toHaveLength(1);
  });
  it('rejects foreign senders, conversations and anonymous reads', () => {
    upsertOutbox('group', draft, bob);
    upsertOutbox('other-group', draft, alice);
    expect(loadOutbox('group', bob)).toEqual([]);
    expect(loadOutbox('other-group', alice)).toEqual([]);
    expect(loadOutbox('group')).toEqual([]);
    expect(createMessageScope(null, 'https://one.example')).toBeNull();
  });
  it('quarantines legacy records without losing their content or sending as a new account', () => {
    localStorage.setItem('outbox_group', JSON.stringify([draft]));
    expect(loadOutbox('group', bob)).toEqual([]);
    expect(localStorage.getItem('outbox_group')).toBeNull();
    const quarantined = Object.keys(localStorage).find(key => key.startsWith('outbox_legacy_group_'));
    expect(JSON.parse(localStorage.getItem(quarantined))).toEqual([draft]);
  });
  it('clears only the departing account plus ambiguous legacy records', () => {
    upsertOutbox('group', draft, alice);
    upsertOutbox('group', { ...draft, sender_id: 'bob' }, bob);
    localStorage.setItem('outbox_old', '[]');
    clearOutbox(alice);
    expect(loadOutbox('group', alice)).toEqual([]);
    expect(loadOutbox('group', bob)).toHaveLength(1);
    expect(localStorage.getItem('outbox_old')).toBeNull();
  });
  it('filters corrupted ownership even inside a scoped key', () => {
    localStorage.setItem(`outbox_v2_${bob.key}_group`, JSON.stringify([draft, null]));
    expect(loadOutbox('group', bob)).toEqual([]);
  });
});
