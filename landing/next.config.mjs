/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：next build 产出纯静态 out/，可托管到任意静态主机（Cloudflare Pages / Nginx 等）
  output: 'export',
  // 落地页托管在 vxinchat.com/welcome 子路径（根路径 / 留给 Web 应用）。
  // basePath 让导出产物的资源路径(_next 等)与内部链接都带 /welcome 前缀，
  // 否则子路径下绝对资源路径 /_next/* 会被根应用接管而 404。
  basePath: '/welcome',

  // ── 图片优化：静态导出下用自定义 loader（Cloudflare Image Resizing / Nginx）
  // unoptimized:false 让 <Image> 组件生成 srcset + sizes，由 loader 决定 URL 格式。
  // 静态托管时 loader 直接返回原图 URL（CDN 侧转换 WebP/AVIF）。
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes:  [64, 128, 256, 384],
    loader: 'custom',
    loaderFile: './lib/imageLoader.js',
  },
  // 目录式路由，输出 about/index.html，静态主机更友好
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
