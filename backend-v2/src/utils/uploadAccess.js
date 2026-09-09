'use strict';
const path = require('path');
const config = require('../config');
const { db } = require('../db/connection');

// Only canonical local paths (or this application's absolute URLs) identify local resources.
function localUploadPath(url) {
  if (typeof url !== 'string') return null;
  let value = url;
  if (/^https?:\/\//i.test(value)) {
    let parsed;
    try { parsed = new URL(value); } catch { return null; }
    const origins = [config.appUrl, process.env.CDN_BASE_URL].filter(Boolean).map(v => new URL(v).origin);
    if (!origins.includes(parsed.origin)) return null;
    value = parsed.pathname;
  }
  try { value = decodeURIComponent(value.split('?')[0]); } catch { return null; }
  if (!value.startsWith('/uploads/') || /[\\\x00%#]/.test(value) || value.split('/').some(v => v === '.' || v === '..')) return null;
  return value;
}

function canAccessUpload(userId, url) {
  const local = localUploadPath(url);
  if (!local) return false;
  const urls = [...new Set([local, config.appUrl.replace(/\/$/, '') + local,
    ...(process.env.CDN_BASE_URL ? [process.env.CDN_BASE_URL.replace(/\/$/, '') + local] : [])])];
  const ph = urls.map(() => '?').join(',');
  // A current, non-retracted message is the source of download authority, including forwarded files.
  if (db.prepare(`SELECT 1 FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
      WHERE m.file_url IN (${ph}) AND m.deleted=0 AND cm.user_id=? LIMIT 1`).get(...urls, userId)) return true;
  if (local.startsWith('/uploads/files/')) return false;

  if (local.startsWith('/uploads/moments/')) {
    const rows = db.prepare(`SELECT m.* FROM moments m
      WHERE EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(m.images) THEN m.images ELSE '[]' END) j
                    WHERE j.value IN (${ph}))`).all(...urls);
    for (const row of rows) {
      try { require('../modules/moments/moments.service').assertVisible(userId, row); return true; }
      catch (err) { if (err.status !== 403) throw err; }
    }
    if (rows.length) return false;
  }
  if (local.startsWith('/uploads/avatars/')) {
    // Public avatar fields remain visible to authenticated users; covers honor profile visibility.
    if (db.prepare(`SELECT 1 FROM users WHERE avatar IN (${ph}) LIMIT 1`).get(...urls)) return true;
    if (db.prepare(`SELECT 1 FROM users u LEFT JOIN user_settings s ON s.user_id=u.id
        WHERE u.cover_photo IN (${ph}) AND (u.id=? OR COALESCE(s.profile_visible,1)=1 OR EXISTS (SELECT 1 FROM contacts WHERE user_id=? AND contact_id=u.id)) LIMIT 1`).get(...urls, userId, userId)) return true;
    if (db.prepare(`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
        WHERE c.avatar IN (${ph}) AND cm.user_id=? LIMIT 1`).get(...urls, userId)) return true;
  }
  // Unpublished uploads are only previewable by the authenticated uploader, never by URL possession.
  return !!db.prepare('SELECT 1 FROM upload_owners WHERE path=? AND user_id=?').get(local, userId);
}

function recordUploadedFiles(req, res, next) {
  try {
    for (const file of req.files || (req.file ? [req.file] : [])) {
      const rel = path.relative(config.uploadsRoot, file.path);
      if (!req.user?.id || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid upload owner');
      db.prepare('INSERT INTO upload_owners (path,user_id) VALUES (?,?)').run('/uploads/' + rel.split(path.sep).join('/'), req.user.id);
    }
    next();
  } catch (err) { next(err); }
}
module.exports = { localUploadPath, canAccessUpload, recordUploadedFiles };
