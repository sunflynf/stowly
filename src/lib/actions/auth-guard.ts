import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";

export type ServerSupabase = Awaited<ReturnType<typeof getSupabaseServer>>;

/** Returns the RLS-scoped client and user id, or null when signed out. */
export async function requireUser(): Promise<{ supabase: ServerSupabase; userId: string } | null> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  return { supabase, userId };
}
