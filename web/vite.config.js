import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.2.0'),
  },
  plugins: [
    react(),
    // Gzip 压缩（降至 8KB 阈值，更多文件受益）
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 8192,
      deleteOriginFile: false,
    }),
    // Brotli 压缩（更高压缩率，现代浏览器优先）
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 8192,
      deleteOriginFile: false,
    }),
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    // CSS 代码分割：懒加载 chunk 只加载自己的 CSS
    cssCodeSplit: true,
    // 跳过压缩大小统计，加快构建
    reportCompressedSize: false,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2,            // 双遍压缩，体积更小
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      mangle: { safari10: true },
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        // 精细化分包策略：提升缓存复用率
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;

          // ── 首屏必须（同步加载，最高优先级缓存）───────────────────
          // React 核心
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'vendor-react-core';
          }
          // React Router
          if (id.includes('react-router')) return 'vendor-router';
          // Socket.IO（实时通信）
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'vendor-socket';
          }
          // Axios
          if (id.includes('/axios/')) return 'vendor-axios';

          // ── 核心功能（聊天界面加载时）────────────────────────────
          // 虚拟列表（消息列表核心）
          if (id.includes('react-window') || id.includes('react-virtualized-auto-sizer')) {
            return 'vendor-virtuallist';
          }
          // DOMPurify（消息渲染安全，与聊天一起加载）
          if (id.includes('dompurify')) return 'vendor-dompurify';

          // ── 延迟加载（按需，不影响首屏）─────────────────────────
          // Sentry（错误监控，启动后异步初始化）
          if (id.includes('@sentry/')) return 'vendor-sentry';
          // 二维码生成（个人资料页使用）
          if (id.includes('qrcode')) return 'vendor-qrcode';
          // jsqr（扫码，ScanQR 组件动态 import，此处兜底）
          if (id.includes('jsqr')) return 'vendor-jsqr';
          // timeago（消息时间格式化，低频）
          if (id.includes('timeago')) return 'vendor-timeago';

          // ── 其余第三方统一归并 ───────────────────────────────────
          return 'vendor-misc';
        },
        // 文件名加内容 hash 指纹（长期缓存策略）
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  (assetInfo) => {
          // 字体单独目录，CDN 强缓存
          if (/\.(woff2?|ttf|eot)$/.test(assetInfo.name || '')) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    // 打包大小警告阈值
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
