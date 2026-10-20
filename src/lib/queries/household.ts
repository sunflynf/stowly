"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { HouseholdRole } from "@/lib/types";
import { qk } from "./keys";

/** Every household the user belongs to; `active` marks the one being shown. */
export function useHouseholds() {
  return useQuery({
    queryKey: qk.households,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("my_households");
      if (error) throw error;
      return data;
    },
  });
}

/** The active household and what the user may do in it. */
export function useHousehold() {
  const { data, isPending } = useHouseholds();
  const active = data?.find((h) => h.active) ?? null;
  const role: HouseholdRole | null = active?.role ?? null;
  return {
    household: active,
    role,
    isPending,
    // While loading, assume editing is allowed: the server enforces roles anyway,
    // and this avoids controls flickering away for owners and editors.
    canEdit: isPending || role === "owner" || role === "editor",
    isOwner: role === "owner",
  };
}

/** "<owner>'s home" unless the household has been named. */
export function useHouseholdName() {
  const t = useTranslations("members");
  return (h: { name: string | null; owner_name: string | null }) => h.name ?? t("defaultName", { name: h.owner_name ?? "" });
}

export function useMembers() {
  return useQuery({
    queryKey: qk.members,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("household_member_list");
      if (error) throw error;
      return data;
    },
  });
}

/** Open invites of the active household (owner only; empty for others). */
export function useInvites(enabled: boolean) {
  return useQuery({
    queryKey: qk.invites,
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("household_invites")
        .select("id, email, role, expires_at, created_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      return data.map((i) => ({ ...i, expired: new Date(i.expires_at).getTime() <= now }));
    },
  });
}

/** Display names of everyone who appears in the household's history, including former members. */
export function useHouseholdPeople() {
  return useQuery({
    queryKey: qk.people,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("household_people");
      if (error) throw error;
      return new Map(data.map((p) => [p.user_id, p]));
    },
  });
}
