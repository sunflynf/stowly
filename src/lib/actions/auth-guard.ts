import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { HouseholdRole } from "@/lib/types";

export type ServerSupabase = Awaited<ReturnType<typeof getSupabaseServer>>;

/** Returns the RLS-scoped client and user id, or null when signed out. */
export async function requireUser(): Promise<{ supabase: ServerSupabase; userId: string } | null> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  return { supabase, userId };
}

export interface MemberAuth {
  supabase: ServerSupabase;
  userId: string;
  householdId: string;
  role: HouseholdRole;
}

const RANK: Record<HouseholdRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * The signed-in user's active household and role, if the role is at least `min`.
 * RLS enforces the same rules; checking here gives a clear "forbidden" error
 * instead of a silent no-op update.
 */
export async function requireRole(
  min: HouseholdRole,
): Promise<MemberAuth | { error: "unauthorized" | "forbidden" }> {
  const auth = await requireUser();
  if (!auth) return { error: "unauthorized" };
  const { data } = await auth.supabase.rpc("my_households");
  const active = data?.find((h) => h.active);
  if (!active) return { error: "forbidden" };
  if (RANK[active.role] < RANK[min]) return { error: "forbidden" };
  return { ...auth, householdId: active.id, role: active.role };
}

/** Owner or editor: may change items, shopping, alerts, places and categories. */
export const requireEditor = () => requireRole("editor");
/** Owner: may also manage members, invites and the household itself. */
export const requireOwner = () => requireRole("owner");
