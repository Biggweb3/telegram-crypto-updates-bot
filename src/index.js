import "dotenv/config";

import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";

process.on("unhandledRejection", (r) => {
  console.error("UnhandledRejection:", safeErr(r));
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error("UncaughtException:", safeErr(e));
  process.exit(1);
});

async function boot() {
  console.log("[boot] starting", {
    telegramTokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
    mongoUriSet: !!cfg.MONGODB_URI,
    cookmybotsXEndpointSet: !!cfg.COOKMYBOTS_X_ENDPOINT,
    cookmybotsXKeySet: !!cfg.COOKMYBOTS_X_KEY,
    adminTelegramUserIdsSet: !!cfg.ADMIN_TELEGRAM_USER_IDS_RAW
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Add it to your env and redeploy.");
    process.exit(1);
  }

  try {
    const { createBot } = await import("./bot.js");
    const { registerCommands } = await import("./commands/loader.js");

    const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);

    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
    } catch (e) {
      console.warn("[boot] deleteWebhook failed", { err: safeErr(e) });
    }

    try {
      await bot.init();
    } catch (e) {
      console.warn("[boot] bot.init failed", { err: safeErr(e) });
    }

    await registerCommands(bot);

    try {
      await bot.api.setMyCommands([
        { command: "start", description: "What this bot does" },
        { command: "help", description: "Commands and troubleshooting" },
        { command: "status", description: "Show bot status" },
        { command: "accounts", description: "List monitored X accounts (admin)" },
        { command: "addaccount", description: "Add monitored X account (admin)" },
        { command: "removeaccount", description: "Remove monitored X account (admin)" },
        { command: "setdest", description: "Set this chat as a destination (admin)" },
        { command: "removedest", description: "Remove this chat from destinations (admin)" },
        { command: "dests", description: "List destinations (admin)" },
        { command: "setthreshold", description: "Set min views (admin)" },
        { command: "setkeywords", description: "Set include/exclude keywords (admin)" }
      ]);
    } catch (e) {
      console.warn("[boot] setMyCommands failed", { err: safeErr(e) });
    }

    await startPollingWithRetry(bot);
  } catch (e) {
    console.error("[boot] failed", { err: safeErr(e) });
    process.exit(1);
  }
}

let _polling = false;
async function startPollingWithRetry(bot) {
  if (_polling) return;
  _polling = true;

  let backoff = 2000;
  while (true) {
    try {
      console.log("[polling] start");
      await bot.start();
      console.log("[polling] ended");
      backoff = 2000;
    } catch (e) {
      const msg = safeErr(e);
      console.warn("[polling] failed", { err: msg });

      // 409 Conflict is common during deploy overlap. Backoff and retry.
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(20000, Math.round(backoff * 1.7));
      continue;
    }
  }
}

boot();
