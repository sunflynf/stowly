-- Insights: spending statistics and "unused for a long time" suggestions.

alter table public.profiles
  add column unused_after_days integer not null default 365 check (unused_after_days between 30 and 3650);

-- ---------------------------------------------------------------------------
-- Spending
-- ---------------------------------------------------------------------------

-- Spending in [p_from, p_to] (defaults: first purchase … today, user's timezone).
-- purchase_price is the amount paid for the item record (not per unit).
create or replace function public.spending_stats(p_from date default null, p_to date default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select public.user_today(p.timezone) as today, p.currency
    from public.profiles p where p.id = (select auth.uid())
  ),
  bounds as (
    select
      coalesce(p_from, (select min(i.purchase_date) from public.items i where i.purchase_price is not null), me.today) as f,
      coalesce(p_to, me.today) as t,
      me.currency
    from me
  ),
  bought as (
    select i.*
    from public.items i, bounds b
    where i.purchase_price is not null and i.purchase_date between b.f and b.t
  ),
  months as (
    select to_char(m, 'YYYY-MM') as month
    from bounds b, generate_series(date_trunc('month', b.f), date_trunc('month', b.t), interval '1 month') m
    limit 240
  ),
  monthly as (
    select to_char(purchase_date, 'YYYY-MM') as month, sum(purchase_price) as total, count(*) as cnt
    from bought group by 1
  )
  select jsonb_build_object(
    'from', b.f,
    'to', b.t,
    'currency', b.currency,
    'total', (select coalesce(sum(purchase_price), 0) from bought),
    'count', (select count(*) from bought),
    -- Same-length period right before, for the comparison.
    'previous_total', (
      select coalesce(sum(i.purchase_price), 0) from public.items i
      where i.purchase_price is not null and i.purchase_date between b.f - (b.t - b.f + 1) and b.f - 1
    ),
    'unpriced', (
      select count(*) from public.items i
      where i.purchase_price is null and i.purchase_date between b.f and b.t
    ),
    'undated_priced', (select count(*) from public.items i where i.purchase_price is not null and i.purchase_date is null),
    'by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'total', coalesce(x.total, 0), 'count', coalesce(x.cnt, 0)) order by m.month), '[]'::jsonb)
      from months m left join monthly x using (month)
    ),
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category_id', category_id, 'total', total, 'count', cnt) order by total desc), '[]'::jsonb)
      from (select category_id, sum(purchase_price) as total, count(*) as cnt from bought group by category_id) c
    ),
    -- Top-level location (room) of each purchase.
    'by_room', (
      select coalesce(jsonb_agg(jsonb_build_object('location_id', room, 'total', total, 'count', cnt) order by total desc), '[]'::jsonb)
      from (
        select l.path_ids[1] as room, sum(x.purchase_price) as total, count(*) as cnt
        from bought x left join public.locations l on l.id = x.location_id
        group by 1
      ) r
    ),
    'top', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'price', purchase_price, 'date', purchase_date, 'category_id', category_id
      ) order by purchase_price desc, purchase_date desc), '[]'::jsonb)
      from (select * from bought order by purchase_price desc, purchase_date desc limit 10) t
    )
  )
  from bounds b
$$;

-- ---------------------------------------------------------------------------
-- "Unused for a long time" and other clean-up suggestions
-- ---------------------------------------------------------------------------

create table public.suggestion_dismissals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  reason text not null check (reason in ('idle', 'worn', 'broken', 'duplicate')),
  -- null = keep for good; a date = snoozed until then.
  until date,
  created_at timestamptz not null default now(),
  primary key (item_id, reason),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

alter table public.suggestion_dismissals enable row level security;
create policy suggestion_dismissals_owner on public.suggestion_dismissals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index item_events_item_type_idx on public.item_events (item_id, created_at desc);

-- One row per suggestion:
--   idle      - no quantity change, move or condition change for unused_after_days
--               (items tracked by an expiry date are left to expiry alerts)
--   worn      - condition "worn": consider giving away
--   broken    - condition "broken": repair or discard
--   duplicate - same name in the same location as an older item (likely entered twice)
create or replace function public.unused_suggestions()
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
  where not exists (
    select 1 from public.suggestion_dismissals s
    where s.item_id = r.id and s.reason = r.reason and (s.until is null or s.until >= me.today)
  )
  order by r.reason, r.idle_days desc nulls last, a.name
$$;
