import { safeErr } from "../lib/safeErr.js";
import { cfg } from "../lib/config.js";

function trimSlash(u) {
  u = String(u || "");
  while (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

function xEnabled() {
  return !!(cfg.COOKMYBOTS_X_ENDPOINT && cfg.COOKMYBOTS_X_KEY);
}

export function isXIntegrationEnabled() {
  return xEnabled();
}

async function xProxy({ path, method = "GET", query, body, headers }) {
  if (!xEnabled()) {
    const e = new Error("X_NOT_CONFIGURED");
    e.code = "X_NOT_CONFIGURED";
    throw e;
  }

  const base = trimSlash(cfg.COOKMYBOTS_X_ENDPOINT);
  const url = base + "/proxy";

  console.log("[x] call start", { method, path });

  const started = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + String(cfg.COOKMYBOTS_X_KEY),
        "Content-Type": "application/json",
        ...(headers || {})
      },
      body: JSON.stringify({ path, method, query: query || undefined, body: body || undefined, headers: headers || undefined })
    });

    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!r.ok) {
      const msg = json?.error || json?.message || text || "X_PROXY_ERROR";
      console.warn("[x] call fail", { method, path, status: r.status, ms: Date.now() - started, err: String(msg).slice(0, 200) });
      const err = new Error(String(msg));
      err.status = r.status;
      err.response = { data: json };
      throw err;
    }

    console.log("[x] call ok", { method, path, status: r.status, ms: Date.now() - started });
    return json;
  } catch (e) {
    console.warn("[x] call exception", { method, path, err: safeErr(e) });
    throw e;
  }
}

function pick(obj, path, fallback) {
  try {
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return fallback;
      cur = cur[p];
    }
    return cur === undefined ? fallback : cur;
  } catch {
    return fallback;
  }
}

export async function fetchRecentPostsByHandle(handle, { maxResults = 8 } = {}) {
  const h = String(handle || "").trim().replace(/^@+/, "");
  if (!h) return [];

  const user = await xProxy({
    method: "GET",
    path: "/2/users/by/username/" + encodeURIComponent(h),
    query: { "user.fields": "name,username" }
  });

  const userId = pick(user, "data.id", "");
  const name = pick(user, "data.name", "");
  const username = pick(user, "data.username", h);
  if (!userId) return [];

  const tweets = await xProxy({
    method: "GET",
    path: "/2/users/" + encodeURIComponent(userId) + "/tweets",
    query: {
      max_results: String(Math.max(5, Math.min(Number(maxResults) || 8, 25))),
      "tweet.fields": "created_at,public_metrics,organic_metrics"
    }
  });

  const items = Array.isArray(tweets?.data) ? tweets.data : [];

  return items.map((t) => {
    const id = String(t?.id || "");
    const text = String(t?.text || "");
    const createdAt = t?.created_at ? new Date(t.created_at) : null;

    const views =
      (t?.organic_metrics && Number(t.organic_metrics.impression_count)) ||
      (t?.public_metrics && Number(t.public_metrics.impression_count)) ||
      null;

    return {
      postId: id,
      url: id ? ("https://x.com/" + encodeURIComponent(username) + "/status/" + encodeURIComponent(id)) : "",
      text,
      createdAt,
      viewCount: Number.isFinite(views) ? views : null,
      author: { name, username: String(username || h) }
    };
  }).filter((p) => p.postId);
}
