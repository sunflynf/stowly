-- Usage-rate prediction: learn how fast an item is used from its quantity
-- history and warn before it runs out, not only at the low-stock threshold.
--
--   usage_per_day  units used per day, from at least 3 decreases in the last
--                  180 days: the units used after the first decrease, divided by
--                  the days from the first to the last decrease (at least 7).
--   usage_last_at  date of the last quantity change, i.e. when the quantity was
--                  last known to be right.
-- The estimated day it runs out is usage_last_at + quantity / usage_per_day.
-- compute_item_alerts() (still the single source of alerts) raises running_out
-- when that is at most 7 days away.

alter table public.items
  add column usage_per_day numeric(12, 4) check (usage_per_day is null or usage_per_day > 0),
  add column usage_last_at date;

create or replace function public.refresh_item_usage(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first timestamptz;
  v_last timestamptz;
  v_count integer;
  v_after_first numeric;
  v_last_change timestamptz;
  v_rate numeric;
  prev text := coalesce(current_setting('stowly.skip_touch', true), '');
begin
  with used as (
    select e.created_at, -e.delta as amount,
           row_number() over (order by e.created_at, e.id) as n
    from public.item_events e
    where e.item_id = p_item_id
      and e.type = 'quantity_change'
      and e.delta < 0
      and e.created_at >= now() - interval '180 days'
  )
  select min(created_at), max(created_at), count(*), coalesce(sum(amount) filter (where n > 1), 0)
    into v_first, v_last, v_count, v_after_first
  from used;

  select max(e.created_at) into v_last_change
  from public.item_events e
  where e.item_id = p_item_id and e.type in ('quantity_change', 'created');

  if v_count >= 3 and extract(epoch from v_last - v_first) >= 7 * 86400 and v_after_first > 0 then
    v_rate := v_after_first / (extract(epoch from v_last - v_first) / 86400.0);
  end if;

  -- Maintenance update: keep updated_at and do not log an event.
  perform set_config('stowly.skip_touch', '1', true);
  update public.items
     set usage_per_day = round(v_rate, 4),
         usage_last_at = v_last_change::date
   where id = p_item_id
     and (usage_per_day is distinct from round(v_rate, 4) or usage_last_at is distinct from v_last_change::date);
  perform set_config('stowly.skip_touch', prev, true);
end;
$$;

revoke all on function public.refresh_item_usage(uuid) from public, anon, authenticated;

create or replace function public.item_events_refresh_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'quantity_change' then
    perform public.refresh_item_usage(new.item_id);
  end if;
  return null;
end;
$$;

create trigger item_events_usage after insert on public.item_events
  for each row execute function public.item_events_refresh_usage();

-- Existing history.
do $$
declare
  r record;
begin
  for r in select distinct e.item_id from public.item_events e
           where e.type = 'quantity_change' and e.delta < 0 and e.created_at >= now() - interval '180 days' loop
    perform public.refresh_item_usage(r.item_id);
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.compute_item_alerts(p_item items, p_today date, p_expiry_lead_days integer[], p_warranty_lead_days integer)
 RETURNS TABLE(kind alert_kind, severity smallint, due_date date, days_left integer, threshold_key text)
 LANGUAGE sql
 STABLE
AS $function$
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
  union all
  -- something borrowed must go back: from 7 days before the agreed date (warning),
  -- danger once it is late
  select 'borrow_due', case when r.due < p_today then 3 else 2 end::smallint, r.due, (r.due - p_today),
         r.due::text || case when r.due < p_today then ':over' else ':soon' end
  from base b
  cross join lateral (
    select case when (b.attributes ->> 'borrow_due') ~ '^\d{4}-\d{2}-\d{2}$'
                then (b.attributes ->> 'borrow_due')::date end as due
  ) r
  where nullif(btrim(b.attributes ->> 'borrowed_from'), '') is not null and r.due <= p_today + 7
  union all
  -- running out soon, predicted from the usage rate: at most 7 days of stock left
  -- (low/out of stock already covers items at their threshold)
  select 'running_out', 2::smallint, u.empty_on, greatest(0, u.empty_on - p_today), 'run:' || u.empty_on::text
  from base b
  cross join lateral (
    select (b.usage_last_at + ceil(b.quantity / b.usage_per_day)::integer) as empty_on
  ) u
  where b.usage_per_day > 0
    and b.quantity > 0
    and b.usage_last_at >= p_today - 90
    and u.empty_on <= p_today + 7
    and not (b.min_quantity is not null and b.quantity <= b.min_quantity)
$function$;

CREATE OR REPLACE FUNCTION public.user_item_alerts(p_user_id uuid)
 RETURNS TABLE(household_id uuid, item_id uuid, name text, quantity numeric, unit text, min_quantity numeric, replace_after_months integer, category_id uuid, location_id uuid, location_path text, location_path_en text, kind alert_kind, severity smallint, due_date date, days_left integer, threshold_key text, snoozed boolean, snoozed_until date, thumb_path text)
 LANGUAGE sql
 STABLE
AS $function$
  select
    i.household_id,
    i.id,
    i.name,
    i.quantity,
    i.unit,
    i.min_quantity,
    i.replace_after_months,
    i.category_id,
    i.location_id,
    l.path_text,
    l.path_text_en,
    a.kind,
    a.severity,
    a.due_date,
    a.days_left,
    a.threshold_key,
    (s.until is not null and s.until >= d.today),
    s.until,
    (select ph.thumb_path from public.item_photos ph where ph.item_id = i.id order by ph.sort_order, ph.created_at limit 1)
  from public.profiles p
  join public.household_members m on m.household_id = p.active_household_id and m.user_id = p.id
  join public.items i on i.household_id = p.active_household_id
  left join public.locations l on l.id = i.location_id
  cross join lateral (select public.user_today(p.timezone) as today) d
  cross join lateral public.compute_item_alerts(i, d.today, p.expiry_lead_days, p.warranty_lead_days) a
  left join public.alert_snoozes s on s.item_id = i.id and s.kind = a.kind
  where p.id = p_user_id
    -- Cheap necessary conditions first; compute_item_alerts() decides exactly.
    and i.archived_at is null
    and i.condition <> 'given_away'
    and (i.expiry_date <= d.today + 366
         or (i.min_quantity is not null and i.quantity <= i.min_quantity)
         or i.warranty_until between d.today and d.today + 366
         or i.replace_after_months is not null
         or i.attributes ? 'lent_to'
         or i.attributes ? 'borrowed_from'
         or i.usage_per_day is not null)
$function$;
