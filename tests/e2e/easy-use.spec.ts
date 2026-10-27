import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
async function demo(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(page.getByRole("heading", { name: "สวัสดี มิก" })).toBeVisible();
}
const data = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fitlog-demo-data-v1")!));

test("mobile home offers direct labelled actions and a camera entry", async ({
  page,
}) => {
  await demo(page);
  const actions = page.getByRole("region", { name: "บันทึกด่วน" });
  for (const name of [
    "บันทึกอาหาร",
    "บันทึกน้ำดื่ม",
    "บันทึกกิจกรรม",
    "บันทึกน้ำหนัก",
  ]) {
    await expect(
      actions.getByRole("button", { name: new RegExp(name) }),
    ).toBeInViewport();
  }
  await expect(page.locator(".current-account")).toContainText("มิก");
  await expect(
    page.getByRole("button", { name: "เปลี่ยนคนหรือออกจากบัญชี" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/easy-home-390.png" });
  await actions.getByRole("button", { name: /บันทึกอาหาร/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "เพิ่มมื้ออาหาร" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("วันและเวลา (เวลาไทย)")).not.toBeVisible();
  await expect(dialog.getByLabel("ถ่ายรูปอาหาร")).toHaveAttribute(
    "capture",
    "environment",
  );
  await dialog.getByLabel("ชื่ออาหาร").fill("อาหารจากกล้อง");
  await dialog
    .getByLabel("ถ่ายรูปอาหาร")
    .setInputFiles(path.resolve("public/icon-192.png"));
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "อาหารจากกล้อง" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByAltText("รูปอาหาร อาหารจากกล้อง", { exact: true }),
  ).toBeVisible();
});

test("water and activity presets save only after explicit confirmation", async ({
  page,
}) => {
  await demo(page);
  const before = await data(page);
  await page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: /บันทึกน้ำดื่ม/ })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "500 มล." }).click();
  expect((await data(page)).water.length).toBe(before.water.length);
  await expect(dialog.getByLabel("ปริมาณน้ำ (มล.)")).toHaveValue("500");
  await page.screenshot({ path: "artifacts/easy-water-390.png" });
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await data(page)).water.at(-1).amount_ml).toBe(500);
  await page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: /บันทึกกิจกรรม/ })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "20 นาที" }).click();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await data(page)).activities.at(-1).duration_minutes).toBe(20);
});

test("closing an unfinished form offers to keep typing or discard", async ({
  page,
}) => {
  await demo(page);
  const before = (await data(page)).meals.length;
  await page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: /บันทึกอาหาร/ })
    .click();
  await page.getByLabel("ชื่ออาหาร").fill("ยังไม่ได้บันทึกมื้อนี้");
  await page.keyboard.press("Escape");
  const warning = page.getByRole("dialog").last();
  await expect(
    warning.getByRole("heading", { name: "ยังไม่ได้บันทึก" }),
  ).toBeVisible();
  await warning.getByRole("button", { name: "กลับไปกรอกต่อ" }).click();
  await expect(page.getByLabel("ชื่ออาหาร")).toHaveValue(
    "ยังไม่ได้บันทึกมื้อนี้",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ยกเลิก", exact: true })
    .click();
  await page.getByRole("button", { name: "ปิดโดยไม่บันทึก" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await data(page)).meals.length).toBe(before);
});

test("optional details, labelled edit actions and return-to-today work", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: /บันทึกอาหาร/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("มื้อที่มีรายละเอียด");
  await dialog.locator("summary").click();
  const dateInput = dialog.getByLabel("วันและเวลา (เวลาไทย)");
  const originalDate = await dateInput.inputValue();
  await dateInput.fill("");
  await expect(
    dialog.getByText("วันที่บันทึก: กรุณาเลือกวันและเวลา"),
  ).toBeVisible();
  await dateInput.fill(originalDate);
  await dialog.getByLabel("ปริมาณ", { exact: false }).fill("1 จาน");
  await dialog
    .getByRole("textbox", { name: "บันทึกเพิ่มเติม" })
    .fill("อิ่มพอดี");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/meals");
  await page
    .getByRole("button", { name: "แก้ไข มื้อที่มีรายละเอียด", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("textbox", { name: "บันทึกเพิ่มเติม" }),
  ).toHaveValue("อิ่มพอดี");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ยกเลิก", exact: true })
    .click();
  await page.getByLabel("วันที่บันทึก").fill("2026-10-01");
  await page.getByRole("button", { name: "วันนี้", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "มื้อที่มีรายละเอียด" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "แก้ไข มื้อที่มีรายละเอียด",
      exact: true,
    }),
  ).toHaveText("แก้ไข");
  await page.getByLabel("ค้นหาบันทึก").fill("ไม่มีอาหารชื่อนี้แน่นอนxyz");
  await expect(
    page.getByRole("heading", { name: "ไม่พบบันทึกที่ค้นหา" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "วิธีใช้", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ใช้ Wellio อย่างไรดี?" }),
  ).toBeVisible();
});

test("demo photo is preserved in settings and removed only by confirmed clear", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("region", { name: "บันทึกด่วน" })
    .getByRole("button", { name: /บันทึกอาหาร/ })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("รูปรอการล้างทดลอง");
  await dialog
    .getByLabel("แนบรูปอาหาร")
    .setInputFiles(path.resolve("public/icon-192.png"));
  await expect(dialog.getByAltText("ตัวอย่างรูปอาหารก่อนบันทึก")).toBeVisible();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const countPhotos = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const request = indexedDB.open("wellio-demo-media", 1);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("photos", "readonly");
            const count = tx.objectStore("photos").count();
            tx.oncomplete = () => {
              db.close();
              resolve(count.result);
            };
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "บันทึกความชอบ" }),
  ).toBeDisabled();
  expect(await countPhotos()).toBe(1);
  await page.getByRole("button", { name: "ลบบันทึกทั้งหมดของฉัน" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("ลบข้อมูลของฉัน");
  await page.getByRole("button", { name: "ยืนยันลบถาวร" }).click();
  await expect(
    page.getByRole("heading", { name: "ยินดีต้อนรับสู่ Wellio" }),
  ).toBeVisible();
  expect(await countPhotos()).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("fitlog-demo-data-v1")),
  ).toBeNull();
});
