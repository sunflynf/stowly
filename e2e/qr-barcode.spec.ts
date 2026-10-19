import { expect, signIn, test } from "./fixtures";

test("QR label: print sheet, short link opens the location after sign-in", async ({ page, user, db }) => {
  const { data: desk } = await db.from("locations").select("id").eq("user_id", user.id).eq("builtin_key", "desk").single();
  const { data: drawer, error } = await db
    .from("locations")
    .insert({ user_id: user.id, parent_id: desk!.id, name: "Ngăn kéo 2" })
    .select("id")
    .single();
  expect(error).toBeNull();
  await db.from("items").insert({ user_id: user.id, name: "Cáp HDMI 2m", location_id: drawer!.id });

  // A scanned label opens /l/<id>; signed-out visitors go through login and land on the location.
  await page.goto(`/l/${drawer!.id}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Mật khẩu").fill(user.password);
  await page.locator("form").getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(new RegExp(`/locations/${drawer!.id}$`));
  await expect(page.getByRole("heading", { name: "Ngăn kéo 2" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Cáp HDMI 2m/ }).first()).toBeVisible();

  // The desk page lists the drawer and includes its items.
  await page.goto(`/locations/${desk!.id}`);
  await expect(page.getByRole("link", { name: /Ngăn kéo 2/ })).toBeVisible();
  await expect(page.getByText("1 món (gồm cả vị trí con)")).toBeVisible();

  await page.getByRole("link", { name: "In nhãn QR" }).first().click();
  await expect(page).toHaveURL(/\/locations\/labels\?ids=/);
  await page.getByRole("checkbox", { name: "Ngăn kéo 2" }).click();
  await expect(page.getByRole("button", { name: "In 2 nhãn" })).toBeEnabled();
  await expect(page.getByRole("img", { name: "Mã QR mở Ngăn kéo 2" }).locator("svg")).toBeVisible();
});

test("barcode: existing item is recognised, new code is saved and searchable @mobile", async ({ page, user, db }) => {
  await db.from("items").insert({ user_id: user.id, name: "Pin AA Panasonic", quantity: 2, barcode: "8887549512345" });
  await signIn(page, user);

  // Arriving from the scanner with a code you already own.
  await page.goto("/items/new?barcode=8887549512345");
  await expect(page.getByText("Bạn đã có món này: Pin AA Panasonic (còn 2)")).toBeVisible();
  await page.getByRole("button", { name: "+1 vào kho" }).click();
  await expect(page.getByText("Bạn đã có món này: Pin AA Panasonic (còn 3)")).toBeVisible();

  // Scan dialog (no camera in CI) → type the code manually.
  await page.goto("/items/new");
  await page.getByRole("button", { name: "Quét mã vạch để điền tên" }).click();
  await page.getByLabel("Hoặc nhập mã").fill("0000012345678");
  await page.getByRole("button", { name: "Dùng mã này" }).click();
  await expect(page.getByText(/mã 0000012345678/)).toBeVisible();
  await page.getByLabel("Tên món đồ").fill("Bóng đèn LED 9W");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByText("0000012345678")).toBeVisible();

  // The barcode is searchable.
  await page.goto("/items?q=0000012345678");
  await expect(page.getByRole("link", { name: /Bóng đèn LED 9W/ }).first()).toBeVisible();
});
