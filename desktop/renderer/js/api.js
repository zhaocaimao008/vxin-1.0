// HTTP API client — thin wrapper around axios
import { state } from './state.js';

export const api = {
  async request(method, path, data, opts = {}) {
    const base = state.serverUrl.replace(/\/$/, '');
    const url = base + path;
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const cfg = { method, url, headers, ...opts };
    if (data) {
      if (method === 'GET') cfg.params = data;
      else cfg.data = data;
    }
    try {
      const res = await axios(cfg);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '请求失败';
      throw new Error(msg);
    }
  },

  get:    (path, params, opts) => api.request('GET',    path, params, opts),
  post:   (path, body,   opts) => api.request('POST',   path, body,   opts),
  put:    (path, body,   opts) => api.request('PUT',    path, body,   opts),
  delete: (path, body,   opts) => api.request('DELETE', path, body,   opts),

  // Auth
  login:    (username, password) => api.post('/api/auth/login', { username, password }),
  register: (username, nickname, password) => api.post('/api/auth/register', { username, nickname, password }),
  me:       () => api.get('/api/auth/me'),

  // Conversations
  conversations: () => api.get('/api/messages/conversations'),
  messages:      (convId, params) => api.get(`/api/messages/conversation/${convId}`, params),
  sendText:      (toUserId, content, replyTo) => api.post('/api/messages', { toUserId, content, type: 'text', replyToMessageId: replyTo }),
  sendFile:      (body) => api.post('/api/messages', body),
  recall:        (msgId) => api.delete(`/api/messages/${msgId}`),
  editMessage:   (msgId, content) => api.put(`/api/messages/${msgId}`, { content }),
  react:         (msgId, emoji) => api.post(`/api/messages/${msgId}/reactions`, { emoji }),
  pin:           (convId, msgId) => api.post(`/api/conversations/${convId}/pin`, { messageId: msgId }),
  unpin:         (convId) => api.delete(`/api/conversations/${convId}/pin`),
  markRead:      (convId) => api.post(`/api/messages/conversation/${convId}/read`),
  search:        (keyword) => api.get('/api/messages/search', { keyword }),

  // Users / contacts
  users:         (params) => api.get('/api/users', params),
  userById:      (id) => api.get(`/api/users/${id}`),
  contacts:      () => api.get('/api/contacts'),
  addContact:    (userId) => api.post('/api/contacts', { userId }),
  deleteContact: (userId) => api.delete(`/api/contacts/${userId}`),
  updateProfile: (data) => api.put('/api/users/profile', data),

  // Groups
  groups:         () => api.get('/api/groups'),
  createGroup:    (name, memberIds) => api.post('/api/groups', { name, memberIds }),
  groupMembers:   (gid) => api.get(`/api/groups/${gid}/members`),
  groupInfo:      (gid) => api.get(`/api/groups/${gid}`),
  addGroupMember: (gid, userId) => api.post(`/api/groups/${gid}/members`, { userId }),
  kickMember:     (gid, userId) => api.delete(`/api/groups/${gid}/members/${userId}`),
  leaveGroup:     (gid) => api.post(`/api/groups/${gid}/leave`),
  renameGroup:    (gid, name) => api.put(`/api/groups/${gid}`, { name }),

  // Moments
  moments:       () => api.get('/api/moments'),
  postMoment:    (content, images) => api.post('/api/moments', { content, images }),
  likeMoment:    (mid) => api.post(`/api/moments/${mid}/like`),
  commentMoment: (mid, content) => api.post(`/api/moments/${mid}/comments`, { content }),

  // Files — get R2 presigned URL then upload directly
  async uploadFile(file, onProgress) {
    // 1. Get presigned URL from backend
    const ext = file.name.split('.').pop().toLowerCase();
    const type = file.type || 'application/octet-stream';
    const { uploadUrl, fileUrl, key } = await api.post('/api/upload/presign', {
      filename: file.name, contentType: type, ext
    });
    // 2. Upload to R2
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': type },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round(e.loaded / e.total * 100));
      },
    });
    return { fileUrl, key, name: file.name, size: file.size, type };
  },

  // Stickers
  stickers: () => api.get('/api/stickers'),
  addSticker: (url, name) => api.post('/api/stickers', { url, name }),
};
