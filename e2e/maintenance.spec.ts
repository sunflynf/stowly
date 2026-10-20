import { expect, signIn, test } from "./fixtures";

const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test("schedule maintenance on an item, see it due, mark it done @mobile", async ({ page, user, db }) => {
  const { data: item } = await db
    .from("items")
    .insert({ household_id: user.householdId, name: "Máy lạnh phòng ngủ" })
    .select("id")
    .single();
  await signIn(page, user);

  // From the item: "Clean AC filter every 3 months", first due 3 days ago.
  await page.goto(`/items/${item!.id}`);
  await page.getByRole("button", { name: "Thêm lịch" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Việc cần làm").fill("Vệ sinh lưới lọc");
  await dialog.getByLabel("Số lượng").fill("3");
  await dialog.getByLabel("Đơn vị").selectOption("month");
  await dialog.getByLabel("Lần đầu vào ngày").fill(isoIn(-3));
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Mỗi 3 tháng")).toBeVisible();
  await expect(page.getByRole("region", { name: "Bảo trì" }).getByText(/Trễ \d ngày/)).toBeVisible();

  // Due tasks appear on the dashboard and on the Alerts page.
  await page.goto("/");
  await expect(page.getByText("Bảo trì đến hạn (1)")).toBeVisible();
  await page.goto("/alerts");
  await page.getByRole("tab", { name: /Bảo trì/ }).click();
  const card = page.getByRole("tabpanel").locator("li", { hasText: "Vệ sinh lưới lọc" });
  await expect(card).toBeVisible();

  // Mark done today: it leaves the alerts and moves 3 months ahead.
  await card.getByRole("button", { name: "Đã làm" }).click();
  await page.getByRole("dialog").getByLabel("Ghi chú (không bắt buộc)").fill("thay lưới mới");
  await page.getByRole("dialog").getByRole("button", { name: "Đã làm" }).click();
  await expect(page.getByText("Đã ghi nhận. Lịch đã chuyển sang lần tới.")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Vệ sinh lưới lọc")).toHaveCount(0);

  await page.goto("/maintenance");
  await expect(page.getByRole("heading", { name: "Sắp tới (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử" }).click();
  await expect(page.getByText("thay lưới mới")).toBeVisible();

  // The item's history records it too.
  await page.goto(`/items/${item!.id}`);
  await expect(page.getByText("Đã bảo trì")).toBeVisible();
  const { data: task } = await db.from("maintenance_tasks").select("last_done_on, next_due").eq("item_id", item!.id).single();
  expect(task!.last_done_on).not.toBeNull();
  expect(task!.next_due > isoIn(80)).toBe(true);
});
