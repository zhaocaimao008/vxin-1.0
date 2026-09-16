// 正序补齐断线期间的全部消息；同秒边界通过 afterId 继续推进。
export async function recoverMessages(fetchPage, after, onPage, signal) {
  const limit = 100;
  let afterId;
  while (!signal?.aborted) {
    const page = await fetchPage({ after, afterId, limit }, signal);
    if (signal?.aborted || !page.length) return;
    const last = page[page.length - 1];
    if (last.id === afterId) throw new Error('消息游标未推进，请重新加载会话');
    onPage(page);
    if (page.length < limit) return;
    after = last.created_at;
    afterId = last.id;
  }
}
