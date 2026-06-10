"""
conftest.py — pytest 全局 Fixtures
- session_scope fixtures 负责 Setup/Teardown
- 每个测试模块通过 request.param 或直接引用所需 fixture
"""
import time
import pytest
import urllib3

# 压制本地测试的 SSL 未验证警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from helpers.db_helper import (
    TEST_PREFIX, create_user, create_private_conv, create_group_conv,
    set_no_add_friend, insert_messages, cleanup_test_data,
)
from helpers.api_client import VxinSession


# ── 全局 Teardown ─────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def global_cleanup():
    """整个测试 session 结束后统一清理，无论成功/失败。"""
    yield
    cleanup_test_data()


# ── 离线消息场景 Fixtures ─────────────────────────────────────────

@pytest.fixture(scope="module")
def offline_msg_ctx():
    """
    Setup:
      - user_a: 离线用户（接收方）
      - user_b: 在线发送方
      - private_conv: 两者的私聊会话
      - 直接向 DB 插入 50 条消息（模拟 A 离线期间 B 发送）
      - baseline_ts: 插入前的时间戳（用于 missed?after= 参数）
    """
    user_a = create_user("off_a", 1)
    user_b = create_user("off_b", 2)
    conv_id = create_private_conv(user_a["id"], user_b["id"])

    # baseline_ts 是第一条消息的 created_at - 1，保证 after=baseline_ts 能拉到全部消息
    contents = [f"离线消息第{i+1:02d}条" for i in range(50)]
    msg_ids, first_ts = insert_messages(user_b["id"], conv_id, contents)
    baseline_ts = first_ts - 1

    # 为用户 A 创建 Session（此时 A "刚上线"）——直签 Token 绕过登录限流
    sess_a = VxinSession().direct_auth(user_a)
    sess_b = VxinSession().direct_auth(user_b)

    yield {
        "user_a": user_a,
        "user_b": user_b,
        "conv_id": conv_id,
        "msg_ids": msg_ids,          # 50 条消息的 ID 列表（按插入顺序）
        "baseline_ts": baseline_ts,  # after= 参数
        "first_ts": first_ts,        # 第一条消息的 created_at
        "sess_a": sess_a,
        "sess_b": sess_b,
    }
    sess_a.logout()
    sess_b.logout()


# ── 禁止互加好友场景 Fixtures ─────────────────────────────────────

@pytest.fixture(scope="module")
def no_add_friend_ctx():
    """
    Setup:
      - owner:  群主 A
      - admin:  管理员 B
      - member_c, member_d: 普通成员
      - outsider: 不在群内的第三方用户
      - group_conv: no_add_friend=1 的群
    """
    owner   = create_user("grp_own", 10)
    admin   = create_user("grp_adm", 11)
    mc      = create_user("grp_mc",  12)
    md      = create_user("grp_md",  13)
    out     = create_user("grp_out", 14)

    conv_id = create_group_conv(
        owner["id"],
        f"{TEST_PREFIX}_禁加好友测试群",
        members=[
            (admin["id"], "admin"),
            (mc["id"],    "member"),
            (md["id"],    "member"),
        ],
    )
    set_no_add_friend(conv_id, 1)

    # 为每个角色建立独立 Session（直签 Token，绕过登录限流）
    sess_owner   = VxinSession().direct_auth(owner)
    sess_admin   = VxinSession().direct_auth(admin)
    sess_mc      = VxinSession().direct_auth(mc)
    sess_md      = VxinSession().direct_auth(md)
    sess_outside = VxinSession().direct_auth(out)

    yield {
        "owner":        owner,
        "admin":        admin,
        "member_c":     mc,
        "member_d":     md,
        "outsider":     out,
        "conv_id":      conv_id,
        "sess_owner":   sess_owner,
        "sess_admin":   sess_admin,
        "sess_mc":      sess_mc,
        "sess_md":      sess_md,
        "sess_outside": sess_outside,
    }
    for s in [sess_owner, sess_admin, sess_mc, sess_md, sess_outside]:
        s.logout()
