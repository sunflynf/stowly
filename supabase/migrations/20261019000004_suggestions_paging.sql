-- Suggestions can number in the thousands: page them per reason (PostgREST caps
-- responses at 1000 rows) and expose counts separately for tabs and the dashboard.

drop function public.unused_suggestions();

create or replace function public.unused_suggestions(p_reason text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  item_id uuid,
  name text,
  reason text,
  idle_days integer,
  last_activity date,
  duplicate_of uuid,
  duplicates integer,
  quantity numeric,
  unit text,
  condition public.item_condition,
  category_id uuid,
  location_id uuid,
  location_path text,
  location_path_en text,
  purchase_price numeric,
  thumb_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select public.user_today(p.timezone) as today, p.unused_after_days
    from public.profiles p where p.id = (select auth.uid())
  ),
  active as (
    select i.* from public.items i where i.archived_at is null and i.condition <> 'given_away'
  ),
  activity as (
    select a.id,
      coalesce((select max(e.created_at) from public.item_events e where e.item_id = a.id), a.created_at)::date as last
    from active a
  ),
  dup as (
    select a.id,
      first_value(a.id) over w as primary_id,
      count(*) over (partition by a.name_norm, a.location_id) as n
    from active a
    window w as (partition by a.name_norm, a.location_id order by a.created_at, a.id)
  ),
  raw as (
    select a.id, 'idle'::text as reason, (me.today - act.last) as idle_days, act.last, null::uuid as duplicate_of, null::integer as duplicates
    from active a join activity act on act.id = a.id, me
    where a.expiry_date is null and me.today - act.last >= me.unused_after_days
    union all
    select a.id, a.condition::text, null, null, null, null
    from active a where a.condition in ('worn', 'broken')
    union all
    select d.id, 'duplicate', null, null, d.primary_id, d.n::integer
    from dup d where d.n > 1 and d.id <> d.primary_id
  )
  select
    r.id, a.name, r.reason, r.idle_days, r.last, r.duplicate_of, r.duplicates,
    a.quantity, a.unit, a.condition, a.category_id, a.location_id, l.path_text, l.path_text_en, a.purchase_price,
    (select ph.thumb_path from public.item_photos ph where ph.item_id = a.id order by ph.sort_order, ph.created_at limit 1)
  from raw r
  join active a on a.id = r.id
  left join public.locations l on l.id = a.location_id
  cross join me
  where (p_reason is null or r.reason = p_reason)
    and not exists (
      select 1 from public.suggestion_dismissals s
      where s.item_id = r.id and s.reason = r.reason and (s.until is null or s.until >= me.today)
    )
  order by r.reason, r.idle_days desc nulls last, a.name, r.id
  limit least(greatest(p_limit, 1), 500000)
  offset greatest(p_offset, 0)
$$;

create or replace function public.unused_suggestion_counts()
returns table (reason text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.reason, count(*) from public.unused_suggestions(null, 500000, 0) s group by s.reason
$$;
