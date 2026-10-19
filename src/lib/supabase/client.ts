import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser Supabase client (singleton). All reads are protected by RLS. */
export function getSupabaseBrowser() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
