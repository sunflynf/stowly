import { expect, signIn, test } from "./fixtures";

test("lend an item, see it on the loans page, mark it back @mobile", async ({ page, user, db }) => {
  const { data: item } = await db.from("items").insert({ household_id: user.householdId, name: "Máy khoan Bosch" }).select("id").single();
  await signIn(page, user);

  await page.goto(`/items/${item!.id}`);
  const card = page.getByRole("region", { name: "Cho mượn / mượn" });
  await expect(card.getByText("Món này đang ở nhà.")).toBeVisible();
  await card.getByRole("button", { name: "Cho mượn" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Cho ai mượn").fill("Anh Hùng");
  // Already late, so the reminder shows straight away.
  await dialog.getByLabel("Hẹn trả ngày").fill(new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10));
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(card.getByText("Đang cho Anh Hùng mượn")).toBeVisible();
  await expect(card.getByText(/Quá hạn trả \d ngày/)).toBeVisible();

  await page.goto("/loans");
  await expect(page.getByRole("heading", { name: "Đang cho mượn (1)" })).toBeVisible();
  const row = page.locator("li", { hasText: "Máy khoan Bosch" });
  await row.getByRole("button", { name: "Đã trả lại" }).click();
  await expect(page.getByText("Đã ghi nhận món đồ về lại nhà.")).toBeVisible();
  await expect(page.getByText(/Không có món nào đang cho mượn/)).toBeVisible();

  await page.goto(`/items/${item!.id}`);
  // History: lent, then returned, each with the person.
  await expect(page.getByText("Đã trả lại · Anh Hùng")).toBeVisible();
  await expect(page.getByText("Cho mượn · Anh Hùng")).toBeVisible();
});
