"""
测试模块：群组高级权限 — 禁止互加好友越权测试
覆盖场景：
  TC-NAF-01  [核心] 开启后，同群成员互发好友申请被 403 拦截
  TC-NAF-02  [核心] 错误信息包含触发限制的群名称
  TC-NAF-03  管理员向同群成员发好友申请同样被 403 拦截
  TC-NAF-04  群外用户向群内成员发好友申请不受限制
  TC-NAF-05  关闭 no_add_friend 后，成员可正常发申请
  TC-NAF-06  普通成员无法通过 API 修改 no_add_friend 设置（越权）
  TC-NAF-07  管理员可修改 no_add_friend 设置（合法）
  TC-NAF-08  尝试在 body 中注入 role 字段绕过权限检查
  TC-NAF-09  资料查看接口（GET /users/:id）不受 no_add_friend 限制
  TC-NAF-10  [BUG验证] 已有好友关系的重复申请返回正确错误
"""
import pytest

from helpers.db_helper import set_no_add_friend, TEST_PREFIX
from helpers.api_client import VxinSession


class TestNoAddFriendPrivilege:
    """用例编号 TC-NAF-01 ~ TC-NAF-10"""

    # ── TC-NAF-01: 同群成员互发好友申请被 403 拦截（核心场景）────

    def test_01_member_to_member_blocked(self, no_add_friend_ctx):
        ctx  = no_add_friend_ctx
        resp = ctx["sess_mc"].send_friend_request(
            ctx["member_d"]["id"],
            message="hi, 加个好友",
        )

        assert resp.status_code == 403, (
            f"TC-NAF-01 FAIL: 期望 403，实际 {resp.status_code}，body={resp.text}"
        )
        body = resp.json()
        assert "error" in body, \
            f"TC-NAF-01 FAIL: 响应体缺少 'error' 字段，实际={body}"

    # ── TC-NAF-02: 错误信息包含触发限制的群名称 ──────────────────

    def test_02_error_message_contains_group_name(self, no_add_friend_ctx):
        ctx        = no_add_friend_ctx
        group_name = f"{TEST_PREFIX}_禁加好友测试群"

        resp = ctx["sess_mc"].send_friend_request(ctx["member_d"]["id"])

        assert resp.status_code == 403
        error_msg = resp.json().get("error", "")
        assert group_name in error_msg, (
            f"TC-NAF-02 FAIL: 错误信息应含群名称 '{group_name}'，"
            f"实际错误='{error_msg}'"
        )
        assert "禁止群成员互相添加好友" in error_msg, (
            f"TC-NAF-02 FAIL: 错误信息应含 '禁止群成员互相添加好友'，"
            f"实际='{error_msg}'"
        )

    # ── TC-NAF-03: 管理员向同群成员发申请同样被拦截 ───────────────

    def test_03_admin_to_member_also_blocked(self, no_add_friend_ctx):
        ctx  = no_add_friend_ctx
        resp = ctx["sess_admin"].send_friend_request(ctx["member_c"]["id"])

        assert resp.status_code == 403, (
            f"TC-NAF-03 FAIL: 管理员向同群成员发申请应被 403 拦截，"
            f"实际 {resp.status_code}。\n"
            f"说明：no_add_friend 对所有角色生效（含 admin），"
            f"SQL 检查仅依赖 conversation_members 成员资格，不过滤角色。"
        )

    # ── TC-NAF-04: 群外用户向群内成员发申请不受限制 ───────────────

    def test_04_outsider_to_member_not_blocked(self, no_add_friend_ctx):
        """
        outsider 不在 no_add_friend 群中，
        发申请给 member_c 时，contacts.service.js:sendFriendRequest
        的 restricted 查询找不到共同群，应正常处理（pending 或 autoAccepted）。
        """
        ctx  = no_add_friend_ctx
        resp = ctx["sess_outside"].send_friend_request(
            ctx["member_c"]["id"],
            message="我是群外用户",
        )
        # 期望：200（好友申请成功发出）或 400（已是好友/请求已存在）
        # 关键：不应是 403 "禁止群成员互相添加好友"
        assert resp.status_code in (200, 400), (
            f"TC-NAF-04 FAIL: 群外用户申请应返回 200/400，"
            f"实际 {resp.status_code}，body={resp.text}"
        )
        if resp.status_code == 403:
            error_msg = resp.json().get("error", "")
            assert "禁止群成员" not in error_msg, (
                f"TC-NAF-04 FAIL: 群外用户不应被 '禁止群成员互加' 规则拦截"
            )

    # ── TC-NAF-05: 关闭 no_add_friend 后成员可正常发申请 ──────────

    def test_05_after_disable_members_can_request(self, no_add_friend_ctx):
        ctx = no_add_friend_ctx
        # 先验证开启状态下确实被拦截
        pre_resp = ctx["sess_mc"].send_friend_request(ctx["member_d"]["id"])
        assert pre_resp.status_code == 403, \
            "TC-NAF-05 前置条件失败：no_add_friend=1 下应被 403 拦截"

        # 群主关闭 no_add_friend
        disable_resp = ctx["sess_owner"].set_group_manage(
            ctx["conv_id"], no_add_friend=False
        )
        assert disable_resp.status_code == 200, (
            f"TC-NAF-05 FAIL: 群主关闭 no_add_friend 失败，"
            f"{disable_resp.status_code}: {disable_resp.text}"
        )

        try:
            # 再次发送申请，应不再被拦截
            post_resp = ctx["sess_mc"].send_friend_request(
                ctx["member_d"]["id"],
                message="关闭限制后的申请",
            )
            assert post_resp.status_code in (200, 400), (
                f"TC-NAF-05 FAIL: 关闭后期望 200/400，"
                f"实际 {post_resp.status_code}，body={post_resp.text}"
            )
            # 不应再出现 "禁止群成员" 错误
            if post_resp.status_code == 403:
                pytest.fail(
                    f"TC-NAF-05 FAIL: 关闭 no_add_friend 后仍返回 403，"
                    f"error='{post_resp.json().get('error')}'"
                )
        finally:
            # 恢复 no_add_friend=1，保证后续测试不受影响
            set_no_add_friend(ctx["conv_id"], 1)

    # ── TC-NAF-06: 普通成员无法修改 no_add_friend（越权）────────

    def test_06_member_cannot_change_no_add_friend(self, no_add_friend_ctx):
        ctx  = no_add_friend_ctx
        resp = ctx["sess_mc"].set_group_manage(
            ctx["conv_id"], no_add_friend=False
        )

        assert resp.status_code == 403, (
            f"TC-NAF-06 FAIL: 普通成员修改群设置应返回 403，"
            f"实际 {resp.status_code}，body={resp.text}"
        )
        body = resp.json()
        assert "error" in body
        assert "无权" in body["error"] or "管理员" in body["error"], (
            f"TC-NAF-06 FAIL: 错误提示不符合预期，实际='{body['error']}'"
        )

    # ── TC-NAF-07: 管理员可合法修改 no_add_friend ─────────────────

    def test_07_admin_can_change_no_add_friend(self, no_add_friend_ctx):
        ctx  = no_add_friend_ctx
        # 管理员关闭
        resp = ctx["sess_admin"].set_group_manage(
            ctx["conv_id"], no_add_friend=False
        )
        assert resp.status_code == 200, (
            f"TC-NAF-07 FAIL: 管理员应可修改群设置，"
            f"实际 {resp.status_code}: {resp.text}"
        )
        body = resp.json()
        assert body.get("no_add_friend") == 0, (
            f"TC-NAF-07 FAIL: 返回值 no_add_friend 应为 0，实际={body}"
        )

        # 恢复
        set_no_add_friend(ctx["conv_id"], 1)

    # ── TC-NAF-08: body 中注入 role 字段不影响权限判定 ────────────

    def test_08_body_role_injection_ignored(self, no_add_friend_ctx):
        """
        普通成员在 PUT /manage 的 body 中注入 role: 'owner'，
        服务端应忽略 body 中的 role 字段，仍以 DB 中的实际角色鉴权。
        """
        ctx = no_add_friend_ctx
        # 构造含 role 注入的请求
        resp = ctx["sess_mc"]._s.put(
            f"{ctx['sess_mc'].base_url}/api/messages/conversation/{ctx['conv_id']}/manage",
            json={"no_add_friend": False, "role": "owner"},  # 注入 role
        )

        assert resp.status_code == 403, (
            f"TC-NAF-08 FAIL: role 注入应被忽略，操作应仍被 403 拒绝，"
            f"实际 {resp.status_code}，body={resp.text}"
        )

    # ── TC-NAF-09: 资料查看接口不受 no_add_friend 限制 ───────────

    def test_09_profile_view_not_restricted_by_no_add_friend(self, no_add_friend_ctx):
        """
        no_add_friend 仅拦截好友申请 API，
        GET /api/users/:id（查看资料）不受影响。
        这是当前设计行为（详见 BUG-GRP-05：可能的产品歧义点）。
        """
        ctx  = no_add_friend_ctx
        resp = ctx["sess_mc"].get(f"/api/users/{ctx['member_d']['id']}")

        assert resp.status_code == 200, (
            f"TC-NAF-09 FAIL: no_add_friend 不应限制资料查看，"
            f"实际 {resp.status_code}"
        )
        body = resp.json()
        assert body.get("id") == ctx["member_d"]["id"], \
            f"TC-NAF-09 FAIL: 返回的用户 ID 不匹配，实际={body}"
        # 确认可看到基本资料字段
        assert "username" in body, \
            f"TC-NAF-09 FAIL: 响应体缺少 username 字段"

    # ── TC-NAF-10: 向已是好友的成员再次申请返回正确错误 ──────────

    def test_10_duplicate_friend_request_correct_error(self, no_add_friend_ctx):
        """
        先通过 DB 直接建立好友关系，再通过 API 重复申请，
        验证错误提示是 '已是好友' 而非 '禁止互加' 错误。
        此用例验证错误优先级：好友检查 先于 no_add_friend 检查。
        注意 contacts.service.js 代码顺序：先检查 isFriend，再检查 restricted。
        """
        import sqlite3, uuid, time
        ctx = no_add_friend_ctx

        # 直接向 DB 插入好友关系（owner ↔ member_c）
        conn = sqlite3.connect(
            __import__("helpers.db_helper", fromlist=["DB_PATH"]).DB_PATH
        )
        try:
            conn.execute(
                "INSERT OR IGNORE INTO contacts (id, user_id, contact_id) VALUES (?,?,?)",
                (str(uuid.uuid4()), ctx["owner"]["id"], ctx["member_c"]["id"]),
            )
            conn.execute(
                "INSERT OR IGNORE INTO contacts (id, user_id, contact_id) VALUES (?,?,?)",
                (str(uuid.uuid4()), ctx["member_c"]["id"], ctx["owner"]["id"]),
            )
            conn.commit()
        finally:
            conn.close()

        # owner 向 member_c 再次申请好友
        resp = ctx["sess_owner"].send_friend_request(ctx["member_c"]["id"])

        # 期望：400 "已是好友"（而非 403 "禁止群成员互加"）
        # contacts.service.js 行优先级：isFriend 检查 > restricted 检查
        assert resp.status_code == 400, (
            f"TC-NAF-10 FAIL: 向已是好友的成员申请应返回 400，"
            f"实际 {resp.status_code}"
        )
        error_msg = resp.json().get("error", "")
        assert "已是好友" in error_msg, (
            f"TC-NAF-10 FAIL: 错误信息应为 '已是好友'，"
            f"实际='{error_msg}'"
        )
        # 关键：不应是 no_add_friend 错误
        assert "禁止群成员" not in error_msg, (
            f"TC-NAF-10 FAIL: 错误优先级错误，返回了 '禁止群成员' 而非 '已是好友'"
        )
