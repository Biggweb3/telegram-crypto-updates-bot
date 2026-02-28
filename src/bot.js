import { Bot } from "grammy";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";
import { startPoller } from "./services/poller.js";

export function createBot(token) {
  const bot = new Bot(token);

  bot.catch((err) => {
    console.error("[bot] error", { err: safeErr(err) });
  });

  // No catch-all chat handler in this bot.
  // It is a reposting/polling bot driven by admin configuration.

  // Start poller once bot is created
  startPoller(bot);

  return bot;
}
