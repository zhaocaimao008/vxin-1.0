"""
DB Helper — 直接操作 SQLite，绕过邀请码/限流，用于测试 Setup 和 Teardown。
所有测试数据统一以 TEST_PREFIX 为命名前缀，Teardown 时按前缀级联清理。
"""
import sqlite3
import uuid
import time
import bcrypt

DB_PATH = "/root/v信/backend/wechat.db"
TEST_PREFIX = f"pytest_{int(time.time())}"


def _conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── 用户 ──────────────────────────────────────────────────────────

def _unique_wechat_id(conn) -> str:
    """生成未被占用的 6 位数字 wechat_id（与生产逻辑对齐）。"""
    import random
    for _ in range(200):
        candidate = str(random.randint(100000, 999999))
        taken = conn.execute(
            "SELECT 1 FROM users WHERE wechat_id=?", (candidate,)
        ).fetchone()
        if not taken:
            return candidate
    raise RuntimeError("无法分配测试 wechat_id，测试数据过多")


def create_user(tag: str, index: int) -> dict:
    """
    直接向 DB 写入用户。
    tag: 区分不同测试场景的简短标签，如 'offline', 'grp'
    返回含明文密码的用户字典，供登录使用。
    """
    uid       = str(uuid.uuid4())
    ts_suffix = str(int(time.time()))[-7:]
    phone     = f"1{ts_suffix}{index:03d}"[:11]   # 严格 11 位
    username  = f"{TEST_PREFIX}_{tag}_{index}"
    password  = "Test123456"
    pw_hash   = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()

    with _conn() as c:
        wechat_id = _unique_wechat_id(c)
        c.execute(
            "INSERT INTO users (id, username, phone, password, wechat_id, status) "
            "VALUES (?,?,?,?,?,?)",
            (uid, username, phone, pw_hash, wechat_id, "offline"),
        )
    return {
        "id": uid,
        "username": username,
        "phone": phone,
        "password": password,
        "wechat_id": wechat_id,
    }


# ── 会话 ──────────────────────────────────────────────────────────

def create_private_conv(user_a_id: str, user_b_id: str) -> str:
    conv_id = str(uuid.uuid4())
    with _conn() as c:
        c.execute(
            "INSERT INTO conversations (id, type, name) VALUES (?,?,?)",
            (conv_id, "private", ""),
        )
        c.execute(
            "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?,?,?)",
            (conv_id, user_a_id, "member"),
        )
        c.execute(
            "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?,?,?)",
            (conv_id, user_b_id, "member"),
        )
    return conv_id


def create_group_conv(owner_id: str, name: str, members: list[tuple]) -> str:
    """
    members: [(user_id, role), ...]  role ∈ {'owner','admin','member'}
    owner_id 自动以 'owner' 角色加入。
    """
    conv_id = str(uuid.uuid4())
    with _conn() as c:
        c.execute(
            "INSERT INTO conversations (id, type, name, owner_id) VALUES (?,?,?,?)",
            (conv_id, "group", name, owner_id),
        )
        c.execute(
            "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?,?,?)",
            (conv_id, owner_id, "owner"),
        )
        for uid, role in members:
            c.execute(
                "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?,?,?)",
                (conv_id, uid, role),
            )
    return conv_id


def set_no_add_friend(conv_id: str, value: int = 1):
    with _conn() as c:
        c.execute(
            "UPDATE conversations SET no_add_friend=? WHERE id=?",
            (value, conv_id),
        )


# ── 消息 ──────────────────────────────────────────────────────────

def insert_messages(sender_id: str, conv_id: str, contents: list[str]) -> tuple[list[str], int]:
    """
    直接向 DB 插入消息，每条消息 created_at 递增 1 秒以保证有序。
    返回 (msg_ids, base_timestamp)
    base_timestamp 是第一条消息的 created_at，用于 missed?after= 参数。
    """
    base_ts = int(time.time())
    msg_ids = []
    with _conn() as c:
        for i, content in enumerate(contents):
            msg_id = str(uuid.uuid4())
            c.execute(
                "INSERT INTO messages (id, conversation_id, sender_id, type, content, created_at) "
                "VALUES (?,?,?,?,?,?)",
                (msg_id, conv_id, sender_id, "text", content, base_ts + i),
            )
            msg_ids.append(msg_id)
    return msg_ids, base_ts


# ── Teardown ──────────────────────────────────────────────────────

def cleanup_test_data():
    """
    删除所有以 TEST_PREFIX 为用户名前缀的测试数据。
    遵循外键依赖顺序：messages → conversations → users。
    """
    with _conn() as c:
        # 1. 找测试用户
        rows  = c.execute(
            "SELECT id FROM users WHERE username LIKE ?",
            (f"{TEST_PREFIX}%",),
        ).fetchall()
        uids  = [r["id"] for r in rows]
        if not uids:
            return

        uid_ph = ",".join("?" * len(uids))

        # 2. 找测试会话
        crows  = c.execute(
            f"SELECT DISTINCT conversation_id FROM conversation_members WHERE user_id IN ({uid_ph})",
            uids,
        ).fetchall()
        cids   = [r["conversation_id"] for r in crows]

        # 3. 清理消息相关
        if cids:
            cid_ph = ",".join("?" * len(cids))
            mrows  = c.execute(
                f"SELECT id FROM messages WHERE conversation_id IN ({cid_ph})",
                cids,
            ).fetchall()
            mids   = [r["id"] for r in mrows]

            if mids:
                mid_ph = ",".join("?" * len(mids))
                c.execute(f"DELETE FROM message_reactions WHERE message_id IN ({mid_ph})", mids)
                c.execute(f"DELETE FROM message_deliveries WHERE message_id IN ({mid_ph})", mids)
                # FTS 不受 DELETE 触发器保护，需手动清理
                c.execute(f"DELETE FROM messages_fts WHERE message_id IN ({mid_ph})", mids)
                c.execute(f"DELETE FROM messages WHERE id IN ({mid_ph})", mids)

            c.execute(f"DELETE FROM pinned_messages      WHERE conversation_id IN ({cid_ph})", cids)
            c.execute(f"DELETE FROM conversation_settings WHERE conversation_id IN ({cid_ph})", cids)
            c.execute(f"DELETE FROM group_invite_tokens  WHERE conversation_id IN ({cid_ph})", cids)
            c.execute(f"DELETE FROM conversation_members WHERE conversation_id IN ({cid_ph})", cids)
            c.execute(f"DELETE FROM conversations        WHERE id IN ({cid_ph})", cids)

        # 4. 清理用户衍生数据
        c.execute(f"DELETE FROM contacts       WHERE user_id IN ({uid_ph}) OR contact_id IN ({uid_ph})", uids * 2)
        c.execute(f"DELETE FROM friend_requests WHERE from_id IN ({uid_ph}) OR to_id IN ({uid_ph})", uids * 2)
        c.execute(f"DELETE FROM blocked_users  WHERE user_id IN ({uid_ph}) OR blocked_id IN ({uid_ph})", uids * 2)
        c.execute(f"DELETE FROM user_settings  WHERE user_id IN ({uid_ph})", uids)
        c.execute(f"DELETE FROM user_sessions  WHERE user_id IN ({uid_ph})", uids)
        c.execute(f"DELETE FROM users          WHERE id IN ({uid_ph})", uids)
