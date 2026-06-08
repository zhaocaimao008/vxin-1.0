// Direct test of the conversations SQL query
const Database = require('better-sqlite3');
const db = new Database('/root/v信/backend/wechat.db');

// Use the Anan user who has real conversations
const uid = '5494e7d7-baee-4192-a7c9-681e8009e36b'; // 测试用户

// Check if there's a remark for any of their contacts
const contacts = db.prepare(`
  SELECT co.id, u.username, co.remark 
  FROM contacts co 
  JOIN users u ON u.id = co.contact_id 
  WHERE co.user_id = ?
`).all(uid);

console.log('=== Contacts ===');
contacts.forEach(c => console.log(`  username="${c.username}" remark="${c.remark || ''}"`));

// Simulate the conversations query
const rows = db.prepare(`
    SELECT
      c.id, c.type, c.name, c.avatar,
      ou.id       AS ou_id,
      ou.username AS ou_username,
      ou.avatar   AS ou_avatar,
      ou.status   AS ou_status,
      ct.remark   AS ou_remark
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    LEFT JOIN conversation_members cm_o
           ON cm_o.conversation_id = c.id AND cm_o.user_id != ? AND c.type = 'private'
    LEFT JOIN users ou ON ou.id = cm_o.user_id
    LEFT JOIN contacts ct ON ct.user_id = ? AND ct.contact_id = ou.id
    ORDER BY c.created_at DESC
`).all(uid, uid, uid);

console.log('\n=== Conversations ===');
rows.forEach(r => {
  if (r.type === 'private') {
    console.log(`  [${r.id.substring(0,8)}] name="${r.name}" ou_username="${r.ou_username}" ou_remark="${r.ou_remark || ''}"`);
    console.log(`    => name should be: "${r.ou_remark || r.ou_username || ''}"`);
  } else {
    console.log(`  [${r.id.substring(0,8)}] [GROUP] name="${r.name}"`);
  }
});

// Now set a remark for Anan's first contact
if (contacts.length > 0) {
  const first = contacts[0];
  console.log(`\n=== Setting remark for ${first.username}... ===`);
  db.prepare('UPDATE contacts SET remark=? WHERE user_id=? AND contact_id=?').run('测试备注名', uid, first.id);
  
  // Re-query
  const rows2 = db.prepare(`
    SELECT c.id, c.type, c.name, ou.username AS ou_username, ct.remark AS ou_remark
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    LEFT JOIN conversation_members cm_o ON cm_o.conversation_id = c.id AND cm_o.user_id != ? AND c.type = 'private'
    LEFT JOIN users ou ON ou.id = cm_o.user_id
    LEFT JOIN contacts ct ON ct.user_id = ? AND ct.contact_id = ou.id
    ORDER BY c.created_at DESC
  `).all(uid, uid, uid);
  
  console.log('\n=== After setting remark ===');
  rows2.forEach(r => {
    if (r.type === 'private') {
      console.log(`  name="${r.name}" ou_username="${r.ou_username}" ou_remark="${r.ou_remark || ''}"`);
      const expected = r.ou_remark || r.ou_username;
      console.log(`  => name MATCHES "${expected}"? ${r.name === expected ? 'YES ✓' : 'NO ✗ - name="${r.name}" expected="${expected}"'}`);
    }
  });
  
  // Clean up
  db.prepare('UPDATE contacts SET remark=? WHERE user_id=? AND contact_id=?').run('', uid, first.id);
}

db.close();
