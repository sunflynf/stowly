import { randomUUID } from "node:crypto";
import { expect, signIn, test } from "./fixtures";

test("sign up, land on the Vietnamese dashboard, switch to English, sign out", async ({ page, db }) => {
  const email = `e2e-signup-${randomUUID()}@stowly.test`;
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Tạo tài khoản mới" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("short");
  await page.locator("form").getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByText("Mật khẩu cần ít nhất 8 ký tự.")).toBeVisible();

  await page.getByLabel("Mật khẩu").fill("long-enough-password");
  await page.locator("form").getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  // Seeded bilingual categories show up in the quick filters / sidebar.
  await expect(page.getByRole("link", { name: "Tất cả đồ dùng" })).toBeVisible();

  await page.getByRole("button", { name: "English" }).first().click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // The choice is stored in the profile, so it survives a new session.
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, { id: "", email, password: "long-enough-password" });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const created = data.users.find((u) => u.email === email);
  if (created) await db.auth.admin.deleteUser(created.id);
});
