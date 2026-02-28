import { safeErr } from "../lib/safeErr.js";
import { recordDestinationFailure, markSent } from "./store.js";

export async function sendToDestinations(bot, dests, post, messageText) {
  const results = [];

  for (const d of dests) {
    const chatId = d?.chatId;
    if (!chatId) continue;

    try {
      const msg = await bot.api.sendMessage(chatId, messageText, { disable_web_page_preview: false });
      results.push({ chatId, ok: true, messageId: msg?.message_id || null });

      await markSent({
        destinationChatId: chatId,
        xPostId: post.postId,
        handle: post.author?.username,
        url: post.url,
        views: post.viewCount
      });
    } catch (e) {
      console.warn("[send] failed", { chatId, err: safeErr(e) });
      results.push({ chatId, ok: false, error: safeErr(e) });
      await recordDestinationFailure(chatId, safeErr(e));
    }
  }

  return results;
}
