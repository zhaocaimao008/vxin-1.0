'use strict';
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }               = require('@aws-sdk/s3-request-presigner');

// ── 支持 Cloudflare R2 / 阿里云 OSS / 腾讯云 COS ─────────────────
// 通过 CLOUD_PROVIDER 环境变量选择：'r2' | 'aliyun' | 'tencent'
//
// 使用前须在对应控制台为 Bucket 配置 CORS：
//   允许来源: https://chat.91aigu.com  http://localhost:3000
//   允许方法: PUT
//   允许 Header: Content-Type
//   暴露 Header: ETag

const PROVIDER = (process.env.CLOUD_PROVIDER || '').toLowerCase();

function isConfigured() {
  if (PROVIDER === 'r2') {
    return !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET &&
              process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  }
  if (PROVIDER === 'aliyun') {
    return !!(process.env.OSS_REGION && process.env.OSS_BUCKET &&
              process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET);
  }
  if (PROVIDER === 'tencent') {
    return !!(process.env.COS_REGION && process.env.COS_BUCKET &&
              process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY);
  }
  return false;
}

function buildConfig() {
  // ── Cloudflare R2 ──────────────────────────────────────────────
  if (PROVIDER === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket    = process.env.R2_BUCKET;
    return {
      client: new S3Client({
        region:   'auto',
        // R2 的 S3 兼容端点
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId:     process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        // R2 必须使用 path-style
        forcePathStyle: true,
      }),
      bucket,
      // 优先用自定义公开域名（需在 R2 → Settings → Custom Domains 绑定）
      // 否则用 r2.dev 公开子域名（需在 Bucket → Settings 开启 Public Access）
      publicBase: process.env.R2_PUBLIC_DOMAIN
        ? `https://${process.env.R2_PUBLIC_DOMAIN}`
        : `https://pub-${accountId}.r2.dev`,
    };
  }

  // ── 腾讯云 COS ────────────────────────────────────────────────
  if (PROVIDER === 'tencent') {
    const bucket = process.env.COS_BUCKET;
    const region = process.env.COS_REGION;
    return {
      client: new S3Client({
        region,
        endpoint:    `https://cos.${region}.myqcloud.com`,
        credentials: { accessKeyId: process.env.COS_SECRET_ID, secretAccessKey: process.env.COS_SECRET_KEY },
        forcePathStyle: false,
      }),
      bucket,
      publicBase: process.env.COS_CDN_DOMAIN
        ? `https://${process.env.COS_CDN_DOMAIN}`
        : `https://${bucket}.cos.${region}.myqcloud.com`,
    };
  }

  // ── 阿里云 OSS（默认）────────────────────────────────────────
  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION;
  return {
    client: new S3Client({
      region,
      endpoint:    `https://oss-${region}.aliyuncs.com`,
      credentials: { accessKeyId: process.env.OSS_ACCESS_KEY_ID, secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET },
      forcePathStyle: false,
    }),
    bucket,
    publicBase: process.env.OSS_CDN_DOMAIN
      ? `https://${process.env.OSS_CDN_DOMAIN}`
      : `https://${bucket}.oss-${region}.aliyuncs.com`,
  };
}

/**
 * 生成预签名 PUT URL（10 分钟有效）
 * @param {string} key         - 对象路径，如 chat/convId/uuid.jpg
 * @param {string} contentType - 文件 MIME，如 image/jpeg
 * @returns {{ uploadUrl: string, publicUrl: string }}
 */
async function getPresignedPutUrl(key, contentType) {
  const { client, bucket, publicBase } = buildConfig();
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 600 });
  return { uploadUrl, publicUrl: `${publicBase}/${key}` };
}

/**
 * 返回已配置的云存储公共访问 base URL（用于 socket 侧校验上传 URL 合法性）
 */
function getPublicBase() {
  if (!isConfigured()) return null;
  return buildConfig().publicBase;
}

module.exports = { isConfigured, getPresignedPutUrl, getPublicBase };
