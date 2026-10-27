import { test, expect, type Page } from "@playwright/test";
test("favorite removal requires confirmation and dialogs retain keyboard focus", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/meals");
  await page
    .getByRole("button", { name: "นำ ข้าวต้มปลา ออกจากอาหารโปรด", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ยกเลิก", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "นำ ข้าวต้มปลา ออกจากอาหารโปรด",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "นำ ข้าวต้มปลา ออกจากอาหารโปรด", exact: true })
    .click();
  await page.getByRole("button", { name: "ยืนยันนำออก", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "นำ ข้าวต้มปลา ออกจากอาหารโปรด",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "ลบบันทึกทั้งหมดของฉัน", exact: true })
    .click();
  const input = page.getByRole("dialog").getByRole("textbox");
  await input.pressSequentially("ลบข้อมูลของฉัน", { delay: 30 });
  await expect(input).toHaveValue("ลบข้อมูลของฉัน");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "ออกจากโหมดทดลอง", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ยินดีต้อนรับสู่ FitLog" }),
  ).toBeVisible();
});
async function demo(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "สำรวจแอปด้วยข้อมูลตัวอย่าง" })
    .click();
  await expect(page.getByRole("heading", { name: "สวัสดี มิก" })).toBeVisible();
}
test("meal CRUD persists across reload and updates dashboard", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "เพิ่มบันทึก", exact: true }).click();
  await page
    .getByRole("button", { name: "เพิ่มมื้ออาหาร", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออาหาร").fill("ทดสอบข้าวผัด");
  await dialog.getByLabel("มื้ออาหาร", { exact: true }).selectOption("snack");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ทดสอบข้าวผัด", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ทดสอบข้าวผัด", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "แก้ไข ทดสอบข้าวผัด", exact: true })
    .click();
  await page.getByLabel("ชื่ออาหาร").fill("แก้ไขข้าวผัด");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "บันทึก", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "แก้ไขข้าวผัด" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "ลบ แก้ไขข้าวผัด", exact: true })
    .click();
  await page.getByRole("button", { name: "ยืนยันลบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "แก้ไขข้าวผัด" })).toHaveCount(
    0,
  );
});
test("activity, water, check-in and CSV export", async ({ page }) => {
  await demo(page);
  for (const [label, value] of [
    ["กิจกรรม", "18"],
    ["น้ำดื่ม", "300"],
    ["น้ำหนัก", "69.2"],
  ] as const) {
    await page
      .getByRole("button", { name: "เพิ่มบันทึก", exact: true })
      .click();
    await page
      .getByRole("button", { name: `เพิ่ม${label}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    if (label === "น้ำหนัก") {
      await dialog.getByLabel("วันที่", { exact: true }).fill("2026-10-01");
    }
    await dialog.getByRole("spinbutton").fill(value);
    await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "ความคืบหน้าของคุณ" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/fitlog-.*\.csv/);
});
test("plans and quiet-hour preferences are editable", async ({ page }) => {
  await demo(page);
  await page.goto("/plans");
  await page.getByRole("button", { name: "เพิ่มแผน", exact: true }).click();
  await page.getByLabel("ชื่อแผน").fill("พักสายตาทดสอบ");
  await page.getByRole("button", { name: "บันทึกแผน", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "พักสายตาทดสอบ" }),
  ).toBeVisible();
  const card = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "พักสายตาทดสอบ" }) });
  await card.getByRole("button", { name: "ทำวันนี้แล้ว", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "วันนี้ทำแล้ว" }),
  ).toBeVisible();
  await page.goto("/reminders");
  await page.getByRole("switch").click();
  await page.getByLabel("เริ่ม", { exact: true }).fill("23:00");
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await page.reload();
  await expect(page.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("เริ่ม", { exact: true })).toHaveValue("23:00");
});
for (const width of [320, 375, 390, 768, 1440])
  test(`responsive pages at ${width}px have no overflow or runtime errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    await demo(page);
    for (const route of [
      "/",
      "/meals",
      "/calendar",
      "/progress",
      "/plans",
      "/reminders",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(
        page.getByText("เปิดหน้านี้ไม่สำเร็จ", { exact: true }),
      ).toHaveCount(0);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `overflow at ${route}`).toBe(false);
    }
    expect(errors).toEqual([]);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "สวัสดี มิก" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/dashboard-${width}.png`,
      fullPage: true,
    });
  });
test("unregistered device cannot enter a real profile", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ยินดีต้อนรับสู่ FitLog" }),
  ).toBeVisible();
  await page.goto("/meals");
  await expect(
    page.getByRole("heading", { name: "ยินดีต้อนรับสู่ FitLog" }),
  ).toBeVisible();
  await expect(page.getByText("Test meal", { exact: true })).toHaveCount(0);
});
