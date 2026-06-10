import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import singleFile from 'vite-plugin-singlefile';
import path from 'path';

/**
 * 🚀 Vite 多平台配置
 *
 * 支持:
 * - Web (浏览器)
 * - Electron (桌面端)
 * - Capacitor (移动端)
 */

export default ({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = command === 'serve';
  const isProd = command === 'build' && !env.ELECTRON_DEV;
  const isElectron = mode === 'desktop';

  return defineConfig({
    plugins: [
      react(),
      // ✅ Web 和 Electron 都使用单文件输出
      singleFile(),
    ],

    define: {
      // 全局变量
      __DEV__: JSON.stringify(isDev),
      __PROD__: JSON.stringify(isProd),
      __ELECTRON__: JSON.stringify(isElectron),
    },

    resolve: {
      alias: {
        // 路径别名
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@contexts': path.resolve(__dirname, './src/contexts'),
        '@config': path.resolve(__dirname, './src/config'),
      },
    },

    server: {
      // 开发服务器配置
      port: 3000,
      host: 'localhost',
      strictPort: false,
      open: false,

      // 代理 API 请求到后端
      proxy: isDev && !isElectron ? {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: env.VITE_WS_URL || 'ws://localhost:3002',
          ws: true,
          changeOrigin: true,
        },
        '/uploads': {
          target: env.VITE_API_URL || 'http://localhost:3002',
          changeOrigin: true,
        },
      } : undefined,
    },

    build: {
      // 构建输出配置
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false, // 生产环境不生成 sourcemap（防泄露源码）

      // 📦 代码压缩优化
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,      // ✅ 移除所有 console.log
          drop_debugger: true,     // ✅ 移除 debugger
          pure_funcs: [
            'console.log',
            'console.warn',
            'console.debug',
            'console.info',
          ],
        },
        mangle: true,
        output: {
          comments: false,         // 移除注释
        },
      },

      // 模块预加载优化
      rollupOptions: {
        output: {
          // Web：代码分割
          ...(isElectron ? {
            manualChunks: undefined, // Electron：单文件
          } : {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                if (id.includes('react')) return 'react-vendor';
                if (id.includes('socket.io')) return 'socket-io-vendor';
                return 'vendor';
              }
            },
          }),
        },
      },

      // 大文件警告
      chunkSizeWarningLimit: 500,
    },

    // 优化部分
    optimizeDeps: {
      // 预构建依赖
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'socket.io-client',
      ],
    },

    // CSS 处理
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      postcss: {
        plugins: [
          // 自动添加浏览器前缀
          require('autoprefixer'),
        ],
      },
    },
  });
};
