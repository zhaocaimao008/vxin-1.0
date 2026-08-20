'use strict';
/**
 * 本地截图/回归用的 mock 数据集，供 capture.js 使用。
 * NORMAL：正常示例数据。EDGE：边界值（超长文本/空态/缺字段），
 * 用于验证布局在极端真实数据下不塌。
 */

// 4x4 纯色 PNG data URI（9 种不同色，避免 MomentCard 图片 key={src} 撞车报重复 key 警告）
// —— moments 截图用的图片占位符，mediaUrl() 对 data: 直接原样返回，不用真起一个静态
// 资源服务器就能让图片九宫格真的渲染出来（而不是 onError 隐藏成空白）。
const MOCK_IMGS = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGOs2NLDAANMDEgANwcAVuABwMTE1cUAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPsWXCCAQaYGJAAbg4AYnAB/J47BFUAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGM8Ma2CAQaYGJAAbg4AXSAB3gl2wNoAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGNccGIBAwwwMSAB3BwAZpQCEGhI9OIAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPc0rOFAQaYGJAAbg4AYqwB/NWw7rAAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGPs2XKCAQaYGJAAbg4AZlgCEFHtJa8AAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGM8saWHAQaYGJAAbg4AZtACENu+P8AAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGNcsOAEAwwwMSAB3BwAZmwCEMO+4sMAAAAASUVORK5CYII=',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGM80bOAAQaYGJAAbg4AYtQB/OtQkSEAAAAASUVORK5CYII=',
];

const NORMAL = {
  // created_at：profile-page 改版新增"加入 v信"展示用，固定成 2023-03-15，跟设计稿示例值一致好对照
  me: { id: 1, username: '张小雅', wechat_id: 'xiaoya_2024', vxin_id: 'xiaoya_2024', avatar: '', bio: '设计是解决问题的艺术', phone: '138****0001', created_at: Math.floor(new Date('2023-03-15T00:00:00Z').getTime() / 1000) },
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
  // status 字段名对齐真实接口(contacts.service.js 返回 u.status)，
  // 用于验证首屏在线态播种(seedOnlineIds)——之前这里叫 online，
  // 前端谁都不读，播种逻辑在 mock 下测不出效果。
  contacts: [
    { id: 2, username: '张小雅', remark: '', wechat_id: 'xiaoya_2024', avatar: '', bio: '设计是解决问题的艺术', status: 'online' },
    { id: 3, username: '李明', remark: '', wechat_id: 'liming88', avatar: '', bio: '', status: 'offline' },
    { id: 4, username: '安然', remark: '', wechat_id: 'anran_', avatar: '', bio: '', status: 'offline' },
    { id: 5, username: '陈晨', remark: '', wechat_id: 'chenchen', avatar: '', bio: '', status: 'online' },
    { id: 6, username: '艾琳', remark: '', wechat_id: 'irene_w', avatar: '', bio: '', status: 'offline' },
  ],
  groupMembers: [
    { id: 1, username: '张小雅', role: 'owner', avatar: '' },
    { id: 3, username: '李明', role: 'admin', avatar: '' },
    { id: 4, username: '安然', role: 'member', avatar: '' },
    { id: 5, username: '陈晨', role: 'member', avatar: '' },
  ],
  // moments-page 改版：桌面动态页截图用，带图/纯文字各一条，覆盖赞/评论展示
  moments: [
    {
      id: 'm1', user_id: 2, author: { username: '张小雅', avatar: '' },
      content: '周末爬了梧桐山，山顶的风景真的太治愈了～生活不止眼前的忙碌，还有诗和远方',
      images: [MOCK_IMGS[0], MOCK_IMGS[1], MOCK_IMGS[2]], liked: true, likeCount: 56,
      likes: [{ user_id: 3, username: '李明' }, { user_id: 4, username: '安然' }],
      commentCount: 2,
      comments: [
        { id: 'c1', user_id: 3, username: '李明', content: '风景真不错！' },
        { id: 'c2', user_id: 1, username: '张小雅', content: '下次一起去呀', reply_to_username: '李明' },
      ],
      created_at: Math.floor(Date.now() / 1000) - 7200,
    },
    {
      id: 'm2', user_id: 3, author: { username: '李明', avatar: '' },
      content: '最近在学摄影，随手拍了一张晚霞，分享给大家',
      images: [MOCK_IMGS[3]], liked: false, likeCount: 32,
      likes: [{ user_id: 2, username: '张小雅' }],
      commentCount: 12, comments: [{ id: 'c3', user_id: 2, username: '张小雅', content: '拍得真好！' }],
      created_at: Math.floor(Date.now() / 1000) - 90000,
    },
  ],
  momentsEmpty: [],
};

// 边界值集合：超长昵称（中/英各一）、空态、缺失可选字段（avatar/bio 等 null/undefined）。
const EDGE = {
  // settings-page 改版：username 拉长测试账号信息卡片头像行的换行/截断，
  // phone 换成未打码的真实格式号码测试 maskPhone() 打码逻辑（NORMAL 数据集里那个
  // '138****0001' 本身已经带星号，测不出 maskPhone() 是否正确处理原始号码）。
  me: { id: 1, username: '张小雅的设计工作室日常账号超长昵称测试专用', wechat_id: 'xiaoya_2024', vxin_id: 'xiaoya_2024', avatar: null, bio: undefined, phone: '+8613800001234' },
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
    { id: 2, username: '张小雅的设计工作室日常沟通与项目进度同步专用联系人这是一个非常长的备注名字测试', remark: '', wechat_id: 'xiaoya_2024', avatar: null, bio: '这是一段特别特别特别特别特别特别特别特别长的个性签名文本用来测试布局', status: 'online' },
    // 超长英文昵称
    { id: 3, username: 'AVeryLongEnglishUsernameWithoutAnyNaturalBreakPointForOverflowTesting', remark: '', wechat_id: 'liming88', avatar: undefined, bio: undefined, status: undefined },
  ],
  contactsEmpty: [],
  groupMembersSingle: [
    { id: 1, username: '张小雅', role: 'owner', avatar: '' },
  ],
  // 超长正文（测试"查看全文"折叠）+ 9 张图（测试九宫格满格）+ 缺失点赞/评论字段
  moments: [
    {
      id: 'm1', user_id: 2,
      author: { username: '张小雅的设计工作室日常沟通与项目进度同步专用联系人这是一个非常长的备注名字测试', avatar: null },
      content: '这是一段特别特别特别特别特别特别特别特别特别特别特别特别特别特别特别特别特别特别长的动态正文用来测试超过限制后是否正确折叠成查看全文按钮ThisIsAVeryLongEnglishWordWithoutAnyNaturalBreakPointToTestOverflow',
      images: MOCK_IMGS,
      liked: false, likeCount: 0, likes: [], commentCount: 0, comments: undefined,
      created_at: Math.floor(Date.now() / 1000) - 300,
    },
  ],
  momentsEmpty: [],
};

module.exports = { NORMAL, EDGE };
