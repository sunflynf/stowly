import { expect, signIn, test } from "./fixtures";

test("delete goes to the trash: undo, restore, delete forever @mobile", async ({ page, user, db }) => {
  const { data: item } = await db.from("items").insert({ household_id: user.householdId, name: "Nồi cơm điện" }).select("id").single();
  await signIn(page, user);

  const deleteFromDetail = async () => {
    await page.goto(`/items/${item!.id}`);
    await page.getByRole("button", { name: "Tùy chọn món đồ" }).first().click();
    await page.getByRole("menuitem", { name: "Xoá món đồ" }).click();
    await expect(page.getByRole("dialog").getByText(/Bạn có thể khôi phục trong 30 ngày/)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Xoá" }).click();
    await expect(page).toHaveURL(/\/items$/);
  };

  // Undo straight from the toast.
  await deleteFromDetail();
  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await expect(page).toHaveURL(new RegExp(`/items/${item!.id}`));
  await expect(page.getByRole("heading", { name: "Nồi cơm điện" })).toBeVisible();

  // Restore from the trash page.
  await deleteFromDetail();
  await page.goto("/trash");
  const row = page.locator("li", { hasText: "Nồi cơm điện" });
  await expect(row.getByText(/Xoá hẳn vào/)).toBeVisible();
  await row.getByRole("button", { name: "Khôi phục" }).click();
  await expect(page.getByText("Thùng rác trống.")).toBeVisible();
  await page.goto("/items");
  await expect(page.getByRole("link", { name: /Nồi cơm điện/ }).first()).toBeVisible();

  // Delete forever.
  await deleteFromDetail();
  await page.goto("/trash");
  await page.getByRole("button", { name: "Xoá vĩnh viễn Nồi cơm điện" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xoá vĩnh viễn" }).click();
  await expect(page.getByText("Thùng rác trống.")).toBeVisible();
  const { count } = await db.from("items").select("id", { count: "exact", head: true }).eq("id", item!.id);
  expect(count).toBe(0);
});
