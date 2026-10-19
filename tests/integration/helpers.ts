import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type Client = SupabaseClient<Database>;

export function adminClient(): Client {
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): Client {
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  email: string;
  /** The household created for the user at sign-up. */
  householdId: string;
  client: Client;
}

/** Creates a confirmed user and returns a client signed in as that user. */
export async function createTestUser(): Promise<TestUser> {
  const email = `test-${randomUUID()}@stowly.test`;
  const password = `pw-${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { data: profile, error: profileError } = await client.from("profiles").select("active_household_id").single();
  if (profileError || !profile.active_household_id) throw profileError ?? new Error("no household");
  return { id: data.user.id, email, householdId: profile.active_household_id, client };
}

export async function deleteTestUser(id: string) {
  await adminClient().auth.admin.deleteUser(id);
}
