import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Bangkok",
  });
  const requested = [],
    errors = [];
  page.on("request", (r) => requested.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173/");
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(page.getByRole("heading", { name: "สวัสดี มิก" })).toBeVisible();
  assert.ok(
    !requested.some((url) =>
      /EntryForm-|ProgressPage-|SettingsPage-|heic.worker-/.test(url),
    ),
  );
  const initialRequests = [...requested].filter(
    (url) =>
      url.startsWith("http://127.0.0.1:4173/assets/") && url.endsWith(".js"),
  );
  await page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: /บันทึกอาหาร/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("ทดสอบรูป HEIC บน build จริง");
  assert.ok(!requested.some((url) => /heic.worker-/.test(url)));
  await dialog
    .getByLabel("แนบรูปอาหาร")
    .setInputFiles("tests/fixtures/example.heic");
  const preview = dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก");
  await expect(preview).toBeVisible({ timeout: 45000 });
  assert.ok(requested.some((url) => /heic.worker-/.test(url)));
  await dialog
    .getByRole("button", { name: "ตัดสี่เหลี่ยม", exact: true })
    .click();
  await expect
    .poll(() =>
      preview.evaluate((img) => img.naturalWidth === img.naturalHeight),
    )
    .toBe(true);
  await page.screenshot({ path: "artifacts/improved-photo-editor-390.png" });
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByAltText("รูปอาหาร ทดสอบรูป HEIC บน build จริง", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/production-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        passed: true,
        initialRequests,
        results: [
          "Real built lazy routes render without runtime errors",
          "Optional form/charts/settings/HEIC are absent from initial requests",
          "Production HEIC worker decodes, crops and saves a real HEIC fixture",
          "Mobile viewport has no horizontal overflow",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS: production build, lazy-loading and on-demand HEIC worker on a mobile viewport",
  );
} finally {
  await browser.close();
}
