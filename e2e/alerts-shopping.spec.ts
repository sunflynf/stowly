import { expect, signIn, test } from "./fixtures";

const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test("dashboard alerts → shopping list → restock; snooze from Alerts", async ({ page, user, db }) => {
  const { error } = await db.from("items").insert(
    [
    { household_id: user.householdId, name: "Dầu ăn 2L", expiry_date: isoIn(-3) },
    { household_id: user.householdId, name: "Sữa tươi hộp 1L", expiry_date: isoIn(2) },
    { household_id: user.householdId, name: "Pin AA", quantity: 1, min_quantity: 4 },
    ],
    { defaultToNull: false },
  );
  expect(error).toBeNull();

  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "Cần xử lý" })).toBeVisible();
  // Dates are computed in UTC here; the app uses Asia/Ho_Chi_Minh, so allow ±1 day.
  await expect(page.getByText(/Quá hạn [34] ngày/)).toBeVisible();
  await expect(page.getByText(/Còn [123] ngày/)).toBeVisible();
  await expect(page.getByRole("meter", { name: /Pin AA/ })).toBeVisible();

  await page.getByRole("button", { name: "Tạo danh sách cần mua" }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(page.getByText("Pin AA")).toBeVisible();
  await page.getByRole("checkbox", { name: "Đánh dấu đã mua Pin AA" }).click();
  await expect(page.getByText("Đã cộng 4 vào kho: Pin AA")).toBeVisible();

  const { data: pin } = await db.from("items").select("quantity").eq("household_id", user.householdId).eq("name", "Pin AA").single();
  expect(Number(pin!.quantity)).toBe(5);

  await page.goto("/alerts");
  const card = page.getByRole("listitem").filter({ hasText: "Dầu ăn 2L" });
  await card.getByRole("button", { name: "Hoãn 7 ngày" }).click();
  await expect(page.getByText("Đã hoãn 7 ngày")).toBeVisible();
  await page.getByRole("tab", { name: /Đã hoãn/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Dầu ăn 2L" })).toBeVisible();
});
