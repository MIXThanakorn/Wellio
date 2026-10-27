import { test, expect } from "@playwright/test";
import path from "node:path";
const photoFile = path.resolve("public/icon-192.png"),
  replacementFile = path.resolve("public/icon-512.png");
test("demo meal photos survive reload, can be replaced and removed", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(page.getByRole("heading", { name: "สวัสดี มิก" })).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page
    .getByRole("button", { name: "เพิ่มมื้ออาหาร", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("มื้อทดสอบแนบรูป");
  await dialog.getByLabel("แนบรูปอาหาร").setInputFiles(photoFile);
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "ดูรูป มื้อทดสอบแนบรูป", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByAltText("รูปอาหาร มื้อทดสอบแนบรูป", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "ดูรูป มื้อทดสอบแนบรูป", exact: true })
    .click();
  await expect(page.getByAltText("รูปขยาย มื้อทดสอบแนบรูป")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "แก้ไข มื้อทดสอบแนบรูป", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("แนบรูปอาหาร").setInputFiles(replacementFile);
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("รูปอาหาร มื้อทดสอบแนบรูป", { exact: true })
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(512);
  await page
    .getByRole("button", { name: "แก้ไข มื้อทดสอบแนบรูป", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "นำรูปเดิมออก", exact: true })
    .click();
  await expect(
    dialog.getByText("รูปจะถูกนำออกเมื่อกดบันทึก", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "มื้อทดสอบแนบรูป" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ดูรูป มื้อทดสอบแนบรูป", exact: true }),
  ).toHaveCount(0);
});
test("invalid photo keeps the meal form recoverable", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page
    .getByRole("button", { name: "เพิ่มมื้ออาหาร", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("ข้อมูลยังอยู่");
  await dialog.getByLabel("แนบรูปอาหาร").setInputFiles({
    name: "invalid.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(dialog.getByRole("alert")).toContainText("JPG");
  await expect(dialog.getByLabel("ชื่ออาหาร")).toHaveValue("ข้อมูลยังอยู่");
  await dialog.getByLabel("แนบรูปอาหาร").setInputFiles(photoFile);
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
test("guide is available before choosing an account and search/FAQ work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "อ่านวิธีใช้ Wellio" }).click();
  await expect(
    page.getByRole("heading", { name: "ใช้ Wellio อย่างไรดี?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "เริ่มได้ใน 3 ขั้นตอน" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "ค้นหาวิธีใช้" }).fill("เปลี่ยนรูป");
  await expect(
    page.getByRole("heading", { name: "บันทึกอาหารพร้อมรูป" }),
  ).toBeVisible();
  await page
    .getByText("อยากเปลี่ยนรูปหรือเอารูปออก ต้องทำอย่างไร?", { exact: true })
    .click();
  await expect(page.locator("details[open] p")).toContainText("นำรูปเดิมออก");
  await page
    .getByRole("textbox", { name: "ค้นหาวิธีใช้" })
    .fill("ไม่มีหัวข้อนี้แน่นอนxyz");
  await expect(
    page.getByRole("heading", { name: "ยังไม่พบหัวข้อนี้" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ดูวิธีใช้ทั้งหมด" }).click();
  await expect(
    page.getByRole("heading", { name: "บันทึกอาหารพร้อมรูป" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "เลือกบัญชี", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "เลือกบัญชี มิก", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "วิธีใช้ Wellio แบบเข้าใจง่าย" })
    .click();
  await expect(
    page.getByRole("heading", { name: "ใช้ Wellio อย่างไรดี?" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "เปิดบันทึกอาหาร", exact: true })
    .click();
  await expect(page).toHaveURL(/\/meals$/);
});
for (const width of [320, 390, 768, 1440])
  test(`guide remains readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/guide");
    await expect(
      page.getByRole("heading", { name: "ใช้ Wellio อย่างไรดี?" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    if (width === 1440) {
      const tops = await page
        .locator(".guide-topic")
        .evaluateAll((cards) =>
          cards.slice(0, 2).map((card) => card.getBoundingClientRect().top),
        );
      expect(tops[0]).toBe(tops[1]);
    }
    await page.screenshot({
      path: `artifacts/guide-${width}.png`,
      fullPage: false,
    });
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("heading", { name: "คำถามที่พบบ่อย" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
