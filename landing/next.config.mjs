/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：next build 产出纯静态 out/，可托管到任意静态主机（Cloudflare Pages / Nginx 等）
  output: 'export',
  // 落地页为官网首页，托管在根路径 /；Web 客户端挪到 /app/ 子路径。
  // 根路径下无需 basePath，资源路径(_next)用默认 / 前缀。

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
