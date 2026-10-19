import { expect, signIn, test } from "./fixtures";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

test("attach a warranty card, view it, claim warranty and print the insurance report @mobile", async ({ page, user, db }) => {
  const { data: desk } = await db.from("locations").select("id").eq("household_id", user.householdId).eq("builtin_key", "desk").single();
  const { data: item } = await db
    .from("items")
    .insert({
      household_id: user.householdId,
      name: "Laptop Dell XPS",
      purchase_price: 32_000_000,
      purchase_date: "2026-03-15",
      purchase_place: "Phong Vũ",
      warranty_until: "2028-03-15",
      location_id: desk!.id,
      attributes: { brand: "Dell", model: "XPS 13", serial: "CN-0XPS-123" },
    })
    .select("id")
    .single();
  await db.from("items").insert({ household_id: user.householdId, name: "Bút bi", purchase_price: 5_000 });
  await signIn(page, user);

  // Attach a PDF warranty card on the item page.
  await page.goto(`/items/${item!.id}`);
  const docs = page.getByRole("region", { name: "Tài liệu" });
  await docs.getByLabel("Loại tài liệu").selectOption("warranty");
  await page.getByTestId("document-input").setInputFiles({ name: "phieu-bao-hanh.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(docs.getByText("phieu-bao-hanh.pdf")).toBeVisible();
  await expect(docs.getByRole("listitem").getByText("Phiếu bảo hành")).toBeVisible();

  // Wrong type is refused in the browser before uploading.
  await page.getByTestId("document-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByText("notes.txt: chỉ nhận PDF hoặc ảnh JPG, PNG, WebP.")).toBeVisible();

  // Viewer with download.
  await docs.getByRole("button", { name: "Xem phieu-bao-hanh.pdf" }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer.locator("iframe")).toHaveAttribute("src", /item-documents/);
  await expect(viewer.getByRole("link", { name: "Tải xuống" })).toHaveAttribute("href", /download=/);
  await viewer.getByRole("button", { name: "Đóng" }).first().click();

  // Claim warranty: all facts in one place.
  await page.getByRole("link", { name: "Yêu cầu bảo hành" }).click();
  await expect(page).toHaveURL(new RegExp(`/items/${item!.id}/warranty`));
  for (const text of ["15/03/2026", "15/03/2028", "Phong Vũ", "CN-0XPS-123", "Dell XPS 13", "phieu-bao-hanh.pdf"]) {
    await expect(page.getByText(text).first()).toBeVisible();
  }

  // Insurance report: filter by minimum value; the total follows.
  await page.goto("/reports/insurance");
  await expect(page.getByText("2 món đồ")).toBeVisible();
  await page.getByLabel("Giá trị tối thiểu").fill("1000000");
  await page.getByLabel("Giá trị tối thiểu").press("Enter");
  await expect(page).toHaveURL(/min=1000000/);
  await expect(page.getByText("1 món đồ")).toBeVisible();
  await expect(page.getByText(/Tổng giá trị: 32\.000\.000/)).toBeVisible();
  await page.getByLabel("Phòng / vị trí").selectOption({ label: "Phòng khách" });
  await expect(page.getByText("Không có món đồ nào có giá mua khớp bộ lọc.")).toBeVisible();

  // The backup lists the document by storage path.
  const backup = await page.request.get("/api/export/backup");
  const json = (await backup.json()) as { data: { item_documents: { storage_path: string }[] } };
  expect(json.data.item_documents[0].storage_path).toMatch(new RegExp(`^${user.householdId}/${item!.id}/.+\\.pdf$`));
});
