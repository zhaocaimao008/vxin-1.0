"""
test_security.py — 安全测试套件
覆盖：
  TC-SEC-01  垂直越权 — member 踢人 → 403
  TC-SEC-02  垂直越权 — admin 踢人 → 403（kick 仅群主）
  TC-SEC-03  垂直越权 — member 设置角色 → 403
  TC-SEC-04  垂直越权 — member 修改群管理设置 → 403
  TC-SEC-05  水平越权 — 撤回他人消息 → 403，DB 未变动
  TC-SEC-06  SQL 注入 — 多组注入载荷不触发 500
  TC-SEC-07  SQL 注入 — 注入后 DB 核心表完整性验证
  TC-SEC-08  CSRF — 有 Cookie 缺 header → 403
  TC-SEC-09  CSRF — 有 Cookie 但 header 值错误 → 403
  TC-SEC-10  XSS — script/事件处理器载荷安全存储（200，不崩溃）
  TC-SEC-11  超长消息 2001 字符 → 400，不崩溃
"""
import sqlite3
import uuid

import pytest
import requests

from helpers.db_helper import (
    DB_PATH, TEST_PREFIX,
    create_user, create_group_conv, create_private_conv, insert_messages,
)
from helpers.api_client import VxinSession, BASE_URL


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def sec_group_ctx():
    """
    群权限测试 fixture：
      - owner / admin / member 三个角色
      - victim：普通成员（被非群主尝试操作的目标）
    """
    owner  = create_user("sec_own", 200)
    admin  = create_user("sec_adm", 201)
    member = create_user("sec_mbr", 202)
    victim = create_user("sec_vic", 203)

    conv_id = create_group_conv(
        owner["id"],
        f"{TEST_PREFIX}_安全测试群",
        members=[
            (admin["id"],  "admin"),
            (member["id"], "member"),
            (victim["id"], "member"),
        ],
    )

    sess_owner  = VxinSession().direct_auth(owner)
    sess_admin  = VxinSession().direct_auth(admin)
    sess_member = VxinSession().direct_auth(member)

    yield {
        "owner":       owner,
        "admin":       admin,
        "member":      member,
        "victim":      victim,
        "conv_id":     conv_id,
        "sess_owner":  sess_owner,
        "sess_admin":  sess_admin,
        "sess_member": sess_member,
    }
    for s in [sess_owner, sess_admin, sess_member]:
        s.logout()


@pytest.fixture(scope="module")
def sec_horiz_ctx():
    """
    水平越权测试 fixture：
      - user_a / user_b 同一私聊
      - B 发了一条消息，A 尝试撤回它
    """
    user_a  = create_user("sec_ha", 210)
    user_b  = create_user("sec_hb", 211)
    conv_id = create_private_conv(user_a["id"], user_b["id"])

    msg_ids, _ = insert_messages(user_b["id"], conv_id, ["B的私密消息（A无权撤回）"])
    msg_id = msg_ids[0]

    sess_a = VxinSession().direct_auth(user_a)
    sess_b = VxinSession().direct_auth(user_b)

    yield {
        "user_a":  user_a,
        "user_b":  user_b,
        "conv_id": conv_id,
        "msg_id":  msg_id,
        "sess_a":  sess_a,
        "sess_b":  sess_b,
    }
    sess_a.logout()
    sess_b.logout()


@pytest.fixture(scope="module")
def sec_common_ctx():
    """通用测试 fixture（注入 / CSRF / XSS / 超长消息）。"""
    user_a  = create_user("sec_ca", 220)
    user_b  = create_user("sec_cb", 221)
    conv_id = create_private_conv(user_a["id"], user_b["id"])
    sess_a  = VxinSession().direct_auth(user_a)

    yield {"conv_id": conv_id, "sess_a": sess_a}
    sess_a.logout()


# ── 工具 ──────────────────────────────────────────────────────────────────────

def _raw_session_with_cookies(sess: VxinSession) -> requests.Session:
    """复制 Cookie Jar 到全新 Session，不携带任何自定义请求头。"""
    raw = requests.Session()
    raw.verify = False
    raw.cookies.update(sess._s.cookies)
    return raw


# ── TC-SEC-01~04: 垂直越权（IDOR / BOLA）────────────────────────────────────

class TestVerticalPrivilegeEscalation:

    def test_01_member_cannot_kick(self, sec_group_ctx):
        ctx  = sec_group_ctx
        resp = ctx["sess_member"].delete(
            f"/api/messages/conversation/{ctx['conv_id']}/members/{ctx['victim']['id']}"
        )
        assert resp.status_code == 403, (
            f"TC-SEC-01 FAIL: member 踢人应返回 403，实际 {resp.status_code}，body={resp.text}"
        )

    def test_02_admin_cannot_kick(self, sec_group_ctx):
        """kick 是群主专属操作，admin 也不能踢人。"""
        ctx  = sec_group_ctx
        resp = ctx["sess_admin"].delete(
            f"/api/messages/conversation/{ctx['conv_id']}/members/{ctx['victim']['id']}"
        )
        assert resp.status_code == 403, (
            f"TC-SEC-02 FAIL: admin 踢人应返回 403，实际 {resp.status_code}"
        )

    def test_03_member_cannot_set_role(self, sec_group_ctx):
        ctx  = sec_group_ctx
        resp = ctx["sess_member"].put(
            f"/api/messages/conversation/{ctx['conv_id']}/members/{ctx['victim']['id']}/role",
            json={"role": "admin"},
        )
        assert resp.status_code == 403, (
            f"TC-SEC-03 FAIL: member 设置角色应返回 403，实际 {resp.status_code}"
        )

    def test_04_member_cannot_manage_settings(self, sec_group_ctx):
        ctx  = sec_group_ctx
        resp = ctx["sess_member"].put(
            f"/api/messages/conversation/{ctx['conv_id']}/manage",
            json={"mute_all": True},
        )
        assert resp.status_code == 403, (
            f"TC-SEC-04 FAIL: member 修改群管理设置应返回 403，实际 {resp.status_code}"
        )


# ── TC-SEC-05: 水平越权 — 撤回他人消息 ────────────────────────────────────────

class TestHorizontalPrivilegeEscalation:

    def test_05_cannot_recall_others_message(self, sec_horiz_ctx):
        ctx  = sec_horiz_ctx
        # forEveryone=True 触发真实撤回路径（广播删除），该路径才有 sender_id 校验
        resp = ctx["sess_a"].delete(
            f"/api/messages/{ctx['msg_id']}",
            json={"forEveryone": True},
        )

        assert resp.status_code == 403, (
            f"TC-SEC-05 FAIL: 撤回他人消息应返回 403，实际 {resp.status_code}，body={resp.text}"
        )

        conn = sqlite3.connect(DB_PATH)
        row  = conn.execute(
            "SELECT deleted FROM messages WHERE id=?", (ctx["msg_id"],)
        ).fetchone()
        conn.close()

        assert row is not None, "TC-SEC-05 FAIL: 目标消息意外从 DB 消失"
        assert row[0] == 0, "TC-SEC-05 FAIL: 目标消息被意外标记为 deleted=1"


# ── TC-SEC-06~07: SQL 注入安全性 ─────────────────────────────────────────────

SQL_INJECTION_PAYLOADS = [
    "'; DROP TABLE messages; --",
    "1' OR '1'='1",
    "' UNION SELECT id,username,password FROM users --",
    "'; INSERT INTO users (id,username) VALUES ('evil_id','evil'); --",
    '" OR 1=1 --',
    "\\'; DELETE FROM conversations; --",
]


class TestSqlInjection:

    @pytest.mark.parametrize("payload", SQL_INJECTION_PAYLOADS)
    def test_06_injection_payload_no_500(self, sec_common_ctx, payload):
        """注入载荷作为消息内容，不应触发服务端 500。"""
        ctx  = sec_common_ctx
        resp = ctx["sess_a"].post(
            f"/api/messages/{ctx['conv_id']}",
            json={"content": payload, "type": "text"},
        )
        assert resp.status_code != 500, (
            f"TC-SEC-06 FAIL: SQL 注入载荷触发 500，payload={payload!r}，body={resp.text[:300]}"
        )

    def test_07_db_core_tables_intact_after_injection(self, sec_common_ctx):
        """发送所有注入载荷后，核心表结构与数据应完整无损。"""
        conn   = sqlite3.connect(DB_PATH)
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        conn.close()

        for table in ("users", "messages", "conversations", "conversation_members"):
            assert table in tables, (
                f"TC-SEC-07 FAIL: 核心表 '{table}' 不存在，可能被注入操作删除"
            )


# ── TC-SEC-08~09: CSRF 保护逆向验证 ─────────────────────────────────────────

class TestCsrfProtection:

    def test_08_no_csrf_header_returns_403(self, sec_common_ctx):
        """
        已登录用户 POST 请求：有 vxin_token + csrf_token Cookie，
        但不携带 X-CSRF-Token 请求头 → CSRF 中间件拦截，返回 403。
        """
        ctx = sec_common_ctx
        raw = _raw_session_with_cookies(ctx["sess_a"])
        resp = raw.post(
            f"{BASE_URL}/api/messages/{ctx['conv_id']}",
            json={"content": "csrf_test_no_header", "type": "text"},
        )
        assert resp.status_code == 403, (
            f"TC-SEC-08 FAIL: 缺失 X-CSRF-Token 应返回 403，"
            f"实际 {resp.status_code}，body={resp.text}"
        )

    def test_09_wrong_csrf_header_returns_403(self, sec_common_ctx):
        """
        有 Cookie，但 X-CSRF-Token header 值为随机 UUID → 403。
        """
        ctx = sec_common_ctx
        raw = _raw_session_with_cookies(ctx["sess_a"])
        raw.headers["X-CSRF-Token"] = f"invalid-{uuid.uuid4()}"
        resp = raw.post(
            f"{BASE_URL}/api/messages/{ctx['conv_id']}",
            json={"content": "csrf_test_wrong_header", "type": "text"},
        )
        assert resp.status_code == 403, (
            f"TC-SEC-09 FAIL: 错误 X-CSRF-Token 应返回 403，"
            f"实际 {resp.status_code}，body={resp.text}"
        )


# ── TC-SEC-10~11: XSS 载荷与超长消息 ─────────────────────────────────────────

XSS_PAYLOADS = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert(1)>",
    'javascript:alert(1)',
    '"><svg/onload=alert(1)>',
    "<iframe src=javascript:alert('xss')>",
]


class TestPayloadSafety:

    @pytest.mark.parametrize("payload", XSS_PAYLOADS)
    def test_10_xss_payload_stored_safely(self, sec_common_ctx, payload):
        """
        XSS 载荷作为消息内容发送：
        - 服务端应正常存储（200），不应崩溃（500）
        - XSS 防护属于前端/CSP 层职责，API 层只保证不崩溃
        """
        ctx  = sec_common_ctx
        resp = ctx["sess_a"].post(
            f"/api/messages/{ctx['conv_id']}",
            json={"content": payload, "type": "text"},
        )
        assert resp.status_code in (200, 201), (
            f"TC-SEC-10 FAIL: XSS 载荷导致非 2xx，payload={payload!r}，"
            f"status={resp.status_code}，body={resp.text[:200]}"
        )

    def test_11_oversized_message_2001_chars_returns_400(self, sec_common_ctx):
        """
        消息内容超过 MAX=2000 字符时，应返回 400 并带有错误描述，不崩溃。
        """
        ctx     = sec_common_ctx
        payload = "测" * 2001
        resp    = ctx["sess_a"].post(
            f"/api/messages/{ctx['conv_id']}",
            json={"content": payload, "type": "text"},
        )
        assert resp.status_code == 400, (
            f"TC-SEC-11 FAIL: 2001 字符消息应返回 400，"
            f"实际 {resp.status_code}，body={resp.text[:200]}"
        )
        body = resp.json()
        assert "error" in body, f"TC-SEC-11 FAIL: 响应体应含 'error' 字段，实际={body}"
