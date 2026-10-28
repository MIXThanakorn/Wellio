import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { dayKey, shiftDay, thaiDate } from "../../src/lib/dates";
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(page.getByRole("heading", { name: "สวัสดี มิก" })).toBeVisible();
}
const data = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fitlog-demo-data-v1")!));
const add = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: new RegExp(name) })
    .click();

test("draft text and photo survive reload and save once", async ({ page }) => {
  await demo(page);
  await add(page, "บันทึกอาหาร");
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("มื้อที่กรอกค้าง");
  await dialog
    .getByLabel("แนบรูปอาหาร")
    .setInputFiles(path.resolve("public/icon-192.png"));
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await expect(
    dialog.getByText("จำข้อมูลที่กรอกไว้บนอุปกรณ์นี้แล้ว", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await page
    .getByRole("button", { name: "เก็บไว้แล้วปิด", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "กรอกต่อ", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("ชื่ออาหาร")).toHaveValue("มื้อที่กรอกค้าง");
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await data(page)).meals.filter((r: any) => r.name === "มื้อที่กรอกค้าง"),
  ).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "กรอกต่อ", exact: true }),
  ).toHaveCount(0);
});
test("foreign-owner drafts do not appear in the selected account", async ({
  page,
}) => {
  await demo(page);
  await page.evaluate(() => {
    const key = "wellio:draft:foreign-owner:meal:foreign";
    localStorage.setItem(
      key,
      JSON.stringify({
        key,
        kind: "meal",
        id: "foreign",
        name: "ข้อมูลของอีกคน",
        when: "2026-10-01T10:00",
        updatedAt: Date.now(),
      }),
    );
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "กรอกต่อ", exact: true }),
  ).toHaveCount(0);
  await add(page, "บันทึกอาหาร");
  await expect(page.getByLabel("ชื่ออาหาร")).toHaveValue("");
});
test("repeat meal uses a new identity and the selected past date", async ({
  page,
}) => {
  await demo(page);
  const before = await data(page);
  const meal = before.meals[0];
  await page.goto("/meals");
  await page.getByLabel("ค้นหาทุกวัน").check();
  await page
    .getByRole("button", { name: `กินเหมือนเดิม ${meal.name}`, exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("ชื่ออาหาร")).toHaveValue(meal.name);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const after = await data(page);
  const repeated = after.meals.at(-1);
  expect(repeated.id).not.toBe(meal.id);
  expect(dayKey(repeated.eaten_at)).toBe(dayKey());
  expect(repeated.photo_path).toBeNull();
  const day = shiftDay(dayKey(), -1);
  await page.getByLabel("ค้นหาทุกวัน").uncheck();
  await page.getByLabel("วันที่บันทึก", { exact: true }).fill(day);
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page
    .getByRole("button", { name: "เพิ่มมื้ออาหาร", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  expect(
    (await dialog.getByLabel("วันและเวลา (เวลาไทย)").inputValue()).slice(0, 10),
  ).toBe(day);
  await dialog.getByLabel("ชื่ออาหาร").fill("ย้อนหลังตรงวันที่ดู");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ย้อนหลังตรงวันที่ดู" }),
  ).toBeVisible();
  expect(dayKey((await data(page)).meals.at(-1).eaten_at)).toBe(day);
});
test("calendar empty-day add preserves its chosen date", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await page.goto("/calendar");
  const day = shiftDay(dayKey(), -20);
  await page
    .getByRole("button", {
      name: thaiDate(`${day}T12:00:00+07:00`),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "เพิ่มบันทึกแรก", exact: true })
    .click();
  await page.getByRole("button", { name: "เพิ่มน้ำดื่ม", exact: true }).click();
  const dialog = page.getByRole("dialog");
  expect(
    (await dialog.getByLabel("วันและเวลา (เวลาไทย)").inputValue()).slice(0, 10),
  ).toBe(day);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(dayKey((await data(page)).water.at(-1).consumed_at)).toBe(day);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "เพิ่มบันทึก", exact: true })
    .click();
  await page
    .getByRole("button", { name: "เพิ่มมื้ออาหาร", exact: true })
    .click();
  expect(
    (
      await page
        .getByRole("dialog")
        .getByLabel("วันและเวลา (เวลาไทย)")
        .inputValue()
    ).slice(0, 10),
  ).toBe(day);
});
test("delete and reload can undo a meal with its photo intact", async ({
  page,
}) => {
  await demo(page);
  await add(page, "บันทึกอาหาร");
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("มื้อที่กู้คืนพร้อมรูป");
  await dialog
    .getByLabel("แนบรูปอาหาร")
    .setInputFiles(path.resolve("public/icon-192.png"));
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "ลบ มื้อที่กู้คืนพร้อมรูป", exact: true })
    .click();
  await page.getByRole("button", { name: "ยืนยันลบ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "มื้อที่กู้คืนพร้อมรูป" }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "เลิกทำ", exact: true }).click();
  await expect(
    page.getByAltText("รูปอาหาร มื้อที่กู้คืนพร้อมรูป", { exact: true }),
  ).toBeVisible();
  expect(
    (await data(page)).meals.find(
      (r: any) => r.name === "มื้อที่กู้คืนพร้อมรูป",
    ).deleted_at,
  ).toBeNull();
});
test("HEIC converts locally and supports rotation, crop and reset", async ({
  page,
}) => {
  await demo(page);
  await add(page, "บันทึกอาหาร");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("มื้อรูป HEIC");
  await dialog
    .getByLabel("แนบรูปอาหาร")
    .setInputFiles(path.resolve("tests/fixtures/example.heic"));
  const preview = dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก");
  await expect(preview).toBeVisible({ timeout: 45000 });
  const size = () =>
    preview.evaluate((img: HTMLImageElement) => [
      img.naturalWidth,
      img.naturalHeight,
    ]);
  const [w, h] = await size();
  expect(w).not.toBe(h);
  await dialog.getByRole("button", { name: "หมุนขวา", exact: true }).click();
  await expect.poll(size).toEqual([h, w]);
  await dialog
    .getByRole("button", { name: "ตัดสี่เหลี่ยม", exact: true })
    .click();
  await expect.poll(size).toEqual([Math.min(w, h), Math.min(w, h)]);
  await dialog.getByRole("button", { name: "คืนรูปเดิม", exact: true }).click();
  await expect.poll(size).toEqual([w, h]);
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByAltText("รูปอาหาร มื้อรูป HEIC", { exact: true }),
  ).toBeVisible();
});
