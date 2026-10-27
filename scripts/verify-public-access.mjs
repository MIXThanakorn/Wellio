import { readFile, writeFile, mkdir } from "node:fs/promises";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).trim()];
    }),
);
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const checks = [];
for (const path of [
  "/rest/v1/profiles?select=user_id",
  "/rest/v1/meal_entries?select=id",
  "/rest/v1/reminder_deliveries?select=id",
]) {
  const response = await fetch(url + path, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(10000),
  });
  if (![401, 403].includes(response.status))
    throw new Error(
      `Unexpected anonymous status ${response.status} on ${path}`,
    );
  checks.push({
    check: `anonymous denied ${path.split("?")[0]}`,
    status: response.status,
    passed: true,
  });
}
for (const token of ["", `Bearer ${"x".repeat(48)}`]) {
  const response = await fetch(url + "/functions/v1/send-reminders", {
    method: "POST",
    headers: { Authorization: token },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 401)
    throw new Error(`Unexpected scheduler status: ${response.status}`);
  checks.push({
    check: token ? "invalid cron token denied" : "missing cron token denied",
    status: response.status,
    passed: true,
  });
}
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/public-access-verification.json",
  JSON.stringify(
    { checkedAt: new Date().toISOString(), project: "Wellio", checks },
    null,
    2,
  ) + "\n",
);
console.log(
  `PASS: ${checks.length} live public API / scheduler access-denial checks`,
);
