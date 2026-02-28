import { getDb } from "../lib/db.js";
import { safeErr } from "../lib/safeErr.js";
import { cfg } from "../lib/config.js";

const SETTINGS_KEY = "global";

export async function getSettings() {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) {
    return {
      thresholdViews: cfg.DEFAULT_THRESHOLD_VIEWS,
      includeKeywords: [],
      excludeKeywords: [],
      allowViewsUnknown: cfg.ALLOW_SEND_WITH_VIEWS_UNKNOWN_DEFAULT,
      updatedAt: null
    };
  }

  try {
    const doc = await db.collection("settings").findOne({ key: SETTINGS_KEY });
    return {
      thresholdViews: clampThreshold(doc?.thresholdViews),
      includeKeywords: normalizeKeywords(doc?.includeKeywords),
      excludeKeywords: normalizeKeywords(doc?.excludeKeywords),
      allowViewsUnknown: !!doc?.allowViewsUnknown,
      updatedAt: doc?.updatedAt || doc?.createdAt || null
    };
  } catch (e) {
    console.error("[db] settings findOne failed", { col: "settings", op: "findOne", err: safeErr(e) });
    return {
      thresholdViews: cfg.DEFAULT_THRESHOLD_VIEWS,
      includeKeywords: [],
      excludeKeywords: [],
      allowViewsUnknown: cfg.ALLOW_SEND_WITH_VIEWS_UNKNOWN_DEFAULT,
      updatedAt: null
    };
  }
}

export async function updateSettings(patch) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED" };

  const mutable = { ...patch };
  delete mutable._id;
  delete mutable.createdAt;
  delete mutable.key;

  if (mutable.thresholdViews !== undefined) mutable.thresholdViews = clampThreshold(mutable.thresholdViews);
  if (mutable.includeKeywords !== undefined) mutable.includeKeywords = normalizeKeywords(mutable.includeKeywords);
  if (mutable.excludeKeywords !== undefined) mutable.excludeKeywords = normalizeKeywords(mutable.excludeKeywords);

  try {
    await db.collection("settings").updateOne(
      { key: SETTINGS_KEY },
      {
        $setOnInsert: { key: SETTINGS_KEY, createdAt: new Date() },
        $set: { ...mutable, updatedAt: new Date() }
      },
      { upsert: true }
    );
    return { ok: true };
  } catch (e) {
    console.error("[db] settings updateOne failed", { col: "settings", op: "updateOne", err: safeErr(e) });
    return { ok: false, error: safeErr(e) };
  }
}

export async function addAccount(input) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED" };

  const handle = normalizeHandle(input);
  if (!handle) return { ok: false, error: "INVALID_HANDLE" };

  try {
    await db.collection("accounts").updateOne(
      { handle },
      {
        $setOnInsert: { handle, originalInput: String(input || ""), },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
    return { ok: true, handle };
  } catch (e) {
    console.error("[db] accounts updateOne failed", { col: "accounts", op: "updateOne", err: safeErr(e) });
    return { ok: false, error: safeErr(e) };
  }
}

export async function removeAccount(input) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED" };

  const handle = normalizeHandle(input);
  if (!handle) return { ok: false, error: "INVALID_HANDLE" };

  try {
    const r = await db.collection("accounts").deleteOne({ handle });
    await db.collection("last_seen").deleteOne({ handle });
    return { ok: true, handle, deleted: r?.deletedCount || 0 };
  } catch (e) {
    console.error("[db] accounts deleteOne failed", { col: "accounts", op: "deleteOne", err: safeErr(e) });
    return { ok: false, error: safeErr(e) };
  }
}

export async function listAccounts() {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED", accounts: [] };

  try {
    const accounts = await db.collection("accounts").find({}).sort({ }).toArray();
    return { ok: true, accounts: accounts.map((a) => ({ handle: a.handle, createdAt: a.createdAt })) };
  } catch (e) {
    console.error("[db] accounts find failed", { col: "accounts", op: "find", err: safeErr(e) });
    return { ok: false, error: safeErr(e), accounts: [] };
  }
}

export async function addDestination(chat) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED" };

  const chatId = String(chat?.id || "");
  if (!chatId) return { ok: false, error: "INVALID_CHAT" };

  const title = String(chat?.title || chat?.username || "").trim();
  const type = String(chat?.type || "");

  try {
    await db.collection("destinations").updateOne(
      { chatId },
      {
        $setOnInsert: { chatId, createdAt: new Date() },
        $set: { title, type, disabled: false, failureCount: 0, lastFailureAt: null, updatedAt: new Date() }
      },
      { upsert: true }
    );
    return { ok: true, chatId };
  } catch (e) {
    console.error("[db] destinations updateOne failed", { col: "destinations", op: "updateOne", err: safeErr(e) });
    return { ok: false, error: safeErr(e) };
  }
}

export async function removeDestination(chatId) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED" };

  try {
    const r = await db.collection("destinations").deleteOne({ chatId: String(chatId) });
    return { ok: true, deleted: r?.deletedCount || 0 };
  } catch (e) {
    console.error("[db] destinations deleteOne failed", { col: "destinations", op: "deleteOne", err: safeErr(e) });
    return { ok: false, error: safeErr(e) };
  }
}

export async function listDestinations() {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED", dests: [] };

  try {
    const dests = await db.collection("destinations").find({}).sort({ }).toArray();
    return {
      ok: true,
      dests: dests.map((d) => ({
        chatId: d.chatId,
        title: d.title,
        type: d.type,
        disabled: !!d.disabled,
        failureCount: d.failureCount || 0,
        lastFailureAt: d.lastFailureAt || null
      }))
    };
  } catch (e) {
    console.error("[db] destinations find failed", { col: "destinations", op: "find", err: safeErr(e) });
    return { ok: false, error: safeErr(e), dests: [] };
  }
}

export async function getEnabledDestinations() {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return [];

  try {
    const dests = await db.collection("destinations").find({ disabled: { $ne: true } }).toArray();
    return dests.map((d) => ({ chatId: d.chatId, title: d.title, type: d.type }));
  } catch (e) {
    console.error("[db] destinations find enabled failed", { col: "destinations", op: "find", err: safeErr(e) });
    return [];
  }
}

export async function recordDestinationFailure(chatId, reason) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return;

  try {
    const update = {
      $setOnInsert: { createdAt: new Date() },
      $set: { updatedAt: new Date(), lastFailureAt: new Date() },
      $inc: { failureCount: 1 }
    };
    await db.collection("destinations").updateOne({ chatId: String(chatId) }, update, { upsert: true });

    const doc = await db.collection("destinations").findOne({ chatId: String(chatId) }, { projection: { failureCount: 1 } });
    const fc = doc?.failureCount || 0;
    if (fc >= 5) {
      await db.collection("destinations").updateOne(
        { chatId: String(chatId) },
        { $set: { disabled: true, disabledReason: String(reason || "send_failed"), updatedAt: new Date() } }
      );
      console.warn("[destinations] auto-disabled due to failures", { chatId: String(chatId), failureCount: fc });
    }
  } catch (e) {
    console.error("[db] destinations record failure failed", { col: "destinations", op: "updateOne", err: safeErr(e) });
  }
}

export async function wasSent(destinationChatId, xPostId) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return false;

  try {
    const doc = await db.collection("sent_posts").findOne({ destinationChatId: String(destinationChatId), xPostId: String(xPostId) });
    return !!doc;
  } catch (e) {
    console.error("[db] sent_posts findOne failed", { col: "sent_posts", op: "findOne", err: safeErr(e) });
    return false;
  }
}

export async function markSent({ destinationChatId, xPostId, handle, url, views }) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { ok: false, error: "DB_NOT_CONFIGURED" };

  try {
    await db.collection("sent_posts").updateOne(
      { destinationChatId: String(destinationChatId), xPostId: String(xPostId) },
      {
        $setOnInsert: { },
        $set: {
          destinationChatId: String(destinationChatId),
          xPostId: String(xPostId),
          handle: String(handle || ""),
          url: String(url || ""),
          views: views === null || views === undefined ? null : Number(views),
          sentAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return { ok: true };
  } catch (e) {
    console.error("[db] sent_posts updateOne failed", { col: "sent_posts", op: "updateOne", err: safeErr(e) });
    return { ok: false, error: safeErr(e) };
  }
}

export async function getLastSeen(handle) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return { postId: "" };

  try {
    const doc = await db.collection("last_seen").findOne({ handle: String(handle) });
    return { postId: String(doc?.lastPostId || "") };
  } catch (e) {
    console.error("[db] last_seen findOne failed", { col: "last_seen", op: "findOne", err: safeErr(e) });
    return { postId: "" };
  }
}

export async function setLastSeen(handle, postId) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return;

  try {
    await db.collection("last_seen").updateOne(
      { handle: String(handle) },
      {
        $setOnInsert: { },
        $set: { handle: String(handle), lastPostId: String(postId || ""), updatedAt: new Date() }
      },
      { upsert: true }
    );
  } catch (e) {
    console.error("[db] last_seen updateOne failed", { col: "last_seen", op: "updateOne", err: safeErr(e) });
  }
}

export function normalizeHandle(handleOrUrl) {
  const s = String(handleOrUrl || "").trim();
  if (!s) return "";

  let h = s;
  try {
    if (s.includes("/")) {
      const u = new URL(s.startsWith("http") ? s : ("https://" + s));
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]) h = parts[0];
    }
  } catch {
    // ignore
  }

  h = h.replace(/^@+/, "");
  h = h.replace(/[^A-Za-z0-9_]/g, "");
  return h.toLowerCase();
}

function clampThreshold(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return cfg.DEFAULT_THRESHOLD_VIEWS;
  return Math.max(cfg.DEFAULT_THRESHOLD_VIEWS, n);
}

function normalizeKeywords(v) {
  const arr = Array.isArray(v) ? v : String(v || "").split(",");
  return arr
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);
}
