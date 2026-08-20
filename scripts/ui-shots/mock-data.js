'use strict';
/**
 * 本地截图/回归用的 mock 数据集，供 capture.js 使用。
 * NORMAL：正常示例数据。EDGE：边界值（超长文本/空态/缺字段），
 * 用于验证布局在极端真实数据下不塌。
 */

const NORMAL = {
  me: { id: 1, username: '张小雅', wechat_id: 'xiaoya_2024', vxin_id: 'xiaoya_2024', avatar: '', bio: '设计是解决问题的艺术', phone: '138****0001' },
  conversations: [
    { id: 1, type: 'private', name: '张小雅', avatar: '', lastMessage: '好的，稍后我把资料发给你~', lastMessageType: 'text', lastTime: Math.floor(Date.now() / 1000) - 300, unreadCount: 0, pinned: true, muted: false, otherUserId: 2 },
    { id: 2, type: 'group', name: '产品设计组', avatar: '', lastMessage: '李明: 新版的设计稿已更新', lastMessageType: 'text', lastTime: Math.floor(Date.now() / 1000) - 1200, unreadCount: 3, pinned: false, muted: false, memberCount: 8 },
    { id: 3, type: 'private', name: '李明', avatar: '', lastMessage: '最近在忙什么呢?', lastMessageType: 'text', lastTime: Math.floor(Date.now() / 1000) - 5000, unreadCount: 1, pinned: false, muted: false, otherUserId: 3 },
    { id: 4, type: 'private', name: '安然', avatar: '', lastMessage: '[图片]', lastMessageType: 'image', lastTime: Math.floor(Date.now() / 1000) - 90000, unreadCount: 0, pinned: false, muted: true, otherUserId: 4 },
  ],
  messages: [
    { id: 101, conversation_id: 1, sender_id: 1, type: 'text', content: '小雅，项目的设计稿发我一份吧~', created_at: Math.floor(Date.now() / 1000) - 700, read: true },
    { id: 102, conversation_id: 1, sender_id: 2, type: 'text', content: '好的，正在整理中，稍后发你。', created_at: Math.floor(Date.now() / 1000) - 650, read: true },
    { id: 103, conversation_id: 1, sender_id: 2, type: 'text', content: '好的，稍后我把资料发给你~', created_at: Math.floor(Date.now() / 1000) - 300, read: true },
  ],
  contacts: [
    { id: 2, username: '张小雅', remark: '', wechat_id: 'xiaoya_2024', avatar: '', bio: '设计是解决问题的艺术', online: true },
    { id: 3, username: '李明', remark: '', wechat_id: 'liming88', avatar: '', bio: '', online: false },
    { id: 4, username: '安然', remark: '', wechat_id: 'anran_', avatar: '', bio: '', online: false },
    { id: 5, username: '陈晨', remark: '', wechat_id: 'chenchen', avatar: '', bio: '', online: true },
    { id: 6, username: '艾琳', remark: '', wechat_id: 'irene_w', avatar: '', bio: '', online: false },
  ],
  groupMembers: [
    { id: 1, username: '张小雅', role: 'owner', avatar: '' },
    { id: 3, username: '李明', role: 'admin', avatar: '' },
    { id: 4, username: '安然', role: 'member', avatar: '' },
    { id: 5, username: '陈晨', role: 'member', avatar: '' },
  ],
};

// 边界值集合：超长昵称（中/英各一）、空态、缺失可选字段（avatar/bio 等 null/undefined）。
const EDGE = {
  me: { id: 1, username: '张小雅', wechat_id: 'xiaoya_2024', vxin_id: 'xiaoya_2024', avatar: null, bio: undefined, phone: '138****0001' },
  conversations: [
    // 超长中文昵称（40+ 字符）
    { id: 1, type: 'private', name: '张小雅的设计工作室日常沟通与项目进度同步专用会话窗口这是一个非常长的名字测试', avatar: '', lastMessage: '这是一条特别特别特别特别特别特别特别特别特别特别长的消息预览文本用来测试是否会把布局撑开或者被正确截断显示省略号', lastMessageType: 'text', lastTime: Math.floor(Date.now() / 1000) - 300, unreadCount: 999, pinned: true, muted: false, otherUserId: 2 },
    // 超长英文群名（40+ 字符，无自然断行点）
    { id: 2, type: 'group', name: 'ProductDesignTeamDailySyncAndAnnouncementChannelForEveryone', avatar: '', lastMessage: '李明: update', lastMessageType: 'text', lastTime: Math.floor(Date.now() / 1000) - 1200, unreadCount: 3, pinned: false, muted: false, memberCount: 1 },
    // 缺失可选字段
    { id: 3, type: 'private', name: '李明', avatar: undefined, lastMessage: null, lastMessageType: 'text', lastTime: Math.floor(Date.now() / 1000) - 5000, unreadCount: 0, pinned: false, muted: false, otherUserId: 3 },
  ],
  conversationsEmpty: [],
  messages: [
    { id: 101, conversation_id: 1, sender_id: 1, type: 'text', content: '正常长度的消息', created_at: Math.floor(Date.now() / 1000) - 700, read: true },
    { id: 102, conversation_id: 1, sender_id: 2, type: 'text', content: '这是一条用来测试超长文本换行与容器是否会被撑开的消息内容这是一条用来测试超长文本换行与容器是否会被撑开的消息内容这是一条用来测试超长文本换行与容器是否会被撑开的消息内容ThisIsAVeryLongEnglishWordWithoutAnyNaturalBreakPointToTestOverflow', created_at: Math.floor(Date.now() / 1000) - 295, read: true },
    // 连续同向消息（同一 sender_id、间隔 <300s）：验证 consecutive 行样式下
    // 气泡内时间戳/已读标记不会跟相邻气泡挤压重叠。
    { id: 103, conversation_id: 1, sender_id: 2, type: 'text', content: '连续消息一', created_at: Math.floor(Date.now() / 1000) - 290, read: true },
    { id: 104, conversation_id: 1, sender_id: 2, type: 'text', content: '连续消息二', created_at: Math.floor(Date.now() / 1000) - 285, read: true },
    { id: 105, conversation_id: 1, sender_id: 2, type: 'text', content: '连续消息三', created_at: Math.floor(Date.now() / 1000) - 280, read: true },
  ],
  contacts: [
    // 超长中文昵称
    { id: 2, username: '张小雅的设计工作室日常沟通与项目进度同步专用联系人这是一个非常长的备注名字测试', remark: '', wechat_id: 'xiaoya_2024', avatar: null, bio: '这是一段特别特别特别特别特别特别特别特别长的个性签名文本用来测试布局', online: true },
    // 超长英文昵称
    { id: 3, username: 'AVeryLongEnglishUsernameWithoutAnyNaturalBreakPointForOverflowTesting', remark: '', wechat_id: 'liming88', avatar: undefined, bio: undefined, online: false },
  ],
  contactsEmpty: [],
  groupMembersSingle: [
    { id: 1, username: '张小雅', role: 'owner', avatar: '' },
  ],
};

module.exports = { NORMAL, EDGE };
