import { expect, signIn, test } from "./fixtures";

/** Replaces the browser's speech recogniser with one that "hears" `phrase`. */
function fakeSpeech(phrase: string) {
  return `(() => {
    class FakeRecognition {
      constructor() { this.lang = ""; this.onresult = null; this.onerror = null; this.onend = null; }
      start() {
        window.__voiceLang = this.lang;
        setTimeout(() => {
          this.onresult && this.onresult({ results: [[{ transcript: ${JSON.stringify(phrase)} }]] });
          this.onend && this.onend();
        }, 150);
      }
      stop() { this.onend && this.onend(); }
      abort() {}
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  })();`;
}

test("search by voice: “cái khoan ở đâu” finds the drill @mobile", async ({ page, user, db }) => {
  await db.from("items").insert([
    { household_id: user.householdId, name: "Máy khoan Bosch" },
    { household_id: user.householdId, name: "Hộp dụng cụ" },
  ]);
  await page.addInitScript(fakeSpeech("Cái khoan ở đâu?"));
  await signIn(page, user);

  await page.getByRole("button", { name: "Tìm bằng giọng nói" }).click();
  await expect(page).toHaveURL(/\/items\?q=khoan/);
  await expect(page.getByRole("searchbox")).toHaveValue("khoan");
  await expect(page.getByRole("link", { name: /Máy khoan Bosch/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Hộp dụng cụ/ })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __voiceLang: string }).__voiceLang)).toBe("vi-VN");
});

test("no microphone button where the browser has no speech recognition", async ({ page, user }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await signIn(page, user);
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tìm bằng giọng nói" })).toHaveCount(0);
});
