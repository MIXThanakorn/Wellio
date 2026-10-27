import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
);
for (const name of (await readdir("supabase/migrations"))
  // Hosted-only scheduler migrations need pg_cron, pg_net and Vault; tested on Supabase.
  .filter(
    (n) =>
      n.endsWith("_fitlog_private_journal.sql") ||
      n.endsWith("_fitlog_device_ownership.sql"),
  )
  .sort())
  await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
await db.exec(await readFile("supabase/tests/rls_isolation.sql", "utf8"));
console.log(
  "PASS: migrations, all-table isolation, anonymous denial, cross-owner writes, plan FK ownership, protected profile enrollment and atomic deletion",
);
await db.close();
