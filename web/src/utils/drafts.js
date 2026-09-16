const PREFIX = 'draft_v2_';
const prefixFor = scope => `${PREFIX}${scope.key}_`;

export function readDraft(convId, scope) {
  if (!convId || !scope) return '';
  try { return localStorage.getItem(prefixFor(scope) + convId) || ''; }
  catch { return ''; }
}

export function readAllDrafts(scope) {
  if (!scope) return {};
  const drafts = {};
  try {
    const prefix = prefixFor(scope);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) drafts[key.slice(prefix.length)] = value;
      }
    }
  } catch { /* 存储不可用时仍可编辑输入框 */ }
  return drafts;
}

export function saveDraft(convId, text, scope) {
  if (!convId || !scope) return;
  try {
    const key = prefixFor(scope) + convId;
    if (text) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  } catch { /* 存储满时不阻断输入 */ }
  window.dispatchEvent(new CustomEvent('draft-changed', {
    detail: { convId, text, scopeKey: scope.key },
  }));
}

export function clearDrafts(scope) {
  if (!scope) return;
  try {
    const prefix = prefixFor(scope);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix) || (key.startsWith('draft_') && !key.startsWith(PREFIX))) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* 隐私模式 */ }
}
