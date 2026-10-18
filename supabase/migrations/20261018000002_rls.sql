-- Row Level Security: a user only ever sees and changes their own rows.
-- Composite foreign keys (id, user_id) in 0001 additionally stop a row from
-- referencing another user's category/location/item/tag.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.item_events enable row level security;
alter table public.shopping_list enable row level security;
alter table public.alert_snoozes enable row level security;
alter table public.notifications_log enable row level security;
alter table public.push_subscriptions enable row level security;

-- Profiles are created by the signup trigger; users read and update their own.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Generic owner policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'items', 'item_photos', 'tags', 'item_tags',
    'shopping_list', 'alert_snoozes', 'push_subscriptions'
  ] loop
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- History is append-only from the user's point of view (written by triggers).
create policy item_events_select on public.item_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy item_events_insert on public.item_events for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Notification log is written by the scheduled job (service role) only.
create policy notifications_log_select on public.notifications_log for select to authenticated
  using (user_id = (select auth.uid()));

-- Nothing is exposed to anonymous visitors.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Single-user signup allowlist.
-- When private.signup_allowlist has rows, only those emails may sign up.
-- An empty table allows any signup (convenient for local development).
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.signup_allowlist (
  email text primary key check (email = lower(email))
);

create or replace function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.signup_allowlist)
     and not exists (select 1 from private.signup_allowlist where email = lower(new.email)) then
    raise exception 'signup_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_signup_allowlist before insert on auth.users
  for each row execute function private.enforce_signup_allowlist();
