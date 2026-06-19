/**
 * Electron 桌面端增强模块
 * 注入到渲染进程，提供：
 * - 文件拖拽发送 (ondrop → read file → upload)
 * - 图片粘贴发送
 * - 截图发送
 * - 原生通知桥接
 * - 点击系统托盘通知跳转
 */

// ── 初始化（仅 Electron 环境） ──────────────────────────────
export function initElectronFeatures() {
  if (!window.__ELECTRON_CONFIG__) return;

  // 截图触发函数（挂到 window 供主进程快捷键调用）
  window.__vxinScreenshot = triggerScreenshot;

  // 监听更新事件
  window.addEventListener('electron:update-available', (e) => {
    const { version } = e.detail;
    console.log(`[electron] 新版本 ${version} 可用，下载中...`);
  });
  window.addEventListener('electron:update-progress', (e) => {
    console.log(`[electron] 下载进度 ${e.detail}%`);
  });
  window.addEventListener('electron:update-downloaded', (e) => {
    console.log(`[electron] 更新已下载，即将重启安装`);
  });
}

// ── 截图 ──────────────────────────────────────────────────
export async function triggerScreenshot() {
  if (!window.electron?.screenshot) return null;
  try {
    // 触发主进程截图
    const filePath = await window.electron.screenshot();
    if (!filePath) return null;

    // 读取为 base64
    const base64 = await window.electron.readFileAsBase64(filePath);
    return base64;
  } catch (e) {
    console.error('[electron] 截图失败:', e);
    return null;
  }
}

// ── 选择文件 ──────────────────────────────────────────────
export async function selectFiles(options) {
  if (!window.electron?.selectFile) return [];
  try {
    const paths = await window.electron.selectFile(options);
    if (!paths || paths.length === 0) return [];

    // 读取所有文件为 base64
    const files = await Promise.all(
      paths.map(async (fp) => {
        const base64 = await window.electron.readFileAsBase64(fp);
        const name = fp.split(/[/\\]/).pop();
        return { name, path: fp, base64 };
      })
    );
    return files;
  } catch (e) {
    console.error('[electron] 选择文件失败:', e);
    return [];
  }
}

// ── 拖拽处理 ──────────────────────────────────────────────
export function handleFileDrop(e, onFiles) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;
  onFiles(files);
}

// ── 粘贴处理（从剪贴板读取图片） ──────────────────────────
export function handlePaste(e, onImagePaste) {
  if (!window.__ELECTRON_CONFIG__) return;
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        onImagePaste(file);
        e.preventDefault();
        return;
      }
    }
  }
}

// ── 原生通知 ──────────────────────────────────────────────
export function showNativeNotification({ title, body, tag }) {
  if (!window.electron?.showNotification) return;
  // 窗口聚焦时不弹通知
  if (document.hasFocus()) return;
  window.electron.showNotification({ title, body, tag });
}
