import { describe, it, expect, vi } from 'vitest';
import { createDiagnosticsReporter } from './clientDiagnostics';
describe('cross-platform diagnostics', () => {
  it('uses the configured remote endpoint on a packaged client without sending credentials or message text', () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const report = createDiagnosticsReporter({ apiBase: 'https://liaotian99.com', platform: 'electron', fetcher });
    const error = new TypeError('private text password=secret 13800138000');
    error.stack = 'TypeError: secret\n at https://example.com/assets/chat.js:42:9?token=secret';
    report('render_error', error);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://liaotian99.com/api/client-errors');
    expect(options.credentials).toBe('omit');
    expect(options.body).not.toMatch(/secret|private text|13800138000|example.com/);
    expect(JSON.parse(options.body).stack).toBe('chat.js:42:9');
  });
  it('deduplicates reconnect storms and starts a new reporting window after one minute', () => {
    const fetcher = vi.fn().mockResolvedValue({}); let time = 100000;
    const report = createDiagnosticsReporter({ fetcher, clock: () => time });
    for (let i = 0; i < 100; i++) report('connection_failed', new Error('offline'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += 60000; report('connection_failed'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not throw or recursively retry when reporting and storage fail', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('unavailable'));
    const report = createDiagnosticsReporter({ fetcher, storage: { getItem() { throw Error('blocked'); } } });
    expect(() => report('runtime_error')).not.toThrow();
    await Promise.resolve(); expect(fetcher).toHaveBeenCalledTimes(1);
    report('unknown'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
