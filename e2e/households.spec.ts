import { randomUUID } from "node:crypto";
import { expect, test } from "./fixtures";

test("owner invites a viewer, who joins read-only and loses access when removed", async ({ page, browser, user, db }) => {
  await db.from("items").insert({ household_id: user.householdId, name: "Máy hút bụi Dyson", quantity: 1 });
  const email = `e2e-member-${randomUUID()}@stowly.test`;
  const password = `pw-${randomUUID()}`;
  const { data: created } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  const memberId = created.user!.id;

  try {
    // Owner: invite by email. Email is not configured locally, so the link is shown.
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Mật khẩu").fill(user.password);
    await page.locator("form").getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/settings");
    await page.getByLabel("Email người được mời").fill(email);
    await page.getByLabel("Vai trò", { exact: true }).selectOption("viewer");
    await page.getByRole("button", { name: "Gửi lời mời" }).click();
    const link = await page.getByLabel("Link lời mời").inputValue();
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByText("Lời mời đang chờ")).toBeVisible();

    // Member: open the link signed out, sign in with the prefilled email, accept.
    const memberContext = await browser.newContext({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
    const member = await memberContext.newPage();
    await member.goto(new URL(link).pathname);
    await expect(member.getByText(/mời bạn vào Nhà của/)).toBeVisible();
    await member.getByRole("link", { name: "Đăng nhập" }).click();
    await expect(member.getByLabel("Email")).toHaveValue(email);
    await member.getByLabel("Mật khẩu").fill(password);
    await member.locator("form").getByRole("button", { name: "Đăng nhập" }).click();
    await expect(member).toHaveURL(/\/invite\//);
    await member.getByRole("button", { name: "Tham gia" }).click();
    await expect(member).toHaveURL(/\/$/);

    // Read-only: sees the owner's items, no add or edit controls.
    await expect(member.getByText("Bạn chỉ có quyền xem trong nhà này.").first()).toBeVisible();
    await member.goto("/items");
    await member.getByRole("link", { name: /Máy hút bụi Dyson/ }).first().click();
    await expect(member.getByRole("heading", { name: "Máy hút bụi Dyson" })).toBeVisible();
    await expect(member.getByRole("link", { name: "Sửa" })).toHaveCount(0);
    await expect(member.getByRole("button", { name: "Tăng số lượng" })).toHaveCount(0);

    // Owner removes the member.
    await page.reload();
    await page.getByRole("button", { name: /Xóa .* khỏi nhà/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Xóa khỏi nhà" }).click();
    await expect(page.getByText("Đã xóa thành viên.")).toBeVisible();

    // The member is back in their own (empty) household.
    await member.goto("/items");
    await expect(member.getByRole("link", { name: /Máy hút bụi Dyson/ })).toHaveCount(0);
    await memberContext.close();
  } finally {
    await db.auth.admin.deleteUser(memberId);
  }
});
