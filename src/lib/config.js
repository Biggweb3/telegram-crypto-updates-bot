export function safeInt(v, fallback) {
  const n = Number.parseInt(String(v || ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseAdminIds(input) {
  const raw = String(input || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => String(Number.parseInt(s, 10)))
    .filter((s) => s && s !== "NaN");
}

const poll = safeInt(process.env.POLL_INTERVAL_SECONDS, 120);

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MONGODB_URI: process.env.MONGODB_URI || "",

  COOKMYBOTS_X_ENDPOINT: process.env.COOKMYBOTS_X_ENDPOINT || "",
  COOKMYBOTS_X_KEY: process.env.COOKMYBOTS_X_KEY || "",

  ADMIN_TELEGRAM_USER_IDS_RAW: process.env.ADMIN_TELEGRAM_USER_IDS || "",
  ADMIN_TELEGRAM_USER_IDS: parseAdminIds(process.env.ADMIN_TELEGRAM_USER_IDS),

  POLL_INTERVAL_SECONDS: Number.isFinite(poll) && poll > 0 ? poll : 120,

  DEFAULT_THRESHOLD_VIEWS: 3000,
  EXCERPT_MAX_CHARS: 280,

  ALLOW_SEND_WITH_VIEWS_UNKNOWN_DEFAULT: false
};
