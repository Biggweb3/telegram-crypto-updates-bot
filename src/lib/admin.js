import { cfg } from "./config.js";

export function getAdminSet() {
  const ids = Array.isArray(cfg.ADMIN_TELEGRAM_USER_IDS) ? cfg.ADMIN_TELEGRAM_USER_IDS : [];
  return new Set(ids.map((s) => String(s)));
}

export function isAdmin(ctx) {
  const fromId = ctx?.from?.id;
  const adminSet = getAdminSet();
  if (!adminSet || adminSet.size === 0) return false;
  return adminSet.has(String(fromId));
}

export function adminGate(ctx) {
  const adminSet = getAdminSet();
  if (adminSet.size === 0) {
    return { ok: false, reason: "no_admins_configured" };
  }
  if (!isAdmin(ctx)) {
    return { ok: false, reason: "not_admin" };
  }
  return { ok: true, reason: "ok" };
}
