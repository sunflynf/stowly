-- Maintenance schedules: recurring tasks, standalone or attached to an item
-- ("Clean AC filter every 3 months"). Due/overdue tasks are alerts computed by
-- compute_maintenance_alerts(), the same way compute_item_alerts() works for items.

create type public.interval_unit as enum ('day', 'week', 'month', 'year');

-- Per-person: how many days before the due date a task shows up as "due".
alter table public.profiles
  add column maintenance_lead_days integer not null default 7 check (maintenance_lead_days between 0 and 90);

create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households (id) on delete cascade,
  item_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  interval_count integer not null check (interval_count between 1 and 1000),
  interval_unit public.interval_unit not null,
  -- First due date. Without it, the first due date is one interval after creation.
  start_date date,
  last_done_on date,
  -- Maintained by trigger: last done + interval, else start date, else created + interval.
  next_due date not null default current_date,
  snoozed_until date,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade
);

create index maintenance_tasks_due_idx on public.maintenance_tasks (household_id, next_due) where archived_at is null;
create index maintenance_tasks_item_idx on public.maintenance_tasks (item_id) where item_id is not null;
create trigger maintenance_tasks_updated_at before update on public.maintenance_tasks
  for each row execute function public.set_updated_at();

-- History: one row each time a task is marked done.
create table public.maintenance_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households (id) on delete cascade,
  task_id uuid not null,
  done_on date not null,
  note text check (note is null or char_length(note) <= 500),
  actor_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (task_id, household_id) references public.maintenance_tasks (id, household_id) on delete cascade
);

create index maintenance_log_task_idx on public.maintenance_log (task_id, done_on desc);

-- Sent maintenance reminders, per person (see notifications_log).
create table public.maintenance_notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  kind public.alert_kind not null,
  threshold_key text not null,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),
  foreign key (task_id, household_id) references public.maintenance_tasks (id, household_id) on delete cascade,
  constraint maintenance_notifications_log_user_task_key unique (user_id, task_id, kind, threshold_key, channel)
);

create index maintenance_notifications_log_user_idx on public.maintenance_notifications_log (user_id, household_id);

-- ---------------------------------------------------------------------------
-- RLS: same rules as every shared table (see 20261020000001_households.sql).
-- ---------------------------------------------------------------------------

alter table public.maintenance_tasks enable row level security;
alter table public.maintenance_log enable row level security;
alter table public.maintenance_notifications_log enable row level security;

create policy maintenance_tasks_select on public.maintenance_tasks for select to authenticated
  using (household_id = (select public.current_household_id()));
create policy maintenance_tasks_insert on public.maintenance_tasks for insert to authenticated
  with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()));
create policy maintenance_tasks_update on public.maintenance_tasks for update to authenticated
  using (household_id = (select public.current_household_id()) and (select public.can_edit_household()))
  with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()));
create policy maintenance_tasks_delete on public.maintenance_tasks for delete to authenticated
  using (household_id = (select public.current_household_id()) and (select public.can_edit_household()));

-- Append-only history.
create policy maintenance_log_select on public.maintenance_log for select to authenticated
  using (household_id = (select public.current_household_id()));
create policy maintenance_log_insert on public.maintenance_log for insert to authenticated
  with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()));

create policy maintenance_notifications_log_select on public.maintenance_notifications_log for select to authenticated
  using (user_id = (select auth.uid()) and household_id = (select public.current_household_id()));

revoke all on public.maintenance_tasks, public.maintenance_log, public.maintenance_notifications_log from anon;

-- ---------------------------------------------------------------------------
-- Due dates
-- ---------------------------------------------------------------------------

create or replace function public.add_interval(p_from date, p_count integer, p_unit public.interval_unit)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (p_from + case p_unit
    when 'day' then make_interval(days => p_count)
    when 'week' then make_interval(weeks => p_count)
    when 'month' then make_interval(months => p_count)
    else make_interval(years => p_count)
  end)::date
$$;

-- Next due date: one interval after it was last done; before that, the start
-- date; without a start date, one interval after it was created (in the
-- creator's timezone).
create or replace function public.maintenance_compute_due()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_created date;
begin
  if tg_op = 'UPDATE'
     and new.interval_count = old.interval_count
     and new.interval_unit = old.interval_unit
     and new.start_date is not distinct from old.start_date
     and new.last_done_on is not distinct from old.last_done_on then
    new.next_due := old.next_due;
    return new;
  end if;

  if new.last_done_on is not null then
    new.next_due := public.add_interval(new.last_done_on, new.interval_count, new.interval_unit);
  elsif new.start_date is not null then
    new.next_due := new.start_date;
  else
    select (new.created_at at time zone coalesce(p.timezone, 'Asia/Ho_Chi_Minh'))::date into v_created
    from public.profiles p where p.id = auth.uid();
    new.next_due := public.add_interval(coalesce(v_created, new.created_at::date), new.interval_count, new.interval_unit);
  end if;
  return new;
end;
$$;

create trigger maintenance_tasks_due before insert or update on public.maintenance_tasks
  for each row execute function public.maintenance_compute_due();

-- Marks a task done (today in the caller's timezone by default): records it in
-- the task history and, for a task on an item, in the item's history; clears
-- any snooze and moves the next due date. Runs with the caller's rights (RLS).
create or replace function public.complete_maintenance_task(p_task_id uuid, p_done_on date default null, p_note text default null)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_today date;
  v_done date;
  v_task public.maintenance_tasks;
begin
  select public.user_today(p.timezone) into v_today from public.profiles p where p.id = auth.uid();
  v_done := coalesce(p_done_on, v_today, current_date);
  if v_done > coalesce(v_today, current_date) + 1 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  update public.maintenance_tasks
     set last_done_on = v_done, snoozed_until = null
   where id = p_task_id and archived_at is null
  returning * into v_task;
  if v_task.id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  insert into public.maintenance_log (household_id, task_id, done_on, note)
  values (v_task.household_id, v_task.id, v_done, nullif(left(btrim(p_note), 500), ''));

  if v_task.item_id is not null then
    insert into public.item_events (household_id, item_id, type, note)
    values (v_task.household_id, v_task.item_id, 'maintenance', left(v_task.title, 500));
  end if;

  return v_task.next_due;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alerts (single source of truth for maintenance)
-- ---------------------------------------------------------------------------

-- The alert raised by one task, if any:
--   maintenance_overdue (danger) once the due date has passed,
--   maintenance_due (warning) from p_lead_days before it.
-- threshold_key changes with the due date, so each reminder is sent once.
create or replace function public.compute_maintenance_alerts(
  p_task public.maintenance_tasks,
  p_today date,
  p_lead_days integer
)
returns table (kind public.alert_kind, severity smallint, due_date date, days_left integer, threshold_key text)
language sql
stable
-- No SET clause, so it can be inlined (see compute_item_alerts).
as $$
  select
    case when (p_task).next_due < p_today then 'maintenance_overdue' else 'maintenance_due' end::public.alert_kind,
    case when (p_task).next_due < p_today then 3 else 2 end::smallint,
    (p_task).next_due,
    (p_task).next_due - p_today,
    (p_task).next_due::text || case when (p_task).next_due < p_today then ':over' else ':due' end
  where (p_task).archived_at is null and (p_task).next_due <= p_today + p_lead_days
$$;

-- Maintenance alerts in a person's active household (see user_item_alerts).
create or replace function public.user_maintenance_alerts(p_user_id uuid)
returns table (
  household_id uuid,
  task_id uuid,
  title text,
  item_id uuid,
  item_name text,
  interval_count integer,
  interval_unit public.interval_unit,
  kind public.alert_kind,
  severity smallint,
  due_date date,
  days_left integer,
  threshold_key text,
  snoozed boolean,
  snoozed_until date
)
language sql
stable
as $$
  select
    t.household_id,
    t.id,
    t.title,
    t.item_id,
    i.name,
    t.interval_count,
    t.interval_unit,
    a.kind,
    a.severity,
    a.due_date,
    a.days_left,
    a.threshold_key,
    (t.snoozed_until is not null and t.snoozed_until >= d.today),
    t.snoozed_until
  from public.profiles p
  join public.household_members m on m.household_id = p.active_household_id and m.user_id = p.id
  join public.maintenance_tasks t on t.household_id = p.active_household_id
  left join public.items i on i.id = t.item_id
  cross join lateral (select public.user_today(p.timezone) as today) d
  cross join lateral public.compute_maintenance_alerts(t, d.today, p.maintenance_lead_days) a
  where p.id = p_user_id
    and t.archived_at is null
    and t.next_due <= d.today + p.maintenance_lead_days
$$;

create view public.maintenance_alerts
with (security_invoker = true)
as
select * from public.user_maintenance_alerts(auth.uid());

grant select on public.maintenance_alerts to authenticated;
revoke all on function public.user_maintenance_alerts(uuid) from public, anon;
grant execute on function public.user_maintenance_alerts(uuid) to authenticated, service_role;
revoke all on function public.complete_maintenance_task(uuid, date, text) from public, anon;
grant execute on function public.complete_maintenance_task(uuid, date, text) to authenticated;

-- Dashboard counts include maintenance.
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
  ),
  malerts as (
    select m.* from public.maintenance_alerts m
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
    'maintenance_due', (select count(*) from malerts where not snoozed),
    'maintenance_overdue', (select count(*) from malerts where not snoozed and kind = 'maintenance_overdue'),
    'attention', (select count(distinct item_id) from alerts where not snoozed)
               + (select count(*) from galerts where not snoozed)
               + (select count(*) from malerts where not snoozed)
  )
$$;
