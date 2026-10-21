-- Search speed: let a text query use the GIN indexes before the exact per-row
-- match, which runs a subquery per word and used to scan every item of the
-- household (~115 ms of a ~140 ms query at 5,000 items). Results are unchanged:
-- the new filter only removes rows the exact match would reject anyway.
-- `<<%` is pg_trgm's strict word similarity operator. It uses
-- pg_trgm.strict_word_similarity_threshold, whose default (0.5) is the threshold
-- the exact check uses; the API roles cannot change it.

-- Text candidates for search_items(): exactly the items its text match accepts,
-- found through the GIN indexes (or null for a broad query, see below). Security definer so the indexes can be used:
-- under RLS, Postgres will not evaluate non-leakproof operators such as @@ or
-- <<% through an index ahead of the policy, so every row was checked one by one.
-- It filters to the caller's active household itself and only returns ids the
-- caller can already read.
--   * the whole query matches (all words, exact or prefix), or
--   * the name contains the normalised query, or
--   * every word matches exactly, by prefix, or (4+ letters) with a typo.
create or replace function public.search_candidate_ids(p_tsq tsquery, p_norm text, p_words text[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
-- Every lookup below has a GIN index. Without this the planner, which cannot
-- estimate trigram matches, often chooses to compare every row instead
-- (~70 ms for a 5-letter word over 5,000 items, vs a few ms through the index).
set enable_seqscan = off
as $$
declare
  v_household uuid := public.current_household_id();
  v_ids uuid[];
  v_all uuid[];
  v_word uuid[];
  w text;
begin
  if v_household is null then
    return '{}';
  end if;

  v_ids := array(
    select c.id from public.items c where c.household_id = v_household and c.search_vector @@ p_tsq
    union
    select c.id from public.items c where c.household_id = v_household and c.name_norm like '%' || p_norm || '%'
  );
  -- A broad query (e.g. a room name) already matches hundreds of items as a
  -- whole; then search_items() checking every row is cheaper than the per-word
  -- typo lookups. Null means "no candidate filter".
  if cardinality(v_ids) > 400 then
    return null;
  end if;

  foreach w in array coalesce(p_words, '{}') loop
    if char_length(w) >= 4 then
      v_word := array(
        select c.id from public.items c
        where c.household_id = v_household
          and c.search_vector @@ to_tsquery('simple', format('(%1$s:*AB | %1$s)', quote_literal(w)))
        union
        -- pg_trgm strict word similarity; its default threshold (0.5) is the one
        -- search_items() uses, and the API roles cannot change it.
        select c.id from public.items c
        where c.household_id = v_household and w operator(extensions.<<%) c.search_text
      );
    else
      v_word := array(
        select c.id from public.items c
        where c.household_id = v_household
          and c.search_vector @@ to_tsquery('simple', format('(%1$s:*AB | %1$s)', quote_literal(w)))
      );
    end if;
    v_all := case when v_all is null then v_word
                  else array(select unnest(v_all) intersect select unnest(v_word)) end;
    exit when cardinality(v_all) = 0;
  end loop;

  return array(select unnest(v_ids) union select unnest(coalesce(v_all, '{}')));
end;
$$;

revoke all on function public.search_candidate_ids(tsquery, text, text[]) from public, anon;
grant execute on function public.search_candidate_ids(tsquery, text, text[]) to authenticated;

CREATE OR REPLACE FUNCTION public.search_items(p_query text DEFAULT NULL::text, p_category_ids uuid[] DEFAULT NULL::uuid[], p_location_id uuid DEFAULT NULL::uuid, p_conditions item_condition[] DEFAULT NULL::item_condition[], p_tag_ids uuid[] DEFAULT NULL::uuid[], p_group_id uuid DEFAULT NULL::uuid, p_states alert_kind[] DEFAULT NULL::alert_kind[], p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric, p_archived boolean DEFAULT false, p_sort text DEFAULT 'relevance'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, quantity numeric, unit text, min_quantity numeric, condition item_condition, category_id uuid, location_id uuid, location_path text, location_path_en text, group_id uuid, expiry_date date, warranty_until date, purchase_price numeric, updated_at timestamp with time zone, thumb_path text, alert_kinds alert_kind[], rank real, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_profile public.profiles;
  v_today date;
  v_norm text := nullif(public.normalize_search(p_query), '');
  v_tsq tsquery := public.search_tsquery(p_query);
  v_words text[] := array(
    select w from unnest(regexp_split_to_array(regexp_replace(coalesce(v_norm, ''), '[^a-z0-9 ]', ' ', 'g'), '\s+')) w
    where w <> '');
  -- Ids that match the text query, found through the GIN indexes.
  v_ids uuid[];
begin
  select * into v_profile from public.profiles where profiles.id = (select auth.uid());
  if not found then
    return;
  end if;
  v_today := public.user_today(v_profile.timezone);

  -- Text candidates through the indexes (see search_candidate_ids). The exact
  -- match below still runs, but only on these rows instead of every item of the
  -- household; it accepts the same rows, so results are unchanged.
  if v_norm is not null then
    v_ids := public.search_candidate_ids(v_tsq, v_norm, v_words);
  end if;

  return query
  with matched as (
    select
      i.*,
      case
        when v_norm is null then 0::real
        else (coalesce(ts_rank(i.search_vector, v_tsq), 0)
              + extensions.strict_word_similarity(v_norm, i.search_text)
              -- whole-word hit in the name beats a prefix hit ("sac" -> "Dây sạc" before "Sách")
              + case when i.name_norm ~ ('\m' || v_norm || '\M') then 0.6 else 0 end
              + case when i.name_norm like v_norm || '%' then 0.3 else 0 end
              -- typed accents that match exactly rank higher ("sạc" before "sách")
              + case when strpos(lower(i.name), lower(btrim(p_query))) > 0 then 0.6 else 0 end)::real
      end as rnk,
      array(
        select a.kind from public.compute_item_alerts(i, v_today, v_profile.expiry_lead_days, v_profile.warranty_lead_days) a
        order by a.severity desc
      ) as kinds
    from public.items i
    where (case when p_archived then i.archived_at is not null else i.archived_at is null end)
      and (v_ids is null or i.id = any (v_ids))
      and (v_norm is null
           or i.search_vector @@ v_tsq
           -- substring of the name ("usb-c" inside "Dây sạc USB-C 1m")
           or i.name_norm like '%' || v_norm || '%'
           -- every word matches exactly/by prefix, or (words of 4+ letters) with a typo
           or (select bool_and(
                 i.search_vector @@ to_tsquery('simple', format('(%1$s:*AB | %1$s)', quote_literal(w)))
                 or (char_length(w) >= 4 and extensions.strict_word_similarity(w, i.search_text) >= 0.5))
               from unnest(v_words) w))
      and (p_category_ids is null or i.category_id = any (p_category_ids))
      and (p_conditions is null or i.condition = any (p_conditions))
      and (p_price_min is null or i.purchase_price >= p_price_min)
      and (p_price_max is null or i.purchase_price <= p_price_max)
      and (p_location_id is null or exists (
            select 1 from public.locations l
            where l.id = i.location_id and p_location_id = any (l.path_ids)))
      -- Cheap necessary conditions for the requested alert states, so the exact
      -- (more expensive) compute_item_alerts() only runs on candidates.
      and (p_states is null
           or (('expired' = any (p_states) or 'expiring_soon' = any (p_states))
               and i.expiry_date <= v_today + 366)
           or (('low_stock' = any (p_states) or 'out_of_stock' = any (p_states))
               and i.min_quantity is not null and i.quantity <= i.min_quantity)
           or ('warranty_ending' = any (p_states) and i.warranty_until between v_today and v_today + 366)
           or ('replace_due' = any (p_states) and i.replace_after_months is not null)
           or ('lent_overdue' = any (p_states) and i.attributes ? 'lent_to'))
      and (p_group_id is null or i.group_id = p_group_id)
      and (p_tag_ids is null or exists (
            select 1 from public.item_tags it where it.item_id = i.id and it.tag_id = any (p_tag_ids)))
  ),
  filtered as (
    select m.* from matched m
    where p_states is null or m.kinds && p_states
  )
  select
    f.id, f.name, f.quantity, f.unit, f.min_quantity, f.condition,
    f.category_id, f.location_id, l.path_text, l.path_text_en, f.group_id,
    f.expiry_date, f.warranty_until, f.purchase_price, f.updated_at,
    (select ph.thumb_path from public.item_photos ph where ph.item_id = f.id
      order by ph.sort_order, ph.created_at limit 1),
    f.kinds,
    f.rnk,
    count(*) over ()
  from filtered f
  left join public.locations l on l.id = f.location_id
  order by
    case when p_sort = 'relevance' and v_norm is not null then f.rnk end desc nulls last,
    case when p_sort = 'name' then lower(f.name) end asc,
    case when p_sort = 'expiry' then f.expiry_date end asc nulls last,
    case when p_sort = 'low_stock' then
      case when f.min_quantity is null then null
           when f.min_quantity = 0 then (case when f.quantity = 0 then 0 else 1 end)
           else f.quantity / f.min_quantity end
    end asc nulls last,
    f.updated_at desc,
    f.id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
end;
$function$;
