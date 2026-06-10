"""
测试模块：核心单聊 — 离线消息拉取
覆盖场景：
  TC-OFF-01  基础完整性：50 条消息全量返回
  TC-OFF-02  顺序正确性：messages 严格按 created_at ASC 排列
  TC-OFF-03  字段完整性：每条消息包含必填字段且值正确
  TC-OFF-04  after 边界：after=first_ts 时第一条消息被排除（严格 >）
  TC-OFF-05  非成员被拒：不在会话中的用户调用 missed 返回空集合
  TC-OFF-06  参数校验：after=0 返回 400
  TC-OFF-07  仅返回目标用户所在会话的消息（跨会话隔离）
  TC-OFF-08  已撤回消息（deleted=1）不出现在结果中
  TC-OFF-09  [BUG验证] 超过 300 条时触发截断，消息静默丢失
  TC-OFF-10  HTTP 发消息后 missed 可正确拉取（HTTP 路径落库验证）
"""
import time
import pytest
import sqlite3

from helpers.db_helper import (
    DB_PATH, create_user, create_private_conv, insert_messages, TEST_PREFIX
)
from helpers.api_client import VxinSession


class TestOfflineMessageRetrieval:
    """用例编号 TC-OFF-01 ~ TC-OFF-10"""

    # ── TC-OFF-01: 50 条消息全量返回 ─────────────────────────────

    def test_01_full_retrieval_50_messages(self, offline_msg_ctx):
        ctx  = offline_msg_ctx
        resp = ctx["sess_a"].get_missed(ctx["baseline_ts"])

        assert resp.status_code == 200, (
            f"TC-OFF-01 FAIL: 期望 200，实际 {resp.status_code}，body={resp.text}"
        )
        data = resp.json()
        assert isinstance(data, list), \
            f"TC-OFF-01 FAIL: 返回值应为 list，实际 {type(data)}"
        assert len(data) == 50, (
            f"TC-OFF-01 FAIL: 期望 50 条消息，实际返回 {len(data)} 条"
        )

    # ── TC-OFF-02: 消息严格按 created_at ASC 排列 ─────────────────

    def test_02_messages_ordered_asc_by_created_at(self, offline_msg_ctx):
        ctx  = offline_msg_ctx
        resp = ctx["sess_a"].get_missed(ctx["baseline_ts"])

        assert resp.status_code == 200
        msgs = resp.json()
        timestamps = [m["created_at"] for m in msgs]
        assert timestamps == sorted(timestamps), (
            f"TC-OFF-02 FAIL: 消息未按 created_at ASC 排序。\n"
            f"实际时间序列: {timestamps[:5]}…（显示前5条）"
        )

    # ── TC-OFF-03: 每条消息必填字段完整性 ────────────────────────

    def test_03_message_fields_completeness(self, offline_msg_ctx):
        ctx       = offline_msg_ctx
        resp      = ctx["sess_a"].get_missed(ctx["baseline_ts"])
        msgs      = resp.json()
        required  = {"id", "conversation_id", "sender_id", "type", "content",
                     "created_at", "deleted", "senderName", "senderAvatar"}

        for i, msg in enumerate(msgs):
            missing = required - msg.keys()
            assert not missing, (
                f"TC-OFF-03 FAIL: 第 {i+1} 条消息缺少字段 {missing}，消息体={msg}"
            )
            assert msg["sender_id"] == ctx["user_b"]["id"], (
                f"TC-OFF-03 FAIL: 第 {i+1} 条消息 sender_id 错误，"
                f"期望={ctx['user_b']['id']}，实际={msg['sender_id']}"
            )
            assert msg["conversation_id"] == ctx["conv_id"], (
                f"TC-OFF-03 FAIL: 第 {i+1} 条消息 conversation_id 不匹配"
            )
            assert msg["deleted"] == 0, \
                f"TC-OFF-03 FAIL: 第 {i+1} 条消息 deleted 应为 0"
            assert msg["type"] == "text", \
                f"TC-OFF-03 FAIL: 第 {i+1} 条消息 type 应为 'text'"
            assert msg["senderName"] == ctx["user_b"]["username"], (
                f"TC-OFF-03 FAIL: senderName 错误，"
                f"期望={ctx['user_b']['username']}，实际={msg['senderName']}"
            )

    # ── TC-OFF-04: after= 严格 >，边界消息被排除 ──────────────────

    def test_04_after_boundary_strict_greater_than(self, offline_msg_ctx):
        ctx      = offline_msg_ctx
        first_ts = ctx["first_ts"]

        # after=first_ts：第一条消息 created_at == first_ts，严格 > 不包含，应只返回 49 条
        resp = ctx["sess_a"].get_missed(first_ts)
        assert resp.status_code == 200
        msgs = resp.json()
        assert len(msgs) == 49, (
            f"TC-OFF-04 FAIL: after=first_ts 时应返回 49 条（排除第一条），"
            f"实际返回 {len(msgs)} 条"
        )
        # 第一条消息的 ID 不应出现在结果中
        returned_ids = {m["id"] for m in msgs}
        assert ctx["msg_ids"][0] not in returned_ids, (
            "TC-OFF-04 FAIL: 第一条消息（created_at == after）不应出现在结果中"
        )

    # ── TC-OFF-05: 非成员 missed 只返回自己所在会话的消息 ──────────

    def test_05_cross_conversation_isolation(self, offline_msg_ctx):
        """
        创建一个全新用户，他不在 offline_msg_ctx 的会话中。
        调用 missed 应只返回空列表，而非越权看到其他会话消息。
        """
        stranger      = create_user("off_str", 99)
        sess_stranger = VxinSession().direct_auth(stranger)

        try:
            resp = sess_stranger.get_missed(ctx := offline_msg_ctx["baseline_ts"])
            assert resp.status_code == 200
            msgs = resp.json()
            # stranger 不在任何测试会话中，应返回空列表
            assert msgs == [], (
                f"TC-OFF-05 FAIL: 非成员不应看到他人会话消息，"
                f"实际返回 {len(msgs)} 条"
            )
        finally:
            sess_stranger.logout()

    # ── TC-OFF-06: after=0 参数校验 ───────────────────────────────

    def test_06_invalid_after_zero_returns_400(self, offline_msg_ctx):
        resp = offline_msg_ctx["sess_a"].get_missed(0)

        assert resp.status_code == 400, (
            f"TC-OFF-06 FAIL: after=0 期望 400，实际 {resp.status_code}"
        )
        body = resp.json()
        assert "error" in body, \
            f"TC-OFF-06 FAIL: 响应体应含 'error' 字段，实际={body}"
        assert "after" in body["error"] or "无效" in body["error"], (
            f"TC-OFF-06 FAIL: 错误信息不匹配，实际='{body['error']}'"
        )

    # ── TC-OFF-07: after 为负数同样返回 400 ───────────────────────

    def test_07_invalid_after_negative_returns_400(self, offline_msg_ctx):
        resp = offline_msg_ctx["sess_a"].get_missed(-1)

        assert resp.status_code == 400, (
            f"TC-OFF-07 FAIL: after=-1 期望 400，实际 {resp.status_code}"
        )

    # ── TC-OFF-08: 已撤回消息（deleted=1）不出现在结果中 ──────────

    def test_08_deleted_messages_excluded(self, offline_msg_ctx):
        ctx     = offline_msg_ctx
        conn    = sqlite3.connect(DB_PATH)
        # 将第一条消息标记为已删除
        target_id = ctx["msg_ids"][0]
        conn.execute("UPDATE messages SET deleted=1 WHERE id=?", (target_id,))
        conn.commit()
        conn.close()

        try:
            resp = ctx["sess_a"].get_missed(ctx["baseline_ts"])
            assert resp.status_code == 200
            msgs         = resp.json()
            returned_ids = {m["id"] for m in msgs}
            assert target_id not in returned_ids, (
                f"TC-OFF-08 FAIL: 已撤回消息 {target_id} 不应出现在 missed 结果中"
            )
            # 验证：返回 49 条（排除已删除的 1 条）
            assert len(msgs) == 49, (
                f"TC-OFF-08 FAIL: 删除 1 条后应返回 49 条，实际 {len(msgs)}"
            )
        finally:
            # 还原（不影响其他测试）
            conn = sqlite3.connect(DB_PATH)
            conn.execute("UPDATE messages SET deleted=0 WHERE id=?", (target_id,))
            conn.commit()
            conn.close()

    # ── TC-OFF-09: [BUG验证] 超 300 条时消息静默截断 ─────────────

    def test_09_bug_300_message_hard_limit_silent_truncation(self):
        """
        [BUG-MSG-03 验证] 当离线期间收到 >300 条消息时，
        missed API 只返回 300 条，其余消息静默丢失。
        服务端无 hasMore 字段提示，客户端无法感知。
        预期行为（BUG）: len(result) == 300，第 301 条丢失。
        修复后行为: 应返回 { messages: [...], hasMore: true, nextAfter: ts } 或错误提示。
        """
        user_recv = create_user("off_lim_r", 51)
        user_send = create_user("off_lim_s", 52)
        conv_id   = create_private_conv(user_recv["id"], user_send["id"])

        # 插入 301 条消息
        contents = [f"超量消息_{i}" for i in range(301)]
        _, base_ts = insert_messages(user_send["id"], conv_id, contents)

        sess = VxinSession().direct_auth(user_recv)
        try:
            resp = sess.get_missed(base_ts - 1)
            assert resp.status_code == 200
            msgs = resp.json()

            # ⚠ 此断言验证 BUG 存在：只返回 300 条
            assert len(msgs) == 300, (
                f"TC-OFF-09: 期望命中 300 上限（BUG），实际返回 {len(msgs)} 条\n"
                f"若返回 301 则 BUG 已修复，请更新此用例"
            )
            # 确认无 hasMore/nextCursor 等分页提示（BUG 的核心：静默截断）
            # missed API 返回纯 list，无任何分页元数据
            assert isinstance(msgs, list), \
                "TC-OFF-09: missed 返回纯 list，无分页元数据（BUG确认）"
        finally:
            sess.logout()

    # ── TC-OFF-10: HTTP 发消息后 missed 可正确拉取 ────────────────

    def test_10_http_sent_messages_appear_in_missed(self, offline_msg_ctx):
        """
        通过 HTTP API 发送消息（而非 WebSocket），
        验证消息已落库且能被 missed 拉取到。
        """
        ctx      = offline_msg_ctx
        before   = int(time.time()) - 1

        # B 通过 HTTP 发一条新消息
        send_resp = ctx["sess_b"].send_message(ctx["conv_id"], "HTTP路径测试消息")
        assert send_resp.status_code == 200, (
            f"TC-OFF-10 FAIL: HTTP 发消息失败 {send_resp.status_code}: {send_resp.text}"
        )

        # A 通过 missed 拉取
        resp = ctx["sess_a"].get_missed(before)
        assert resp.status_code == 200
        msgs     = resp.json()
        contents = [m["content"] for m in msgs]
        assert "HTTP路径测试消息" in contents, (
            f"TC-OFF-10 FAIL: HTTP 发送的消息未出现在 missed 结果中。"
            f"返回内容: {contents}"
        )
