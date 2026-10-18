-- Alert states (single source of truth) and item search.

-- ---------------------------------------------------------------------------
-- Alert computation
-- ---------------------------------------------------------------------------

-- "Today" in the user's timezone.
create or replace function public.user_today(p_timezone text)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone coalesce(p_timezone, 'Asia/Ho_Chi_Minh'))::date
$$;

-- Every alert currently raised by one item. Used by the alerts view, search
-- badges, dashboard counts and the scheduled notification job.
--   severity: 3 = danger, 2 = warning, 1 = info
--   threshold_key: identifies the reminder threshold, so the same alert is
--   never sent twice (see notifications_log).
create or replace function public.compute_item_alerts(
  p_item public.items,
  p_today date,
  p_expiry_lead_days integer[],
  p_warranty_lead_days integer
)
returns table (kind public.alert_kind, severity smallint, due_date date, days_left integer, threshold_key text)
language sql
stable
set search_path = ''
as $$
  with base as (
    select (p_item).* where (p_item).archived_at is null and (p_item).condition <> 'given_away'
  ),
  lead as (
    select coalesce(max(d), 30) as max_days from unnest(p_expiry_lead_days) d
  )
  -- expired
  select 'expired'::public.alert_kind, 3::smallint, b.expiry_date, (b.expiry_date - p_today), b.expiry_date::text
  from base b
  where b.expiry_date < p_today
  union all
  -- expiring soon (bucketed by the configured reminder days, e.g. 30/7/1)
  select 'expiring_soon', case when b.expiry_date - p_today <= 7 then 3 else 1 end::smallint,
         b.expiry_date, (b.expiry_date - p_today),
         b.expiry_date::text || ':' || coalesce(
           (select min(d) from unnest(p_expiry_lead_days) d where d >= b.expiry_date - p_today)::text, 'x')
  from base b, lead
  where b.expiry_date >= p_today and b.expiry_date <= p_today + lead.max_days
  union all
  -- out of stock / low stock (only when a threshold is set)
  select case when b.quantity = 0 then 'out_of_stock' else 'low_stock' end::public.alert_kind,
         case when b.quantity = 0 then 3 else 2 end::smallint,
         null::date, null::integer,
         case when b.quantity = 0 then 'out' else 'low' end
  from base b
  where b.min_quantity is not null and b.quantity <= b.min_quantity
  union all
  -- warranty ending
  select 'warranty_ending', 2::smallint, b.warranty_until, (b.warranty_until - p_today), b.warranty_until::text
  from base b
  where b.warranty_until >= p_today and b.warranty_until <= p_today + p_warranty_lead_days
  union all
  -- replacement due (e.g. pillows every 18 months)
  select 'replace_due', 2::smallint, r.due, (r.due - p_today), r.due::text
  from base b
  cross join lateral (
    select (coalesce(b.last_replaced_at, b.purchase_date, b.created_at::date)
            + make_interval(months => b.replace_after_months))::date as due
  ) r
  where b.replace_after_months is not null and r.due <= p_today
  union all
  -- lent book overdue
  select 'lent_overdue', 2::smallint, l.due, (l.due - p_today), l.due::text
  from base b
  cross join lateral (
    select case when (b.attributes ->> 'lent_due') ~ '^\d{4}-\d{2}-\d{2}$'
                then (b.attributes ->> 'lent_due')::date end as due
  ) l
  where nullif(btrim(b.attributes ->> 'lent_to'), '') is not null and l.due < p_today
$$;

-- All active alerts for the current user, with what the UI needs to render them.
create or replace view public.item_alerts
with (security_invoker = true)
as
select
  i.user_id,
  i.id as item_id,
  i.name,
  i.quantity,
  i.unit,
  i.min_quantity,
  i.category_id,
  i.location_id,
  l.path_text as location_path,
  l.path_text_en as location_path_en,
  a.kind,
  a.severity,
  a.due_date,
  a.days_left,
  a.threshold_key,
  (s.until is not null and s.until >= public.user_today(p.timezone)) as snoozed,
  s.until as snoozed_until,
  (select ph.thumb_path from public.item_photos ph where ph.item_id = i.id order by ph.sort_order, ph.created_at limit 1) as thumb_path
from public.items i
join public.profiles p on p.id = i.user_id
left join public.locations l on l.id = i.location_id
cross join lateral public.compute_item_alerts(i, public.user_today(p.timezone), p.expiry_lead_days, p.warranty_lead_days) a
left join public.alert_snoozes s on s.item_id = i.id and s.kind = a.kind;

grant select on public.item_alerts to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select p.*, public.user_today(p.timezone) as today
    from public.profiles p where p.id = (select auth.uid())
  ),
  active as (
    select i.* from public.items i where i.archived_at is null and i.condition <> 'given_away'
  ),
  alerts as (
    select a.* from public.item_alerts a
  )
  select jsonb_build_object(
    'total_items', (select count(*) from active),
    'added_30d', (select count(*) from active, me where active.created_at >= me.today - 30),
    'expiring_30d', (select count(*) from active, me where active.expiry_date between me.today and me.today + 30),
    'expired', (select count(*) from alerts where kind = 'expired'),
    'low_stock', (select count(*) from alerts where kind in ('low_stock', 'out_of_stock')),
    'low_stock_names', (select coalesce(jsonb_agg(name order by severity desc, name), '[]'::jsonb)
                        from (select name, severity from alerts where kind in ('low_stock', 'out_of_stock')
                              order by severity desc, name limit 3) x),
    'warranty_ending', (select count(*) from alerts where kind = 'warranty_ending'),
    'warranty_min_days', (select min(days_left) from alerts where kind = 'warranty_ending'),
    'attention', (select count(distinct item_id) from alerts where not snoozed)
  )
$$;

create or replace function public.category_counts()
returns table (category_id uuid, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.category_id, count(*)
  from public.items i
  where i.archived_at is null and i.condition <> 'given_away'
  group by i.category_id
$$;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

-- Turns free text into a tsquery over normalised words. Prefix matching is
-- limited to names and tags (weights A/B) so "sac" finds "Dây sạc" without
-- dragging in every item of the category "Sách"; whole words match anywhere:
-- "ao khoac" -> ('ao':*AB | 'ao') & ('khoac':*AB | 'khoac')
create or replace function public.search_tsquery(p_query text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(public.normalize_search(p_query), '') = '' then null
    else to_tsquery('simple', (
      select string_agg(format('(%1$s:*AB | %1$s)', quote_literal(w)), ' & ')
      from unnest(regexp_split_to_array(
        regexp_replace(public.normalize_search(p_query), '[^a-z0-9 ]', ' ', 'g'), '\s+')) w
      where w <> ''
    ))
  end
$$;

create or replace function public.search_items(
  p_query text default null,
  p_category_ids uuid[] default null,
  p_location_id uuid default null,
  p_conditions public.item_condition[] default null,
  p_tag_ids uuid[] default null,
  p_states public.alert_kind[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_archived boolean default false,
  p_sort text default 'relevance',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  quantity numeric,
  unit text,
  min_quantity numeric,
  condition public.item_condition,
  category_id uuid,
  location_id uuid,
  location_path text,
  location_path_en text,
  expiry_date date,
  warranty_until date,
  purchase_price numeric,
  updated_at timestamptz,
  thumb_path text,
  alert_kinds public.alert_kind[],
  rank real,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_today date;
  v_norm text := nullif(public.normalize_search(p_query), '');
  v_tsq tsquery := public.search_tsquery(p_query);
  v_words text[] := array(
    select w from unnest(regexp_split_to_array(regexp_replace(coalesce(v_norm, ''), '[^a-z0-9 ]', ' ', 'g'), '\s+')) w
    where w <> '');
begin
  select * into v_profile from public.profiles where profiles.id = (select auth.uid());
  if not found then
    return;
  end if;
  v_today := public.user_today(v_profile.timezone);

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
      and (p_tag_ids is null or exists (
            select 1 from public.item_tags it where it.item_id = i.id and it.tag_id = any (p_tag_ids)))
  ),
  filtered as (
    select m.* from matched m
    where p_states is null or m.kinds && p_states
  )
  select
    f.id, f.name, f.quantity, f.unit, f.min_quantity, f.condition,
    f.category_id, f.location_id, l.path_text, l.path_text_en,
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
$$;
