import webpush from "web-push";
import { randomBytes } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
// One-time bootstrap. Output is ignored by git and must never be served by Vite.
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const values = {
  fitlog_vapid_public: publicKey,
  fitlog_vapid_private: privateKey,
  fitlog_cron_secret: randomBytes(48).toString("base64url"),
  fitlog_project_url: "https://alpbutepoqnbvbbnesit.supabase.co",
};
const sql = Object.entries(values)
  .map(([name, value]) => `select vault.create_secret('${value}','${name}');`)
  .join("\n");
await writeFile(".push-bootstrap.local", sql + "\n", { flag: "wx" });
const env = await readFile(".env.local", "utf8");
if (!env.includes("VITE_VAPID_PUBLIC_KEY="))
  await writeFile(
    ".env.local",
    env.trimEnd() + `\nVITE_VAPID_PUBLIC_KEY=${publicKey}\n`,
  );
console.log(
  "Created ignored .push-bootstrap.local and appended the public VAPID key to .env.local. Apply the SQL to Vault once, then remove the local bootstrap file.",
);
