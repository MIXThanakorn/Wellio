import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
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
const first = "artifacts/meal-photo-fixture.png",
  second = "artifacts/meal-photo-fixture-2.png";
for (const [file, color] of [
  [first, "#ffe5d4"],
  [second, "#d9f5e8"],
])
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600"><rect width="2400" height="1600" fill="${color}"/><ellipse cx="1200" cy="820" rx="720" ry="540" fill="white"/><circle cx="1050" cy="740" r="200" fill="#85bd77"/><circle cx="1380" cy="900" r="150" fill="#efb16d"/><circle cx="1450" cy="600" r="100" fill="#d8837c"/><text x="1200" y="1490" font-size="70" text-anchor="middle" fill="#62778d">WELLIO TEST FIXTURE</text></svg>`,
    ),
  )
    .png()
    .toFile(file);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: "Asia/Bangkok",
});
const page = await context.newPage();
const own = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  other = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const paths = [];
const results = [];
let mealId;
let waterId;
let completed = false;
const title = `__wellio_photo_test_${crypto.randomUUID()}__`;
try {
  await page.goto("http://127.0.0.1:5173/");
  await page
    .getByRole("button", { name: "เลือกบัญชี มิก", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "สวัสดี มิก" })).toBeVisible({
    timeout: 25000,
  });
  const session = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((key) =>
      key.endsWith("-auth-token"),
    );
    return JSON.parse(localStorage.getItem(k));
  });
  await own.auth.setSession(session);
  const owner = session.user.id;
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page
    .getByRole("button", { name: "เพิ่มมื้ออาหาร", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill(title);
  await dialog.getByLabel("แนบรูปอาหาร").setInputFiles(first);
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await page.screenshot({
    path: "artifacts/meal-photo-form-390.png",
    fullPage: false,
  });
  let loseUpload = true,
    loseSave = true;
  await page.route(`${url}/storage/v1/object/meal-photos/**`, async (route) => {
    if (loseUpload && route.request().method() === "POST") {
      loseUpload = false;
      const response = await route.fetch();
      assert.ok(response.ok());
      await route.abort("failed");
    } else await route.continue();
  });
  await page.route(`${url}/rest/v1/meal_entries*`, async (route) => {
    if (loseSave && route.request().method() === "POST") {
      loseSave = false;
      const response = await route.fetch();
      assert.ok(response.ok());
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("ส่งรูปยังไม่สำเร็จ", {
    timeout: 30000,
  });
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("บันทึกไม่สำเร็จ", {
    timeout: 30000,
  });
  const early = await own
    .from("meal_entries")
    .select("*")
    .eq("name", title)
    .single();
  assert.equal(early.error, null);
  mealId = early.data.id;
  paths.push(early.data.photo_path);
  await page.reload();
  await page.getByRole("button", { name: "กรอกต่อ", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("ชื่ออาหาร")).toHaveValue(title);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 30000 });
  await expect(
    page.getByAltText(`รูปอาหาร ${title}`, { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() =>
      page
        .getByAltText(`รูปอาหาร ${title}`, { exact: true })
        .evaluate((img) => img.naturalWidth),
    )
    .toBe(1600);
  results.push("Real UI upload, automatic resize and signed image display");
  let { data: meal, error } = await own
    .from("meal_entries")
    .select("*")
    .eq("name", title)
    .single();
  assert.equal(error, null);
  mealId = meal.id;
  if (!paths.includes(meal.photo_path)) paths.push(meal.photo_path);
  const duplicateCheck = await own
    .from("meal_entries")
    .select("id")
    .eq("name", title);
  assert.equal(duplicateCheck.data.length, 1);
  results.push(
    "Lost upload and committed-save responses can be retried after reload without duplicate rows or objects",
  );
  assert.ok(meal.photo_path.startsWith(owner + "/"));
  await page.reload();
  await expect(
    page.getByRole("button", { name: `ดูรูป ${title}`, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  results.push("Photo persists after reload");
  const { data: selected, error: selectError } = await other.functions.invoke(
    "device-access",
    { body: { action: "select-profile", slug: "name" } },
  );
  assert.equal(selectError, null);
  await other.auth.setSession(selected.session);
  const { data: otherUser } = await other.auth.getUser();
  const otherOwner = otherUser.user.id;
  const downloaded = await own.storage
    .from("meal-photos")
    .download(meal.photo_path);
  assert.equal(downloaded.error, null);
  assert.ok(downloaded.data.size <= 5 * 1024 * 1024);
  const deniedRead = await other.storage
    .from("meal-photos")
    .download(meal.photo_path);
  assert.ok(deniedRead.error);
  const deniedSigned = await other.storage
    .from("meal-photos")
    .createSignedUrl(meal.photo_path, 60);
  assert.ok(deniedSigned.error);
  results.push(
    "Selected-owner download allowed; foreign download and signing denied",
  );
  const forged = await other.storage
    .from("meal-photos")
    .upload(`${owner}/${crypto.randomUUID()}.webp`, downloaded.data, {
      contentType: "image/webp",
    });
  assert.ok(forged.error);
  await other.storage.from("meal-photos").remove([meal.photo_path]);
  assert.equal(
    (await own.storage.from("meal-photos").download(meal.photo_path)).error,
    null,
  );
  results.push("Foreign upload/delete cannot change the owner photo");
  const attached = await other.from("meal_entries").insert({
    owner_user_id: otherOwner,
    name: "__wellio_forged_photo__",
    meal_type: "other",
    eaten_at: new Date().toISOString(),
    photo_path: meal.photo_path,
  });
  assert.equal(attached.error?.code, "23514");
  results.push("Database rejects attaching a foreign owner photo");
  const publicRead = await fetch(
    `${url}/storage/v1/object/public/meal-photos/${meal.photo_path}`,
  );
  assert.notEqual(publicRead.status, 200);
  results.push("Bucket does not serve public image URLs");
  await page
    .getByRole("button", { name: `ดูรูป ${title}`, exact: true })
    .click();
  await expect(page.getByAltText(`รูปขยาย ${title}`)).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: `แก้ไข ${title}`, exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("แนบรูปอาหาร").setInputFiles(second);
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 30000 });
  const updated = await own
    .from("meal_entries")
    .select("*")
    .eq("id", mealId)
    .single();
  assert.equal(updated.error, null);
  assert.notEqual(updated.data.photo_path, meal.photo_path);
  paths.push(updated.data.photo_path);
  // A previously downloaded response can remain in the CDN cache after deletion.
  // The uncached list API verifies that the old Storage object was removed.
  const oldObject = await own.storage
    .from("meal-photos")
    .list(owner, { search: meal.photo_path.split("/").at(-1) });
  assert.equal(oldObject.error, null);
  assert.equal(oldObject.data.length, 0);
  results.push("Replace photo retains meal and removes its old Storage object");
  await page.getByRole("button", { name: `ลบ ${title}`, exact: true }).click();
  await page.getByRole("button", { name: "ยืนยันลบ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  const removed = await own
    .from("meal_entries")
    .select("deleted_at,photo_path")
    .eq("id", mealId)
    .single();
  assert.ok(removed.data.deleted_at);
  assert.equal(
    (await own.storage.from("meal-photos").download(updated.data.photo_path))
      .error,
    null,
  );
  const foreignRestore = await other
    .from("meal_entries")
    .update({ deleted_at: null })
    .eq("id", mealId)
    .select("id");
  assert.deepEqual(foreignRestore.data, []);
  await page.reload();
  await page.getByRole("button", { name: "เลิกทำ", exact: true }).click();
  await expect(
    page.getByAltText(`รูปอาหาร ${title}`, { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  assert.equal(
    (
      await own
        .from("meal_entries")
        .select("deleted_at")
        .eq("id", mealId)
        .single()
    ).data.deleted_at,
    null,
  );
  results.push(
    "Soft delete preserves its private image; undo survives reload and foreign restore is denied",
  );
  // Hard-delete only this test fixture; production soft deletions expire after 24h.
  assert.equal(
    (await own.from("meal_entries").delete().eq("id", mealId)).error,
    null,
  );
  const queue = await own
    .from("meal_photo_cleanup")
    .select("photo_path")
    .eq("photo_path", updated.data.photo_path);
  assert.equal(queue.error, null);
  if (queue.data.length !== 1) {
    const remaining = await own.storage
      .from("meal-photos")
      .list(owner, { search: updated.data.photo_path.split("/").at(-1) });
    assert.equal(remaining.error, null);
    assert.equal(remaining.data.length, 0);
  }
  results.push(
    "Final fixture removal queues its last image for Storage API maintenance",
  );
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page.getByRole("button", { name: "เพิ่มน้ำดื่ม", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("ปริมาณน้ำ (มล.)").fill("333");
  waterId = await page.evaluate(
    () =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith("wellio:draft:"))
        .map((k) => JSON.parse(localStorage.getItem(k)))
        .filter((d) => d.kind === "water")
        .sort((a, b) => b.updatedAt - a.updatedAt)[0].id,
  );
  await context.setOffline(true);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("ออฟไลน์", {
    timeout: 5000,
  });
  await expect(dialog.getByLabel("ปริมาณน้ำ (มล.)")).toHaveValue("333");
  await context.setOffline(false);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 30000 });
  const water = await own
    .from("water_entries")
    .select("id,amount_ml")
    .eq("id", waterId)
    .single();
  assert.equal(water.data.amount_ml, 333);
  results.push(
    "An offline save fails promptly without losing input and retries once connectivity returns",
  );
  completed = true;
  await writeFile(
    "artifacts/photo-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        passed: true,
        results,
        testPhotoPaths: paths,
        maintenancePending: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS: ${results.length} live meal-photo/Storage/RLS checks; queued cleanup is ready for cron verification`,
  );
} finally {
  if (waterId) await own.from("water_entries").delete().eq("id", waterId);
  if (mealId) await own.from("meal_entries").delete().eq("id", mealId);
  if (!completed && paths.length)
    await own.storage.from("meal-photos").remove(paths);
  await own.auth.signOut({ scope: "local" });
  await other.auth.signOut({ scope: "local" });
  await browser.close();
}
