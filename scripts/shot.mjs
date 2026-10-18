// Dev-only helper: sign in (creating the demo user if needed) and screenshot pages.
// Usage: node scripts/shot.mjs <outdir> <path>[,<path>...] [mobile]
import { chromium } from "@playwright/test";

const [outDir, paths = "/", mobile] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const email = process.env.DEMO_EMAIL ?? "demo@stowly.local";
const password = process.env.DEMO_PASSWORD ?? "demo-password";

const browser = await chromium.launch();
const context = await browser.newContext(
  mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 1000 } },
);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
await page.goto(base + "/login");
await page.getByLabel(/Email/).fill(email);
await page.getByLabel(/Mật khẩu|Password/).fill(password);
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(2500);
if (page.url().includes("/login")) {
  console.log("sign-in failed, trying sign-up");
  await page.getByRole("button", { name: /Tạo tài khoản mới|Create a new account/ }).click();
  await page.getByLabel(/Mật khẩu|Password/).fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForTimeout(3000);
}
for (const p of paths.split(",")) {
  await page.goto(base + p);
  await page.waitForTimeout(2500);
  const name = p.replace(/[^a-z0-9]+/gi, "_") || "root";
  await page.screenshot({ path: `${outDir}/${name}${mobile ? "_m" : ""}.png`, fullPage: true });
  console.log("shot", p, page.url());
}
await browser.close();
