import { cfg } from "../lib/config.js";
import { safeErr } from "../lib/safeErr.js";
import { isXIntegrationEnabled, fetchRecentPostsByHandle } from "./xClient.js";
import {
  getSettings,
  listAccounts,
  getEnabledDestinations,
  wasSent,
  getLastSeen,
  setLastSeen
} from "./store.js";
import { matchesKeywordRules, trimExcerpt, formatTelegramPost } from "./format.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let _state = {
  running: false,
  lastPollAt: null,
  lastPollError: "",
  cycle: 0
};

export function getPollerState() {
  return { ..._state };
}

export function startPoller(bot) {
  if (_state.running) return;
  _state.running = true;

  const intervalMs = Math.max(10, cfg.POLL_INTERVAL_SECONDS) * 1000;
  console.log("[poller] starting", { intervalSeconds: cfg.POLL_INTERVAL_SECONDS, xEnabled: isXIntegrationEnabled() });

  (async () => {
    while (_state.running) {
      const start = Date.now();
      _state.cycle += 1;
      _state.lastPollAt = new Date();
      _state.lastPollError = "";

      const mem = process.memoryUsage();
      if (_state.cycle % 30 === 0) {
        console.log("[mem]", { rssMB: Math.round(mem.rss / 1e6), heapUsedMB: Math.round(mem.heapUsed / 1e6) });
      }

      try {
        if (!isXIntegrationEnabled()) {
          console.log("[poller] skipped (X disabled)");
        } else {
          await runCycle(bot);
        }
      } catch (e) {
        _state.lastPollError = safeErr(e);
        console.warn("[poller] cycle error", { err: safeErr(e) });
      }

      const elapsed = Date.now() - start;
      const wait = Math.max(1000, intervalMs - elapsed);
      await sleep(wait);
    }
  })();
}

export function stopPoller() {
  _state.running = false;
}

async function runCycle(bot) {
  const settings = await getSettings();
  const accountsRes = await listAccounts();
  const accounts = accountsRes?.accounts || [];
  const dests = await getEnabledDestinations();

  console.log("[poller] cycle", { accounts: accounts.length, destinations: dests.length, threshold: settings.thresholdViews });

  if (accounts.length === 0 || dests.length === 0) return;

  for (const a of accounts) {
    const handle = a?.handle;
    if (!handle) continue;

    const cursor = await getLastSeen(handle);

    let posts = [];
    try {
      posts = await fetchRecentPostsByHandle(handle, { maxResults: 8 });
    } catch (e) {
      console.warn("[poller] fetch posts failed", { handle, err: safeErr(e) });
      continue;
    }

    if (posts.length === 0) continue;

    const newestPostId = posts[0]?.postId || "";

    // Process from oldest to newest, stop when reaching last seen
    const ordered = posts.slice().reverse();
    for (const p of ordered) {
      if (cursor?.postId && p.postId === cursor.postId) continue;

      const kw = matchesKeywordRules(p.text, settings.includeKeywords, settings.excludeKeywords);
      if (!kw.ok) continue;

      const views = p.viewCount;
      if (views === null || views === undefined) {
        if (!settings.allowViewsUnknown) {
          console.log("[poller] views unavailable, skipped", { handle, postId: p.postId });
          continue;
        }
      } else {
        if (Number(views) < Number(settings.thresholdViews)) continue;
      }

      const excerpt = trimExcerpt(p.text, cfg.EXCERPT_MAX_CHARS);
      const msg = formatTelegramPost({
        authorName: p.author?.name || "",
        authorHandle: p.author?.username || handle,
        excerpt,
        views: views === null || views === undefined ? null : views,
        url: p.url
      });

      for (const d of dests) {
        const chatId = d.chatId;
        const already = await wasSent(chatId, p.postId);
        if (already) continue;

        await bot.api.sendChatAction(chatId, "typing").catch(() => {});

        try {
          await bot.api.sendMessage(chatId, msg, { disable_web_page_preview: false });
          // Persist sent record
          // (sender module does this too; here we do minimal path to avoid extra loops)
          // Use store.markSent pattern
          const { markSent } = await import("./store.js");
          await markSent({ destinationChatId: chatId, xPostId: p.postId, handle, url: p.url, views });
        } catch (e) {
          console.warn("[poller] send failed", { chatId, err: safeErr(e) });
          const { recordDestinationFailure } = await import("./store.js");
          await recordDestinationFailure(chatId, safeErr(e));
        }
      }
    }

    // cursor update: sync to newest, avoiding backlog replies on next boot
    if (newestPostId) await setLastSeen(handle, newestPostId);
  }
}
