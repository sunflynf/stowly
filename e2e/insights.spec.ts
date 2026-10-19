import { expect, signIn, test } from "./fixtures";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

test("spending totals and clean-up suggestions (give away, keep, merge)", async ({ page, user, db }) => {
  const { data: desk } = await db.from("locations").select("id").eq("user_id", user.id).eq("builtin_key", "desk").single();
  const { data: items, error } = await db
    .from("items")
    .insert(
      [
        { user_id: user.id, name: "Laptop", purchase_price: 20_000_000, purchase_date: daysAgo(40) },
        { user_id: user.id, name: "Chuột", purchase_price: 500_000, purchase_date: daysAgo(10) },
        { user_id: user.id, name: "Áo khoác cũ", condition: "worn" },
        { user_id: user.id, name: "Đèn bàn", condition: "worn" },
        { user_id: user.id, name: "Cáp HDMI", quantity: 2, location_id: desk!.id },
        { user_id: user.id, name: "Cáp HDMI", quantity: 3, location_id: desk!.id },
      ],
      { defaultToNull: false },
    )
    .select("id, name");
  expect(error).toBeNull();
  // Make the HDMI cables clearly ordered (older one is kept when merging).
  const [first, second] = items!.filter((i) => i.name === "Cáp HDMI");
  await db.from("items").update({ created_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", first.id);

  await signIn(page, user);

  // Spending
  await page.goto("/stats");
  await expect(page.getByText("20.500.000 ₫").first()).toBeVisible();
  await expect(page.getByText("Số món đã mua")).toBeVisible();
  await page.getByRole("button", { name: "Xem dạng bảng" }).click();
  await expect(page.getByRole("table")).toContainText("20.000.000 ₫");
  await expect(page.getByRole("link", { name: /Laptop/ })).toBeVisible();

  // Suggestions
  await page.goto("/");
  await page.getByRole("link", { name: /gợi ý dọn dẹp/ }).click();
  await expect(page).toHaveURL(/\/suggestions$/);
  await page.getByRole("tab", { name: /Cũ/ }).click();
  const coat = page.getByRole("listitem").filter({ hasText: "Áo khoác cũ" });
  await coat.getByRole("button", { name: "Cho đi" }).click();
  await expect(page.getByText("Đã đánh dấu “Áo khoác cũ” là đã cho đi")).toBeVisible();
  await expect(coat).toHaveCount(0);
  const lamp = page.getByRole("listitem").filter({ hasText: "Đèn bàn" });
  await lamp.getByRole("button", { name: "Giữ lại" }).click();
  await expect(lamp).toHaveCount(0);

  const { data: coatRow } = await db.from("items").select("condition, archived_at").eq("user_id", user.id).eq("name", "Áo khoác cũ").single();
  expect(coatRow!.condition).toBe("given_away");
  expect(coatRow!.archived_at).not.toBeNull();

  await page.getByRole("tab", { name: /Trùng lặp/ }).click();
  await page.getByRole("listitem").filter({ hasText: "Cáp HDMI" }).getByRole("button", { name: "Gộp vào món cũ" }).click();
  await expect(page.getByText("Đã gộp vào món cũ")).toBeVisible();
  const { data: kept } = await db.from("items").select("quantity, archived_at").eq("id", first.id).single();
  const { data: merged } = await db.from("items").select("archived_at").eq("id", second.id).single();
  expect(Number(kept!.quantity)).toBe(5);
  expect(kept!.archived_at).toBeNull();
  expect(merged!.archived_at).not.toBeNull();

  // History shows the translated system note.
  await page.goto(`/items/${first.id}`);
  await expect(page.getByText(/\+3 → còn 5 · Gộp món trùng/)).toBeVisible();
});
