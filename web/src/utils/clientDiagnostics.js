// Diagnostics contain fixed event codes and source positions, never chat content or credentials.
let activeReporter = null;
export function createDiagnosticsReporter({ apiBase = '', platform = 'web', fetcher = globalThis.fetch, storage, clock = Date.now }) {
  let windowStart = 0, sent = 0;
  const recent = new Map();
  const kinds = new Set(['render_error', 'runtime_error', 'unhandled_rejection', 'connection_failed', 'message_send_failed']);
  return (kind, error) => {
    if (!kinds.has(kind)) return;
    const time = clock();
    if (time - windowStart >= 60000) { windowStart = time; sent = 0; recent.clear(); }
    const name = /^(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError)$/.test(error?.name) ? error.name : 'Error';
    const key = kind + ':' + name;
    if (recent.has(key) || sent >= 10) return;
    recent.set(key, time); sent++;
    const positions = String(error?.stack || '').split('\n').slice(1).map(line => {
      const match = line.match(/\/([a-zA-Z0-9_.-]+\.m?js):([0-9]+):([0-9]+)/);
      return match ? match[1] + ':' + match[2] + ':' + match[3] : null;
    }).filter(Boolean).slice(0, 8);
    const event = { time: new Date(time).toISOString(), message: key, stack: positions.join('\n'), url: platform + '://app', ua: platform };
    try {
      const old = JSON.parse(storage?.getItem('vxin_error_log') || '[]');
      storage?.setItem('vxin_error_log', JSON.stringify([event, ...(Array.isArray(old) ? old : [])].slice(0, 20)));
    } catch { /* Storage failure must not break the app. */ }
    try {
      const endpoint = apiBase ? new URL('/api/client-errors', apiBase).href : '/api/client-errors';
      Promise.resolve(fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), credentials: 'omit', keepalive: true })).catch(() => {});
    } catch { /* Network/URL failure must not recurse through global error handling. */ }
  };
}
export function reportClientDiagnostic(kind, error) { activeReporter?.(kind, error); }
export function initializeClientDiagnostics({ apiBase, platform }) {
  let storage;
  try { storage = window.sessionStorage; } catch { /* Private mode may disable storage. */ }
  activeReporter = createDiagnosticsReporter({ apiBase, platform, storage });
  window.addEventListener('error', event => reportClientDiagnostic('runtime_error', event.error));
  window.addEventListener('unhandledrejection', event => reportClientDiagnostic('unhandled_rejection', event.reason));
}
