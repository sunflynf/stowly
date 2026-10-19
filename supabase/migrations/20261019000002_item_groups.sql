-- Item groups: several items (e.g. all "charging cables") sharing one
-- low-stock threshold, evaluated on their combined quantity.

create table public.item_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  unit text check (unit is null or char_length(unit) <= 20),
  min_quantity numeric(12, 3) check (min_quantity is null or min_quantity >= 0),
  snoozed_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index item_groups_user_name_idx on public.item_groups (user_id, lower(name));
create trigger item_groups_updated_at before update on public.item_groups
  for each row execute function public.set_updated_at();

alter table public.item_groups enable row level security;
create policy item_groups_owner on public.item_groups for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.items add column group_id uuid;
alter table public.items
  add constraint items_group_fkey foreign key (group_id, user_id)
  references public.item_groups (id, user_id) on delete set null (group_id);
create index items_group_idx on public.items (group_id) where group_id is not null;

-- Group name is part of the item search document.
create or replace function public.items_compute_search()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category text := '';
  v_location text := '';
  v_tags text := '';
  v_attrs text := '';
  v_group text := '';
begin
  if new.group_id is not null then
    select g.name into v_group from public.item_groups g where g.id = new.group_id;
  end if;

  if new.category_id is not null then
    select concat_ws(' ', c.name, c.name_en) into v_category
    from public.categories c where c.id = new.category_id;
  end if;

  if new.location_id is not null then
    select concat_ws(' ', l.path_text, l.path_text_en) into v_location
    from public.locations l where l.id = new.location_id;
  end if;

  select coalesce(string_agg(t.name, ' '), '') into v_tags
  from public.item_tags it join public.tags t on t.id = it.tag_id
  where it.item_id = new.id;

  select coalesce(string_agg(e.value, ' '), '') into v_attrs
  from jsonb_each_text(new.attributes) e
  where e.value !~ '^\d{4}-\d{2}-\d{2}$';

  new.search_vector :=
       setweight(to_tsvector('simple', public.normalize_search(new.name)), 'A')
    || setweight(to_tsvector('simple', public.normalize_search(v_tags)), 'B')
    || setweight(to_tsvector('simple', public.normalize_search(concat_ws(' ', v_category, v_location, v_group))), 'C')
    || setweight(to_tsvector('simple', public.normalize_search(concat_ws(' ', new.notes, v_attrs, new.purchase_place, new.barcode))), 'D');

  new.search_text := public.normalize_search(concat_ws(' ', new.name, v_tags, v_category, v_location, v_group, new.barcode));
  return new;
end;
$$;

create or replace function public.item_groups_refresh()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    perform public.refresh_item_search(array(select id from public.items where group_id = new.id));
  end if;
  return null;
end;
$$;

create trigger item_groups_refresh after update on public.item_groups
  for each row execute function public.item_groups_refresh();

-- Totals for every group (active members only).
create or replace view public.item_group_stats
with (security_invoker = true)
as
select
  g.id,
  g.user_id,
  g.name,
  g.unit,
  g.min_quantity,
  g.snoozed_until,
  coalesce(t.total, 0)::numeric as total,
  coalesce(t.members, 0)::integer as members
from public.item_groups g
left join lateral (
  select sum(i.quantity) as total, count(*) as members
  from public.items i
  where i.group_id = g.id and i.archived_at is null and i.condition <> 'given_away'
) t on true;

grant select on public.item_group_stats to authenticated;

-- Group stock alerts: same kinds as item stock alerts, on the combined quantity.
create or replace view public.group_alerts
with (security_invoker = true)
as
select
  s.user_id,
  s.id as group_id,
  s.name,
  s.unit,
  s.min_quantity,
  s.total,
  s.members,
  case when s.total = 0 then 'out_of_stock' else 'low_stock' end::public.alert_kind as kind,
  case when s.total = 0 then 3 else 2 end::smallint as severity,
  case when s.total = 0 then 'out' else 'low' end as threshold_key,
  (s.snoozed_until is not null and s.snoozed_until >= public.user_today(p.timezone)) as snoozed,
  s.snoozed_until
from public.item_group_stats s
join public.profiles p on p.id = s.user_id
where s.min_quantity is not null and s.total <= s.min_quantity;

grant select on public.group_alerts to authenticated;

-- Sent group notifications (see notifications_log for items).
create table public.group_notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null,
  kind public.alert_kind not null,
  threshold_key text not null,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),
  foreign key (group_id, user_id) references public.item_groups (id, user_id) on delete cascade,
  unique (group_id, kind, threshold_key, channel)
);

alter table public.group_notifications_log enable row level security;
create policy group_notifications_log_select on public.group_notifications_log for select to authenticated
  using (user_id = (select auth.uid()));

-- A shopping entry can stand for a whole group.
alter table public.shopping_list add column group_id uuid;
alter table public.shopping_list
  add constraint shopping_list_group_fkey foreign key (group_id, user_id)
  references public.item_groups (id, user_id) on delete set null (group_id);
create unique index shopping_list_open_group_idx on public.shopping_list (group_id) where group_id is not null and not done;

-- Dashboard counts include group alerts.
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
  ),
  galerts as (
    select g.* from public.group_alerts g
  )
  select jsonb_build_object(
    'total_items', (select count(*) from active),
    'added_30d', (select count(*) from active, me where active.created_at >= me.today - 30),
    'expiring_30d', (select count(*) from active, me where active.expiry_date between me.today and me.today + 30),
    'expired', (select count(*) from alerts where kind = 'expired'),
    'low_stock', (select count(*) from alerts where kind in ('low_stock', 'out_of_stock'))
               + (select count(*) from galerts),
    'low_stock_names', (select coalesce(jsonb_agg(name order by severity desc, name), '[]'::jsonb)
                        from (select name, severity from alerts where kind in ('low_stock', 'out_of_stock')
                              union all
                              select name, severity from galerts
                              order by severity desc, name limit 3) x),
    'warranty_ending', (select count(*) from alerts where kind = 'warranty_ending'),
    'warranty_min_days', (select min(days_left) from alerts where kind = 'warranty_ending'),
    'attention', (select count(distinct item_id) from alerts where not snoozed)
               + (select count(*) from galerts where not snoozed)
  )
$$;

-- Search: filter by group and return it.
drop function public.search_items(text, uuid[], uuid, public.item_condition[], uuid[], public.alert_kind[], numeric, numeric, boolean, text, integer, integer);

create or replace function public.search_items(
  p_query text default null,
  p_category_ids uuid[] default null,
  p_location_id uuid default null,
  p_conditions public.item_condition[] default null,
  p_tag_ids uuid[] default null,
  p_group_id uuid default null,
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
  group_id uuid,
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
$$;
