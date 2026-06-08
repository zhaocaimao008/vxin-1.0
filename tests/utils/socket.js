const { io } = require('socket.io-client');
const cfg    = require('../config');

function connectSocket(cookie) {
  return new Promise((resolve, reject) => {
    const s = io(cfg.WS_URL, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
      reconnection: false,
      timeout: 8000,
    });
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 8000);
    s.on('connect', () => { clearTimeout(timer); resolve(s); });
    s.on('connect_error', e => { clearTimeout(timer); reject(e); });
  });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const handler = (data) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      socket.off(event, handler);
      resolve(data);
    };

    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    socket.on(event, handler);
  });
}

function sendMessage(socket, conversationId, content, type = 'text') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('send_message ack timeout')), 5000);
    socket.emit('send_message', { conversationId, content, type }, (ack) => {
      clearTimeout(t);
      if (ack?.success) resolve(ack.message);
      else reject(new Error(ack?.error || 'send failed'));
    });
  });
}

module.exports = { connectSocket, waitForEvent, sendMessage };
