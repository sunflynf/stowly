import { expect, signIn, test } from "./fixtures";

test("accent-insensitive search, filters and inline stepper", async ({ page, user, db }) => {
  const { data: locs } = await db.from("locations").select("id, builtin_key").eq("household_id", user.householdId);
  const loc = (k: string) => locs!.find((l) => l.builtin_key === k)!.id;
  const { error } = await db.from("items").insert(
    [
    { household_id: user.householdId, name: "Áo khoác mùa đông", location_id: loc("wardrobe") },
    { household_id: user.householdId, name: "Pin AA", quantity: 1, min_quantity: 4, location_id: loc("desk") },
    { household_id: user.householdId, name: "Cáp Lightning", quantity: 0, min_quantity: 2, location_id: loc("tv_cabinet") },
    ],
    { defaultToNull: false },
  );
  expect(error).toBeNull();

  await signIn(page, user);
  await page.goto("/items");
  const search = page.getByRole("searchbox", { name: "Tìm kiếm đồ dùng" });

  await search.fill("ao khoac");
  await expect(page.getByRole("heading", { name: "1 kết quả cho “ao khoac”" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Áo khoác mùa đông/ })).toBeVisible();
  await expect(page).toHaveURL(/q=ao\+khoac/);

  // Location path is searchable too.
  await search.fill("tu quan ao");
  await expect(page.getByRole("link", { name: /Áo khoác mùa đông/ })).toBeVisible();

  // Low stock first (the "Tồn kho" view in the navigation).
  await page.goto("/items?states=out_of_stock,low_stock&sort=low_stock");
  await expect(page.getByRole("heading", { name: "2 kết quả" })).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("Cáp Lightning"); // out of stock sorts first
  await expect(rows.first()).toContainText("Hết hàng");
  await expect(rows.nth(1)).toContainText("Tồn kho thấp");

  // Inline stepper writes through and the badge follows.
  await rows.nth(1).getByLabel("Tăng số lượng").click();
  await rows.nth(1).getByLabel("Tăng số lượng").click();
  await rows.nth(1).getByLabel("Tăng số lượng").click();
  await expect(rows.nth(1).locator("output")).toHaveText("4");
  await page.reload();
  await expect(page.getByRole("heading", { name: "2 kết quả" })).toBeVisible();
});
