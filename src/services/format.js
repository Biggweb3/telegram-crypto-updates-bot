export function trimExcerpt(text, maxChars = 280) {
  let t = String(text || "").trim();
  if (!t) return "";

  t = t.replace(/\s+/g, " ");

  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

export function matchesKeywordRules(text, includeKeywords, excludeKeywords) {
  const t = String(text || "").toLowerCase();

  const inc = Array.isArray(includeKeywords) ? includeKeywords : [];
  const exc = Array.isArray(excludeKeywords) ? excludeKeywords : [];

  if (inc.length > 0) {
    const ok = inc.some((k) => k && t.includes(String(k).toLowerCase()));
    if (!ok) return { ok: false, reason: "no_include_match" };
  }

  if (exc.length > 0) {
    const bad = exc.some((k) => k && t.includes(String(k).toLowerCase()));
    if (bad) return { ok: false, reason: "exclude_match" };
  }

  return { ok: true, reason: "ok" };
}

export function formatTelegramPost({ authorName, authorHandle, excerpt, views, url }) {
  const who = authorName ? (authorName + " (@" + authorHandle + ")") : ("@" + authorHandle);
  const viewsLine = views === null || views === undefined ? "Views: unknown" : ("Views: " + String(views));

  const lines = [
    who,
    "",
    excerpt || "(no text)",
    "",
    viewsLine,
    url
  ];

  return lines.join("\n").slice(0, 3500);
}
