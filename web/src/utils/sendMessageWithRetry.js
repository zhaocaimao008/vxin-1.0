// Retry only an explicit temporary rate limit, keeping the same idempotency key.
// The caller's pending entry owns the lifetime (timeout, account/conversation change).
export function sendMessageWithRetry(socket, payload, onAck, isPending) {
  let retries = 0;
  const send = () => {
    if (!isPending()) return;
    socket.emit('send_message', payload, ack => {
      if (!isPending()) return;
      if (!ack?.success && ack?.code === 'RATE_LIMITED' && retries < 3) {
        retries++;
        const delay = Math.min(1100, Math.max(100, Number(ack.retryAfterMs) || 1000));
        setTimeout(() => {
          if (!isPending()) return;
          if (socket.connected) send();
          else onAck({ success: false, error: '连接已断开' });
        }, delay);
      } else onAck(ack);
    });
  };
  send();
}
