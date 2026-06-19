import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  publicDir: 'public',

  base: './',

  build: {
    sourcemap: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    outDir: '../mobile/web-dist',
    rollupOptions: {
      output: {
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
