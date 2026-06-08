// Simulate EXACTLY what the backend does
const Database = require('better-sqlite3');
const db = new Database('/root/v信/backend/wechat.db');

const uid = '5494e7d7-baee-4192-a7c9-681e8009e36b'; // 测试用户

// Exact same query as the backend
const rows = db.prepare(`
    SELECT
      c.id, c.type, c.name, c.avatar,
      m.content    AS lastMessage,
      m.type       AS lastMessageType,
      m.created_at AS lastTime,
      su.username  AS lastSenderName,
      COALESCE(cs.pinned, 0)                AS pinned,
      COALESCE(cs.muted,  0)                AS muted,
      COALESCE(cs.last_read_at, 0)          AS last_read_at,
      COALESCE(cs.last_read_message_id, '') AS last_read_message_id,
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM messages mu
        WHERE  mu.conversation_id = c.id
          AND  mu.sender_id      != ?
          AND  mu.deleted         = 0
          AND  mu.created_at      > COALESCE(cs.last_read_at, 0)
        LIMIT 99
      )) AS unreadCount,
      ou.id       AS ou_id,
      ou.username AS ou_username,
      ou.avatar   AS ou_avatar,
      ou.status   AS ou_status,
      ct.remark   AS ou_remark
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages WHERE conversation_id = c.id AND deleted = 0
      ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN users su ON su.id = m.sender_id
    LEFT JOIN conversation_settings cs ON cs.user_id = ? AND cs.conversation_id = c.id
    LEFT JOIN conversation_members cm_o
           ON cm_o.conversation_id = c.id AND cm_o.user_id != ? AND c.type = 'private'
    LEFT JOIN users ou ON ou.id = cm_o.user_id
    LEFT JOIN contacts ct ON ct.user_id = ? AND ct.contact_id = ou.id
    ORDER BY COALESCE(cs.pinned, 0) DESC, COALESCE(m.created_at, c.created_at) DESC
`).all(uid, uid, uid, uid, uid);

console.log('=== RAW rows from SQL ===');
rows.forEach(r => {
  console.log(`type=${r.type} c_name="${r.name}" ou_username="${r.ou_username}" ou_remark="${r.ou_remark || ''}"`);
});

// Now simulate exactly what the backend response builder does
console.log('\n=== After backend response builder ===');
const result = rows.map(({ ou_id, ou_username, ou_avatar, ou_status, ou_remark, ...conv }) => {
    if (conv.type === 'private') {
      const otherUser = ou_id ? { id: ou_id, username: ou_username, avatar: ou_avatar, status: ou_status, remark: ou_remark || '' } : null;
      return { ...conv, name: otherUser?.remark || otherUser?.username || '', avatar: otherUser?.avatar || '', otherUser };
    }
    return { ...conv, members: [] };
});

result.forEach(r => {
  if (r.type === 'private') {
    const o = r.otherUser || {};
    const expected = o.remark || o.username;
    console.log(`name="${r.name}" expected="${expected}" ${r.name === expected ? '✓ OK' : '✗ FAIL'}`);
  } else {
    console.log(`[GROUP] name="${r.name}"`);
  }
});

db.close();
