import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function registerCommands(bot) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".js") && f !== "loader.js" && !f.startsWith("_"));

  // Register commands in a stable order: start/help first, then admin.
  const order = ["start.js", "help.js", "admin.js"];
  files.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const handler = mod?.default || mod?.register;
    if (typeof handler === "function") {
      await handler(bot);
    } else {
      console.warn("[commands] skipped", { file });
    }
  }
}
