import { adminGate } from "../lib/admin.js";
import { cfg } from "../lib/config.js";
import { safeErr } from "../lib/safeErr.js";
import {
  addAccount,
  removeAccount,
  listAccounts,
  addDestination,
  removeDestination,
  listDestinations,
  getSettings,
  updateSettings,
  normalizeHandle
} from "../services/store.js";
import { getPollerState } from "../services/poller.js";
import { isXIntegrationEnabled } from "../services/xClient.js";

function denyText(reason) {
  if (reason === "no_admins_configured") {
    return "No admins configured. Set ADMIN_TELEGRAM_USER_IDS (comma-separated Telegram user IDs) and redeploy.";
  }
  return "You are not allowed to use admin commands.";
}

function parseArgText(ctx) {
  const t = String(ctx?.message?.text || "");
  const parts = t.split(/\s+/);
  parts.shift();
  return parts.join(" ").trim();
}

export default function register(bot) {
  bot.command("addaccount", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const arg = parseArgText(ctx);
    const h = normalizeHandle(arg);
    if (!h) return ctx.reply("Usage: /addaccount <handleOrUrl>");

    const r = await addAccount(arg);
    if (!r.ok) return ctx.reply("Failed to add account: " + String(r.error || "error"));
    return ctx.reply("Added account: @" + r.handle);
  });

  bot.command("removeaccount", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const arg = parseArgText(ctx);
    const h = normalizeHandle(arg);
    if (!h) return ctx.reply("Usage: /removeaccount <handleOrUrl>");

    const r = await removeAccount(arg);
    if (!r.ok) return ctx.reply("Failed to remove account: " + String(r.error || "error"));
    return ctx.reply("Removed account: @" + h);
  });

  bot.command("accounts", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const r = await listAccounts();
    if (!r.ok) return ctx.reply("Failed to list accounts: " + String(r.error || "error"));
    if (r.accounts.length === 0) return ctx.reply("No accounts configured.");

    const lines = ["Accounts:", ...r.accounts.map((a) => "@" + a.handle)];
    return ctx.reply(lines.join("\n"));
  });

  bot.command("setdest", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const r = await addDestination(ctx.chat);
    if (!r.ok) return ctx.reply("Failed to set destination: " + String(r.error || "error"));
    return ctx.reply("This chat is now a destination for updates.");
  });

  bot.command("removedest", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const chatId = String(ctx?.chat?.id || "");
    if (!chatId) return ctx.reply("Could not read this chat id.");

    const r = await removeDestination(chatId);
    if (!r.ok) return ctx.reply("Failed to remove destination: " + String(r.error || "error"));
    return ctx.reply("This chat was removed from destinations.");
  });

  bot.command("dests", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const r = await listDestinations();
    if (!r.ok) return ctx.reply("Failed to list destinations: " + String(r.error || "error"));
    if (r.dests.length === 0) return ctx.reply("No destinations configured.");

    const lines = ["Destinations:"];
    for (const d of r.dests) {
      const label = (d.title ? d.title + " " : "") + "(" + d.chatId + ")";
      const extra = d.disabled ? " disabled" : "";
      lines.push(label + extra);
    }
    return ctx.reply(lines.join("\n"));
  });

  bot.command("setthreshold", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const arg = parseArgText(ctx);
    const n = Number.parseInt(String(arg || ""), 10);
    if (!Number.isFinite(n)) return ctx.reply("Usage: /setthreshold <number>");

    const v = Math.max(3000, n);
    const r = await updateSettings({ thresholdViews: v });
    if (!r.ok) return ctx.reply("Failed to update threshold: " + String(r.error || "error"));
    return ctx.reply("Threshold set to " + String(v) + " views.");
  });

  bot.command("setkeywords", async (ctx) => {
    const g = adminGate(ctx);
    if (!g.ok) return ctx.reply(denyText(g.reason));

    const t = String(ctx?.message?.text || "");
    const parts = t.split(/\s+/);
    const mode = String(parts[1] || "").toLowerCase();
    const rest = parts.slice(2).join(" ").trim();

    if (mode !== "include" && mode !== "exclude") {
      return ctx.reply("Usage: /setkeywords include <a,b,c> or /setkeywords exclude <a,b,c>");
    }

    const arr = rest
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const patch = mode === "include" ? { includeKeywords: arr } : { excludeKeywords: arr };
    const r = await updateSettings(patch);
    if (!r.ok) return ctx.reply("Failed to update keywords: " + String(r.error || "error"));

    return ctx.reply(mode + " keywords set to: " + (arr.length ? arr.join(", ") : "(none)"));
  });

  bot.command("status", async (ctx) => {
    try {
      const settings = await getSettings();
      const accounts = await listAccounts();
      const dests = await listDestinations();
      const poll = getPollerState();

      const lines = [
        "Bot status:",
        "X integration enabled: " + (isXIntegrationEnabled() ? "yes" : "no"),
        "Polling interval (seconds): " + String(cfg.POLL_INTERVAL_SECONDS),
        "Threshold: " + String(settings.thresholdViews),
        "Accounts: " + String(accounts?.accounts?.length || 0),
        "Destinations: " + String(dests?.dests?.length || 0),
        "Last poll time: " + (poll.lastPollAt ? new Date(poll.lastPollAt).toISOString() : "never"),
        poll.lastPollError ? ("Last poll error: " + poll.lastPollError) : ""
      ].filter(Boolean);

      return ctx.reply(lines.join("\n"));
    } catch (e) {
      return ctx.reply("Status error: " + safeErr(e));
    }
  });
}
