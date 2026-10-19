import { test as base, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/lib/database.types";

const admin = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel(/Mật khẩu|Password/).fill(user.password);
  await page.locator("form").getByRole("button", { name: /Đăng nhập|Sign in/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** A fresh, confirmed user per test (deleted afterwards). */
export const test = base.extend<{ user: TestUser; db: ReturnType<typeof admin> }>({
  db: async ({}, use) => {
    await use(admin());
  },
  user: async ({ db }, use) => {
    const email = `e2e-${randomUUID()}@stowly.test`;
    const password = `pw-${randomUUID()}`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    await use({ id: data.user.id, email, password });
    await db.auth.admin.deleteUser(data.user.id);
  },
});

export { expect };
