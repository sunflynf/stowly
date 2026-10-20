import { expect, signIn, test } from "./fixtures";

test("switch colour theme in Settings; it applies at once and follows the account @mobile", async ({ page, browser, user }) => {
  await signIn(page, user);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "teal");

  await page.goto("/settings");
  const picker = page.getByRole("radiogroup", { name: "Giao diện" });
  await picker.getByRole("radio", { name: /Tối/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(picker.getByRole("radio", { name: /Tối/ })).toHaveAttribute("aria-checked", "true");
  // Really dark: the page background comes from the theme tokens.
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 15, 25)");

  // Survives a reload (cookie) and a new device (profile, synced on sign-in).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b0f19");
  const other = await browser.newContext({ locale: "vi-VN" });
  const second = await other.newPage();
  await signIn(second, user);
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.close();

  // Auto follows the device.
  await picker.getByRole("radio", { name: /Tự động/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "auto");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 15, 25)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 245, 244)");

  await picker.getByRole("radio", { name: /Xanh lá tươi/ }).click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 247, 242)");
});
