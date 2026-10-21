-- Lending and borrowing for any item (not only books).
--
-- Loans live in the item's attributes, as the books category already did:
--   lent_to, lent_due, lent_on              something of ours someone else has
--   borrowed_from, borrow_due, borrowed_on  something we have to give back
-- compute_item_alerts() keeps raising lent_overdue, and now also borrow_due.
-- History records lent / borrowed / returned events.

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
         or i.attributes ? 'borrowed_from')
$function$;
