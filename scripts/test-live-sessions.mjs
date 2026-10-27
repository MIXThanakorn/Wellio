import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).trim()];
    }),
);
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const base = "http://127.0.0.1:5173/";
const accounts = [
  { slug: "mix", name: "มิก", user_id: "" },
  { slug: "name", name: "เนม", user_id: "" },
];
const browser = await chromium.launch({ headless: true });
const clients = [],
  inserted = [],
  results = [];
async function sessionFrom(page) {
  return page.evaluate(() => {
    const storageKey = Object.keys(localStorage).find((k) =>
      k.endsWith("-auth-token"),
    );
    return storageKey ? JSON.parse(localStorage.getItem(storageKey)) : null;
  });
}
try {
  for (const account of accounts) {
    const context = await browser.newContext({ timezoneId: "Asia/Bangkok" });
    const page = await context.newPage();
    await page.goto(base);
    await expect(
      page.getByRole("button", {
        name: `เลือกบัญชี ${account.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `เลือกบัญชี ${account.name}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `สวัสดี ${account.name}` }),
    ).toBeVisible({ timeout: 25000 });
    assert.equal(page.url(), base);
    assert.equal(await page.locator("input[type=email]").count(), 0);
    const stored = await sessionFrom(page);
    assert.ok(stored?.access_token);
    account.user_id = stored.user.id;
    const state = await context.storageState();
    await context.close();
    const reopened = await browser.newContext({
      storageState: state,
      timezoneId: "Asia/Bangkok",
    });
    const restored = await reopened.newPage();
    await restored.goto(base);
    await expect(
      restored.getByRole("heading", { name: `สวัสดี ${account.name}` }),
    ).toBeVisible();
    assert.equal(
      await restored
        .getByRole("button", {
          name: `เลือกบัญชี ${account.name}`,
          exact: true,
        })
        .count(),
      0,
    );
    results.push(
      `${account.slug}: common URL, name-only selection, browser restart and session restoration`,
    );
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    assert.equal(error, null);
    clients.push({ client, account, page: restored });
  }
  assert.notEqual(accounts[0].user_id, accounts[1].user_id);
  for (const { client, account } of clients) {
    const { data, error } = await client
      .from("profiles")
      .select("user_id,slug");
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.equal(data[0].slug, account.slug);
    const { data: row, error: insertError } = await client
      .from("meal_entries")
      .insert({
        owner_user_id: account.user_id,
        name: `__wellio_session_test_${crypto.randomUUID()}__`,
        meal_type: "other",
        eaten_at: new Date().toISOString(),
      })
      .select()
      .single();
    assert.equal(insertError, null);
    inserted.push({ client, row });
    results.push(
      `${account.slug}: fixed account mapping and own journal write`,
    );
  }
  for (let i = 0; i < clients.length; i++) {
    const { client, page, account } = clients[i];
    const own = inserted[i].row,
      other = inserted[1 - i].row;
    const { data, error } = await client
      .from("meal_entries")
      .select("id")
      .eq("id", other.id);
    assert.equal(error, null);
    assert.deepEqual(data, []);
    const { data: updated, error: updateError } = await client
      .from("meal_entries")
      .update({ name: "forged" })
      .eq("id", other.id)
      .select("id");
    assert.equal(updateError, null);
    assert.deepEqual(updated, []);
    const { error: forged } = await client
      .from("meal_entries")
      .insert({
        owner_user_id: other.owner_user_id,
        name: "forged",
        meal_type: "other",
        eaten_at: new Date().toISOString(),
      });
    assert.equal(forged?.code, "42501");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: own.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: other.name, exact: true }),
    ).toHaveCount(0);
    results.push(`${account.slug}: selected-session RLS and persisted journal`);
    await page
      .getByRole("button", { name: "เปลี่ยนคนหรือออกจากบัญชี", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "เลือกบัญชี มิก", exact: true }),
    ).toBeVisible();
    assert.equal(await sessionFrom(page), null);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "เลือกบัญชี เนม", exact: true }),
    ).toBeVisible();
    results.push(
      `${account.slug}: logout clears session, reload stays on chooser`,
    );
    const peer = accounts[1 - i];
    await page
      .getByRole("button", { name: `เลือกบัญชี ${peer.name}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `สวัสดี ${peer.name}` }),
    ).toBeVisible({ timeout: 20000 });
    assert.equal((await sessionFrom(page)).user.id, peer.user_id);
    await expect(
      page.getByRole("heading", { name: own.name, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: other.name, exact: true }),
    ).toBeVisible();
    results.push(
      `${account.slug}: same-link account switch uses the other account without stale cache`,
    );
    await page
      .getByRole("button", { name: "เปลี่ยนคนหรือออกจากบัญชี", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "เลือกบัญชี มิก", exact: true }),
    ).toBeVisible();
  }
  for (const body of [
    { action: "select-profile", slug: "admin" },
    { action: "select-profile", owner_user_id: accounts[0].user_id },
    null,
  ]) {
    const response = await fetch(url + "/functions/v1/device-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
    results.push("Invalid account selection is rejected");
  }
  const adminAttempt = await fetch(url + "/functions/v1/device-access", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ action: "bootstrap" }),
  });
  assert.equal(adminAttempt.status, 401);
  results.push("Public selection does not grant administrative account access");
  await writeFile(
    "artifacts/session-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        accessModel:
          "one URL; anyone with the URL may select either profile, as approved by the owner",
        passed: true,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS: ${results.length} live profile-selection/session/logout/RLS checks`,
  );
} finally {
  for (const { client, row } of inserted) {
    const { error } = await client
      .from("meal_entries")
      .delete()
      .eq("id", row.id)
      .eq("owner_user_id", row.owner_user_id);
    if (error) console.error("Test fixture cleanup failed:", row.id);
  }
  for (const { client } of clients)
    await client.auth.signOut({ scope: "local" });
  await browser.close();
}
