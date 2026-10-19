import { expect, signIn, test } from "./fixtures";

test("create a group from quick add, combine stock, see the shared alert", async ({ page, user, db }) => {
  await db.from("items").insert({ user_id: user.id, name: "Dây sạc Lightning", quantity: 1 });
  await signIn(page, user);

  await page.goto("/items/new");
  await page.getByLabel("Tên món đồ").fill("Dây sạc USB-C 1m");
  // Creating a group inside the item form must not submit the item.
  await page.getByRole("button", { name: "Tạo nhóm mới…" }).click();
  await page.getByLabel("Tên nhóm").fill("Dây sạc");
  await page.getByLabel(/Ngưỡng chung/).fill("4");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(page).toHaveURL(/\/items\/new$/);
  await expect(page.getByLabel("Nhóm", { exact: true })).toHaveValue(/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Dây sạc", exact: true })).toBeVisible();

  // Add the existing cable to the group from the group page.
  await page.getByRole("link", { name: "Dây sạc", exact: true }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Thêm món vào nhóm" }).first().click();
  await page.getByRole("dialog").getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Thêm 1 món" }).click();
  await expect(page.getByText("Tồn kho thấp: tổng còn 2, ngưỡng chung là 4")).toBeVisible();
  await expect(page.getByText("2 món")).toBeVisible();

  // Dashboard low-stock panel shows the group.
  await page.goto("/");
  await expect(page.getByRole("meter", { name: "Dây sạc: còn 2 trên ngưỡng 4" })).toBeVisible();
});
