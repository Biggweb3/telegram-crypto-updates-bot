import { MongoClient } from "mongodb";
import { safeErr } from "./safeErr.js";

let _client = null;
let _db = null;
let _connecting = null;

export async function getDb(mongoUri) {
  if (!mongoUri) return null;
  if (_db) return _db;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    try {
      _client = new MongoClient(mongoUri, { maxPoolSize: 5, ignoreUndefined: true });
      await _client.connect();
      _db = _client.db();
      console.log("[db] connected", { mongoConfigured: true });

      try {
        await ensureIndexes(_db);
      } catch (e) {
        console.error("[db] ensureIndexes failed", { err: safeErr(e) });
      }

      return _db;
    } catch (e) {
      console.error("[db] connect failed", { err: safeErr(e) });
      _client = null;
      _db = null;
      return null;
    } finally {
      _connecting = null;
    }
  })();

  return _connecting;
}

async function ensureIndexes(db) {
  await db.collection("accounts").createIndex({ handle: 1 }, { unique: true });
  await db.collection("destinations").createIndex({ chatId: 1 }, { unique: true });
  await db.collection("sent_posts").createIndex({ destinationChatId: 1, xPostId: 1 }, { unique: true });
  await db.collection("last_seen").createIndex({ handle: 1 }, { unique: true });
  await db.collection("settings").createIndex({ key: 1 }, { unique: true });
}
