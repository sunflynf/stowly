import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/** Per-request server client acting as the signed-in user (RLS applies). */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there and the
          // proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Returns the authenticated user id, or null. Verifies the JWT. */
export async function getUserId(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
