import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// desktop 模式：vite build --mode desktop
// web 模式（默认）：vite build
const isDesktop = (mode) => mode === 'desktop';

export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile()],
  publicDir: 'public',

  // desktop 构建使用相对路径，保证 file:// 协议下 public/ 静态资源可寻址
  // viteSingleFile 将所有 JS/CSS 内联进 index.html，base 主要影响非内联资源
  base: isDesktop(mode) ? './' : '/',

  // ── esbuild：生产/desktop 环境剥离所有 console.* / debugger ──
  esbuild: {
    drop: (mode === 'production' || isDesktop(mode)) ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },

  build: {
    sourcemap:             false,
    cssCodeSplit:          false,
    chunkSizeWarningLimit: 1000,
    minify:                'esbuild',

    rollupOptions: {
      output: {
        // 不分包，单文件模式（viteSingleFile 内联一切）
        manualChunks:   undefined,
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },

  server: {
    proxy: {
      '/api':       'http://localhost:3002',
      '/uploads':   'http://localhost:3002',
      '/socket.io': { target: 'http://localhost:3002', ws: true },
    },
  },
}));
