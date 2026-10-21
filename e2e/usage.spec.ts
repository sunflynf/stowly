import { expect, signIn, test } from "./fixtures";

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

test("learns how fast an item is used and warns before it runs out @mobile", async ({ page, user, db }) => {
  const { data: item } = await db
    .from("items")
    .insert({ household_id: user.householdId, name: "Kem đánh răng", quantity: 1, unit: "tuýp" })
    .select("id")
    .single();
  await db.from("item_events").update({ created_at: ago(40) }).eq("item_id", item!.id).eq("type", "created");
  // One tube every ~10 days, the last 5 days ago: the last tube runs out in ~5 days.
  for (const days of [35, 25, 15, 5]) {
    await db.from("item_events").insert({
      household_id: user.householdId,
      item_id: item!.id,
      type: "quantity_change",
      delta: -1,
      quantity_after: 1,
      created_at: ago(days),
    });
  }
  await signIn(page, user);

  await page.goto(`/items/${item!.id}`);
  await expect(page.getByText(/Dùng khoảng 1 mỗi 10 ngày · dự kiến hết vào/)).toBeVisible();

  await page.goto("/alerts");
  await page.getByRole("tab", { name: /Tồn kho/ }).click();
  const card = page.getByRole("tabpanel").locator("li", { hasText: "Kem đánh răng" });
  await expect(card.getByText(/Còn khoảng \d ngày dùng|Có thể hết hôm nay/)).toBeVisible();
  await card.getByRole("button", { name: "Thêm vào DS mua" }).click();
  await page.goto("/shopping");
  await expect(page.getByText("Kem đánh răng")).toBeVisible();
});
