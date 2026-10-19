import "server-only";
import type { ServerSupabase } from "@/lib/actions/auth-guard";

/** Ensures tags exist (case-insensitive) and makes the item's tag set match `names`. */
export async function syncTags(supabase: ServerSupabase, itemId: string, names: string[]) {
  const { data: existing, error } = await supabase.from("tags").select("id, name");
  if (error) return error;
  const byName = new Map(existing.map((t) => [t.name.toLocaleLowerCase(), t.id]));
  const missing = names.filter((n) => !byName.has(n.toLocaleLowerCase()));
  if (missing.length) {
    const { data: created, error: insertError } = await supabase
      .from("tags")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (insertError) return insertError;
    created.forEach((t) => byName.set(t.name.toLocaleLowerCase(), t.id));
  }
  const wanted = new Set(names.map((n) => byName.get(n.toLocaleLowerCase())!));

  const { data: current, error: currentError } = await supabase.from("item_tags").select("tag_id").eq("item_id", itemId);
  if (currentError) return currentError;
  const have = new Set(current.map((r) => r.tag_id));

  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id));
  if (toRemove.length) {
    const { error: e } = await supabase.from("item_tags").delete().eq("item_id", itemId).in("tag_id", toRemove);
    if (e) return e;
  }
  if (toAdd.length) {
    const { error: e } = await supabase.from("item_tags").insert(toAdd.map((tag_id) => ({ item_id: itemId, tag_id })));
    if (e) return e;
  }
  return null;
}
