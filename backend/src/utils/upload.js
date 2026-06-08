const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const fileType = require('file-type');
const { v4: uuidv4 } = require('uuid');

// ── MIME 白名单（允许上传的真实 MIME）────────────────────────────

const ALLOWED_CHAT_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'text/plain',
]);

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);

// ── 危险扩展名黑名单（无论文件内容为何，扩展名含此后缀直接拒绝）──

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.scr',
  '.ps1', '.ps2', '.vbs', '.vbe', '.js', '.jse',
  '.sh',  '.bash', '.zsh', '.fish',
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.jsp', '.jspx', '.asp', '.aspx', '.cer', '.asa',
  '.htaccess', '.htpasswd', '.jar', '.war', '.ear',
  '.msi', '.apk', '.ipa', '.deb', '.rpm',
  '.py',  '.rb',  '.pl',  '.lua', '.cgi',
]);

// ── MIME → 安全扩展名（从真实 MIME 派生，不信任 originalname）──

const MIME_TO_EXT = {
  'image/jpeg'  : '.jpg',
  'image/png'   : '.png',
  'image/gif'   : '.gif',
  'image/webp'  : '.webp',
  'audio/webm'  : '.webm',
  'audio/ogg'   : '.ogg',
  'audio/mp4'   : '.m4a',
  'audio/mpeg'  : '.mp3',
  'audio/wav'   : '.wav',
  'video/mp4'   : '.mp4',
  'video/quicktime'  : '.mov',
  'video/webm'  : '.webm',
  'application/pdf'  : '.pdf',
  'application/msword' : '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : '.docx',
  'application/vnd.ms-excel' : '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.xlsx',
  'application/vnd.ms-powerpoint' : '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation' : '.pptx',
  'application/zip'              : '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed' : '.7z',
  'text/plain'  : '.txt',
};

// ── 文件名消毒 ────────────────────────────────────────────────────

function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'file';
  return name
    .replace(/[/\\]/g, '')
    .replace(/\0/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[^\w.\-一-龥\s]/g, '_')
    .trim()
    .slice(0, 200) || 'file';
}

// ── 魔数校验：读取磁盘上已写入的文件，验证真实 MIME ─────────────
// 返回 { ok: true } 或 { ok: false, reason: string }

async function verifyMagicBytes(filePath, allowedMimes) {
  let fd;
  try {
    // 读前 16 字节足以检测所有主流格式
    const buf = Buffer.alloc(16);
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    fd = null;

    const detected = await fileType.fromBuffer(buf.slice(0, bytesRead));

    if (!detected) {
      // file-type 无法识别 → 可能是 text/plain、XML、JSON 等纯文本
      // 对纯文本我们允许，其余未知二进制拒绝
      if (allowedMimes.has('text/plain')) return { ok: true, mime: 'text/plain' };
      return { ok: false, reason: `无法识别文件类型（可能为可执行文件或未知格式）` };
    }

    if (!allowedMimes.has(detected.mime)) {
      return { ok: false, reason: `文件真实类型为 ${detected.mime}，不在允许范围内` };
    }

    return { ok: true, mime: detected.mime };
  } catch (e) {
    if (fd != null) try { fs.closeSync(fd); } catch {}
    return { ok: false, reason: `魔数校验失败: ${e.message}` };
  }
}

// ── 魔数校验中间件（在 multer 写盘后执行）────────────────────────

function makeMagicBytesMiddleware(allowedMimes) {
  return async (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) return next();

    for (const file of files) {
      // 1. 原始名扩展名黑名单
      const origExt = path.extname(file.originalname).toLowerCase();
      if (BLOCKED_EXTENSIONS.has(origExt)) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({ error: `400 Invalid File Type: 禁止上传 ${origExt} 类型文件` });
      }

      // 2. 读取魔数验证真实 MIME
      const result = await verifyMagicBytes(file.path, allowedMimes);
      if (!result.ok) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({ error: `400 Invalid File Type: ${result.reason}` });
      }
    }
    next();
  };
}

// ── Multer 错误处理 ───────────────────────────────────────────────

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件超过大小限制（最大 50MB）' });
    }
    return res.status(400).json({ error: `上传错误: ${err.message}` });
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

function wrapUpload(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  };
}

// ── 聊天文件上传（含魔数二次校验）────────────────────────────────

function makeChatUploader(dest) {
  const storage = multer.diskStorage({
    destination: dest,
    filename: (req, file, cb) => {
      // 文件名使用 UUID + 从 Content-Type 派生的扩展名
      const ext = MIME_TO_EXT[file.mimetype] || '.bin';
      cb(null, uuidv4() + ext);
    },
  });

  const multerMw = wrapUpload(multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      // 第一道防线：Content-Type 白名单
      if (!ALLOWED_CHAT_MIMES.has(file.mimetype)) {
        return cb(new Error(`400 Invalid File Type: 不支持的 Content-Type (${file.mimetype})`));
      }
      cb(null, true);
    },
  }).single('file'));

  // 返回 [multer中间件, 魔数校验中间件] 组合
  const magicMw = makeMagicBytesMiddleware(ALLOWED_CHAT_MIMES);
  return [multerMw, magicMw];
}

// ── 图片上传（头像、群头像等，含魔数校验）────────────────

function makeImageUploader(dest, fieldName = 'image', maxCount = 1, maxSize = 5 * 1024 * 1024) {
  const storage = multer.diskStorage({
    destination: dest,
    filename: (req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
      cb(null, uuidv4() + ext);
    },
  });
  const m = multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
        return cb(new Error('400 Invalid File Type: 仅支持图片格式（JPEG/PNG/GIF/WebP）'));
      }
      cb(null, true);
    },
  });
  const middleware = maxCount === 1 ? m.single(fieldName) : m.array(fieldName, maxCount);
  const magicMw = makeMagicBytesMiddleware(ALLOWED_IMAGE_MIMES);
  return [wrapUpload(middleware), magicMw];
}

module.exports = {
  ALLOWED_CHAT_MIMES,
  ALLOWED_IMAGE_MIMES,
  MIME_TO_EXT,
  BLOCKED_EXTENSIONS,
  sanitizeFilename,
  handleMulterError,
  makeChatUploader,
  makeImageUploader,
};
