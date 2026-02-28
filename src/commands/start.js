import { cfg } from "../lib/config.js";
import { isXIntegrationEnabled } from "../services/xClient.js";

export default function register(bot) {
  bot.command("start", async (ctx) => {
    const xOn = isXIntegrationEnabled();
    const hasAdmins = Array.isArray(cfg.ADMIN_TELEGRAM_USER_IDS) && cfg.ADMIN_TELEGRAM_USER_IDS.length > 0;

    const lines = [
      "This bot monitors selected X accounts and reposts posts to Telegram when they reach the view threshold.",
      "",
      "Default rule: only forward when views are at least 3000.",
      "",
      "Admin setup:",
      "Use /setdest in the chat you want to receive updates.",
      "Then /addaccount <handleOrUrl> to start monitoring.",
      "",
      "Status:",
      "X integration enabled: " + (xOn ? "yes" : "no"),
      "Admins configured: " + (hasAdmins ? "yes" : "no")
    ];

    await ctx.reply(lines.join("\n"));
  });
}
