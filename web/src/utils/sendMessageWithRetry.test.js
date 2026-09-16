import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sendMessageWithRetry } from './sendMessageWithRetry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const limited = { success: false, code: 'RATE_LIMITED', retryAfterMs: 1000 };

it('waits for the limit window and retries with exactly the same message identity', async () => {
  const payload = { clientMsgId: 'stable-id', content: 'hello' };
  const ack = vi.fn();
  const socket = { connected: true, emit: vi.fn().mockImplementationOnce((event, data, cb) => cb(limited))
    .mockImplementationOnce((event, data, cb) => cb({ success: true, message: { id: 'stored' } })) };
  sendMessageWithRetry(socket, payload, ack, () => true);
  await vi.advanceTimersByTimeAsync(999);
  expect(socket.emit).toHaveBeenCalledTimes(1);
  expect(ack).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(socket.emit).toHaveBeenCalledTimes(2);
  expect(socket.emit.mock.calls[1][1]).toBe(payload);
  expect(ack).toHaveBeenCalledWith({ success: true, message: { id: 'stored' } });
});
it('does not retry permanent errors such as permissions or deleted conversations', async () => {
  const ack = vi.fn(), denied = { success: false, error: '非群成员' };
  const socket = { connected: true, emit: vi.fn((event, data, cb) => cb(denied)) };
  sendMessageWithRetry(socket, {}, ack, () => true);
  await vi.runAllTimersAsync();
  expect(socket.emit).toHaveBeenCalledTimes(1);
  expect(ack).toHaveBeenCalledWith(denied);
});
it('stops pending retries after timeout, switching account or leaving the conversation', async () => {
  let pending = true;
  const ack = vi.fn(), socket = { connected: true, emit: vi.fn((event, data, cb) => cb(limited)) };
  sendMessageWithRetry(socket, {}, ack, () => pending);
  pending = false;
  await vi.runAllTimersAsync();
  expect(socket.emit).toHaveBeenCalledTimes(1);
  expect(ack).not.toHaveBeenCalled();
});
it('does not queue a retry on a disconnected socket', async () => {
  const ack = vi.fn(), socket = { connected: true, emit: vi.fn((event, data, cb) => cb(limited)) };
  sendMessageWithRetry(socket, {}, ack, () => true);
  socket.connected = false;
  await vi.runAllTimersAsync();
  expect(socket.emit).toHaveBeenCalledTimes(1);
  expect(ack).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
});
it('bounds repeated rate limits and returns a failure to the existing outbox flow', async () => {
  const ack = vi.fn(), socket = { connected: true, emit: vi.fn((event, data, cb) => cb(limited)) };
  sendMessageWithRetry(socket, {}, ack, () => true);
  await vi.runAllTimersAsync();
  expect(socket.emit).toHaveBeenCalledTimes(4);
  expect(ack).toHaveBeenCalledExactlyOnceWith(limited);
});
