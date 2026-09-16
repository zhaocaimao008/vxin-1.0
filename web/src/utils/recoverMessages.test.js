import { expect, it, vi } from 'vitest';
import { recoverMessages } from './recoverMessages';

it('recovers more than two pages with identical timestamps without skipping messages', async () => {
  const rows = Array.from({ length: 205 }, (_, i) => ({ id: `m${i}`, created_at: 1700000000 }));
  const fetchPage = vi.fn(async ({ afterId, limit }) => {
    const start = afterId ? rows.findIndex(m => m.id === afterId) + 1 : 0;
    return rows.slice(start, start + limit);
  });
  const recovered = [];
  await recoverMessages(fetchPage, 1699999999, page => recovered.push(...page));
  expect(recovered).toEqual(rows);
  expect(fetchPage).toHaveBeenCalledTimes(3);
  expect(fetchPage.mock.calls[1][0]).toEqual({ after: 1700000000, afterId: 'm99', limit: 100 });
});

it('checks for the empty final page when the total is an exact multiple', async () => {
  const fetchPage = vi.fn().mockResolvedValueOnce(Array.from({ length: 100 }, (_, id) => ({ id: String(id), created_at: 3 }))).mockResolvedValueOnce([]);
  await recoverMessages(fetchPage, 2, () => {});
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

it('does not render a response arriving after switching conversations', async () => {
  const controller = new AbortController();
  const onPage = vi.fn();
  await recoverMessages(async () => { controller.abort(); return [{ id: 'late' }]; }, 1, onPage, controller.signal);
  expect(onPage).not.toHaveBeenCalled();
});

it('rejects a stalled cursor instead of requesting the same page forever', async () => {
  const page = Array.from({ length: 100 }, (_, id) => ({ id: String(id), created_at: 3 }));
  const fetchPage = vi.fn().mockResolvedValue(page);
  await expect(recoverMessages(fetchPage, 2, () => {})).rejects.toThrow('消息游标未推进');
  expect(fetchPage).toHaveBeenCalledTimes(2);
});

it('propagates network errors to the caller for user feedback', async () => {
  await expect(recoverMessages(async () => { throw new Error('offline'); }, 1, () => {})).rejects.toThrow('offline');
});
