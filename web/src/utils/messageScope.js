// 会话 ID 在同群多账号间相同；服务器和账号必须共同参与本地存储键。
export function createMessageScope(userId, serverUrl) {
  if (!userId || !serverUrl) return null;
  const server = String(serverUrl).replace(/\/+$/, '');
  return { userId: String(userId), key: JSON.stringify([server, String(userId)]) };
}
