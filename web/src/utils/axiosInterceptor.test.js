import { afterEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { setupAxiosInterceptors } from './axiosInterceptor';

afterEach(() => vi.useRealTimers());

function client(status) {
  const calls = [];
  const inst = axios.create({
    adapter: async config => {
      calls.push(config.method);
      const err = new Error('fail'); err.config = config;
      err.response = { status, data: {}, headers: {}, config };
      throw err;
    },
  });
  setupAxiosInterceptors(inst);
  return { inst, calls };
}

it.each([502, 503, 504])('never auto-retries a POST after HTTP %i (it may already have been applied)', async status => {
  const { inst, calls } = client(status);
  await expect(inst.post('/api/wallet/transfer', { amount: 1 })).rejects.toBeTruthy();
  expect(calls).toEqual(['post']);
});

it('still retries idempotent GET requests on 5xx', async () => {
  vi.useFakeTimers();
  const { inst, calls } = client(502);
  const p = inst.get('/api/messages/conversations').catch(e => e);
  await vi.runAllTimersAsync();
  await p;
  expect(calls).toEqual(['get', 'get', 'get', 'get']);
});

it('retries a write only when explicitly marked retryable', async () => {
  vi.useFakeTimers();
  const { inst, calls } = client(503);
  const p = inst.post('/api/safe', {}, { retryable: true }).catch(e => e);
  await vi.runAllTimersAsync();
  await p;
  expect(calls.length).toBe(4);
});
