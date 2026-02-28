import { cfg } from "../lib/config.js";
import { isXIntegrationEnabled } from "../services/xClient.js";

export default function register(bot) {
  bot.command("help", async (ctx) => {
    const xOn = isXIntegrationEnabled();
    const hasAdmins = Array.isArray(cfg.ADMIN_TELEGRAM_USER_IDS) && cfg.ADMIN_TELEGRAM_USER_IDS.length > 0;

    const lines = [
      "Commands:",
      "/start",
      "/help",
      "/status",
      "",
      "Admin commands:",
      "/addaccount <handleOrUrl>",
      "/removeaccount <handleOrUrl>",
      "/accounts",
      "/setdest (run inside the destination chat)",
      "/removedest (run inside the destination chat)",
      "/dests",
      "/setthreshold <number> (min 3000)",
      "/setkeywords include <a,b,c>",
      "/setkeywords exclude <a,b,c>",
      "",
      "Notes:",
      "1) You must set ADMIN_TELEGRAM_USER_IDS in env for admin commands to work.",
      "2) X integration must be configured to poll: COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY.",
      "",
      "Current env status:",
      "Admins configured: " + (hasAdmins ? "yes" : "no"),
      "X integration enabled: " + (xOn ? "yes" : "no"),
      "Polling interval (seconds): " + String(cfg.POLL_INTERVAL_SECONDS)
    ];

    if (!xOn) {
      lines.push("", "Troubleshooting:", "If X integration is disabled, the bot will not poll or repost. Set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY and redeploy.");
    }

    await ctx.reply(lines.join("\n"));
  });
}
