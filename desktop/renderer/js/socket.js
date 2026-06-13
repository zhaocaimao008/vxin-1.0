// Socket.io client wrapper
import { state, emit as stateEmit, addMessage, recallMessage, upsertConversation, incrementUnread, setTyping } from './state.js';

let socket = null;

export function connectSocket() {
  if (socket) socket.disconnect();

  socket = io(state.serverUrl, {
    auth: { token: state.token },
    transports: ['websocket'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
  });

  socket.on('connect', () => {
    console.log('[ws] connected');
    stateEmit('socket:connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[ws] disconnected', reason);
    stateEmit('socket:disconnected', reason);
  });

  socket.on('new_message', (msg) => {
    const convId = msg.conversationId;
    addMessage(convId, msg);
    incrementUnread(convId);

    // Update conversation preview
    upsertConversation({
      id: convId,
      lastMsg: msgPreview(msg),
      lastTime: msg.createdAt,
    });

    // Desktop notification when window not focused
    if (document.hidden && msg.senderId !== state.me?.id) {
      const sender = msg.senderNickname || msg.senderUsername || '消息';
      window.electron?.showNotification({ title: sender, body: msgPreview(msg) });
    }

    stateEmit('socket:message', msg);
  });

  socket.on('message_recalled', ({ messageId, conversationId }) => {
    recallMessage(conversationId, messageId);
    stateEmit('socket:recalled', { messageId, conversationId });
  });

  socket.on('message_edited', (msg) => {
    addMessage(msg.conversationId, msg);
    stateEmit('socket:edited', msg);
  });

  socket.on('message_reaction', (data) => {
    stateEmit('socket:reaction', data);
  });

  socket.on('message_read', (data) => {
    stateEmit('socket:read', data);
  });

  socket.on('typing', ({ userId, conversationId, isTyping }) => {
    setTyping(conversationId, userId, isTyping);
  });

  socket.on('user_online', (data) => stateEmit('socket:online', data));
  socket.on('user_offline', (data) => stateEmit('socket:offline', data));

  socket.on('group_updated', (data) => stateEmit('socket:group_updated', data));

  socket.on('pinned_message', ({ conversationId, message }) => {
    state.pinnedMessages[conversationId] = message;
    stateEmit('socket:pinned', { conversationId, message });
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function getSocket() { return socket; }

export function emitTyping(convId, isTyping) {
  socket?.emit('typing', { conversationId: convId, isTyping });
}

export function emitMarkRead(convId) {
  socket?.emit('mark_read', { conversationId: convId });
}

function msgPreview(msg) {
  if (msg.recalled) return '[已撤回]';
  switch (msg.type) {
    case 'image':   return '[图片]';
    case 'file':    return `[文件] ${msg.fileName || ''}`;
    case 'voice':   return '[语音]';
    case 'sticker': return '[贴纸]';
    case 'contact': return '[名片]';
    default: return msg.content || '';
  }
}
