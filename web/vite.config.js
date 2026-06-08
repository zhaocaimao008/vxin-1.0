import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile()],
  publicDir: 'public',

  // ── esbuild：生产环境剥离所有 console.* / debugger ──────────
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },

  build: {
    sourcemap:             false,
    cssCodeSplit:          false,
    chunkSizeWarningLimit: 1000,
    minify:                'esbuild',

    rollupOptions: {
      output: {
        // 不分包，单文件模式
        manualChunks: undefined,
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
