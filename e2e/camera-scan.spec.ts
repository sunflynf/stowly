import { devices } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";
import { writeQrVideo } from "./fake-camera";

// The fake camera shows a QR code containing a product code. Chromium on Linux
// has no native BarcodeDetector, so this exercises the self-hosted ZXing path.
const CODE = "8934563138164";
const video = writeQrVideo(CODE);

test.use({
  ...devices["Pixel 7"],
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`],
  },
});

test("camera scan of a known code opens the item @mobile", async ({ page, user, db }) => {
  const { data: item } = await db
    .from("items")
    .insert({ user_id: user.id, name: "Mì Hảo Hảo (thùng 30)", barcode: CODE })
    .select("id")
    .single();
  await signIn(page, user);

  await page.getByRole("button", { name: "Quét mã QR hoặc mã vạch" }).click();
  await expect(page).toHaveURL(new RegExp(`/items/${item!.id}$`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Mì Hảo Hảo (thùng 30)" })).toBeVisible();
});
