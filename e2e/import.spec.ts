import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, signIn, test } from "./fixtures";

function writeCsv(name: string, content: string) {
  const dir = path.join("test-results", "import");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, content);
  return file;
}

test("import a Vietnamese CSV (semicolons, dd/mm dates, new locations, group, tags), then re-import an export", async ({ page, user, db }) => {
  const csv = writeCsv(
    "vi.csv",
    "﻿Tên món đồ;Danh mục;Vị trí;Số lượng;Ngưỡng cảnh báo;HSD;Thẻ;Nhóm;Giá mua\n" +
      "Dây sạc USB-C 1m;Điện tử;Bàn làm việc > Ngăn kéo 3;2;;;sạc, type-c;Dây sạc;85.000\n" +
      "Dây sạc Lightning;Điện tử;Bàn làm việc > Ngăn kéo 3;1;;;sạc;Dây sạc;\n" +
      "Sữa tươi hộp 1L;Thực phẩm dự trữ;Nhà bếp › Tủ lạnh;4;2;20/11/2026;tủ lạnh;;32.000\n" +
      "Sách ảnh;Đồ sưu tầm;Kho > Thùng sách;1;;31/02/2026;;;\n" +
      ";Điện tử;;1;;;;;\n",
  );
  await signIn(page, user);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Nhập từ CSV" }).click();
  await expect(page).toHaveURL(/\/import$/);

  await page.getByLabel("Chọn tệp CSV").setInputFiles(csv);
  await expect(page.getByText("vi.csv: 5 dòng · 9 cột")).toBeVisible();
  await expect(page.getByLabel("Tên món đồ", { exact: true })).toHaveValue("name");
  await expect(page.getByLabel("HSD")).toHaveValue("expiry_date");
  await expect(page.getByText("3 dòng hợp lệ · 2 dòng lỗi sẽ bị bỏ qua")).toBeVisible();
  await expect(page.getByText("Hạn sử dụng: ngày không hợp lệ")).toBeVisible();

  await page.getByRole("button", { name: "Nhập 3 dòng" }).click();
  await expect(page.getByText("3 tạo mới · 0 cập nhật · 0 bỏ qua · 2 lỗi")).toBeVisible();

  const { data: items } = await db
    .from("items")
    .select("name, quantity, min_quantity, expiry_date, purchase_price, category:categories(name), location:locations(path_text), group:item_groups(name), item_tags(tag:tags(name))")
    .eq("household_id", user.householdId)
    .order("name");
  expect(items!.map((i) => i.name)).toEqual(["Dây sạc Lightning", "Dây sạc USB-C 1m", "Sữa tươi hộp 1L"]);
  const usb = items!.find((i) => i.name === "Dây sạc USB-C 1m")!;
  expect(usb.location?.path_text).toBe("Bàn làm việc › Ngăn kéo 3");
  expect(usb.group?.name).toBe("Dây sạc");
  expect(Number(usb.purchase_price)).toBe(85000);
  expect(usb.item_tags.map((t) => t.tag?.name).sort()).toEqual(["sạc", "type-c"]);
  const milk = items!.find((i) => i.name === "Sữa tươi hộp 1L")!;
  expect(milk.expiry_date).toBe("2026-11-20");
  expect(milk.location?.path_text).toBe("Nhà bếp › Tủ lạnh"); // existing location reused, not duplicated
  const { count: fridges } = await db.from("locations").select("id", { count: "exact", head: true }).eq("household_id", user.householdId).eq("name", "Tủ lạnh");
  expect(fridges).toBe(1);

  // Round trip: export, change a quantity, import again → updates by id, no duplicates.
  const exported = await (await page.request.get("/api/export/items")).text();
  const edited = exported.replace(/(Sữa tươi hộp 1L,[^,]*,[^,]*,)4,/, "$19,");
  expect(edited).not.toBe(exported);
  await page.getByRole("button", { name: "Nhập tệp khác" }).click();
  await page.getByLabel("Chọn tệp CSV").setInputFiles(writeCsv("export.csv", edited));
  await expect(page.getByLabel("id", { exact: true })).toHaveValue("id");
  await page.getByRole("button", { name: "Nhập 3 dòng" }).click();
  await expect(page.getByText("0 tạo mới · 3 cập nhật · 0 bỏ qua · 0 lỗi")).toBeVisible();
  const { data: after } = await db.from("items").select("name, quantity").eq("household_id", user.householdId);
  expect(after).toHaveLength(3);
  expect(Number(after!.find((i) => i.name === "Sữa tươi hộp 1L")!.quantity)).toBe(9);
});
