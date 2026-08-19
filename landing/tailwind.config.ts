import type { Config } from 'tailwindcss';

/**
 * 设计 token —— 落地页的视觉契约都集中在这里，改一处全站生效。
 * 风格：简洁亮色·信任风。品牌主色 AURORA 极光靛，对齐产品端 web/android/ios。
 * 深色安全区用 ink 系。
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 品牌主色（蓝绿 TEAL，科技感深色主题，对齐产品端绿色基调）
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        // 深色系（安全区背景 / 文字）
        ink: {
          50: '#f4f6f8',
          100: '#e7ebef',
          400: '#7c8aa0',
          600: '#3c4658',
          800: '#161d2b',
          900: '#0b1220',
          950: '#070b14',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      maxWidth: {
        content: '1120px',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,18,32,0.04), 0 8px 30px rgba(11,18,32,0.06)',
        lift: '0 10px 40px rgba(13,148,136,0.16)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
