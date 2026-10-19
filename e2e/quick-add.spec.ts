import path from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { expect, signIn, test } from "./fixtures";

// 1x1 JPEG.
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

test("quick add with photo, then use the stepper and see history @mobile", async ({ page, user }) => {
  const photo = path.join(tmpdir(), "stowly-e2e.jpg");
  writeFileSync(photo, JPEG);
  await signIn(page, user);

  await page.goto("/items/new");
  await page.locator("input[type=file]:not([capture])").setInputFiles(photo);
  await page.getByLabel("Tên món đồ").fill("Dây sạc USB-C 1m (trắng)");
  await page.getByRole("radio", { name: "Điện tử" }).click();
  await page.getByLabel("Tăng số lượng").click(); // 2
  await page.getByLabel("Báo khi còn ≤").fill("3");
  await page.getByLabel("Vị trí", { exact: true }).click();
  await page.getByRole("option", { name: "Bàn làm việc" }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();

  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Dây sạc USB-C 1m (trắng)" })).toBeVisible();
  await expect(page.getByText("Tồn kho thấp: còn 2, ngưỡng cảnh báo là 3")).toBeVisible();
  await expect(page.getByRole("img", { name: /Ảnh 1 của/ })).toBeVisible();
  await expect(page.getByText("Bàn làm việc")).toBeVisible();

  await page.getByRole("group", { name: /Số lượng của/ }).getByLabel("Giảm số lượng").click();
  await expect(page.getByRole("group", { name: /Số lượng của/ }).locator("output")).toHaveText("1");
  await expect(page.getByText("-1 → còn 1")).toBeVisible();
  await expect(page.getByText("Tạo mới với số lượng 2")).toBeVisible();
});
