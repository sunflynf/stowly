-- Households: data belongs to a household instead of a single user.
--
-- Migration of existing data: every existing user gets a household whose id is
-- their own user id, with them as owner. Renaming user_id -> household_id then
-- keeps every value, every composite (id, household_id) foreign key and every
-- storage path ("<household_id>/<item_id>/...") valid: no row is rewritten.
-- New households get random ids.
--
-- Per-person data stays per user: profiles (language, timezone, digest, lead
-- days), push subscriptions and the notification logs (who was told what).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.household_role as enum ('owner', 'editor', 'viewer');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  -- Null = show the default "<owner>'s home" label in the UI.
  name text check (name is null or char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.household_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  role public.household_role not null default 'editor' check (role <> 'owner'),
  -- sha256 (hex) of the secret token sent in the link; the token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One open invite per email and household (re-inviting replaces it).
create unique index household_invites_open_idx on public.household_invites (household_id, email) where accepted_at is null;
create index household_invites_email_idx on public.household_invites (email) where accepted_at is null;

alter table public.profiles
  add column active_household_id uuid references public.households (id) on delete set null,
  add column display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 60);

-- ---------------------------------------------------------------------------
-- Existing users -> one household each (id = user id), owner role.
-- ---------------------------------------------------------------------------

insert into public.households (id, created_at)
select u.id, u.created_at from auth.users u;

insert into public.household_members (household_id, user_id, role, joined_at)
select u.id, u.id, 'owner', u.created_at from auth.users u;

update public.profiles set active_household_id = id;

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer: they read household_members without
-- recursing into its own policies). Wrapped in (select ...) inside policies so
-- Postgres evaluates them once per statement, not once per row.
-- ---------------------------------------------------------------------------

-- The caller's active household, only while they are still a member of it.
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.profiles p
  join public.household_members m on m.household_id = p.active_household_id and m.user_id = p.id
  where p.id = auth.uid()
$$;

create or replace function public.current_household_role()
returns public.household_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.profiles p
  join public.household_members m on m.household_id = p.active_household_id and m.user_id = p.id
  where p.id = auth.uid()
$$;

create or replace function public.can_edit_household()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_household_role() in ('owner', 'editor'), false)
$$;

create or replace function public.is_household_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_household_role() = 'owner', false)
$$;

-- Every household the caller belongs to (for the household switcher).
create or replace function public.my_household_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.household_id), '{}') from public.household_members m where m.user_id = auth.uid()
$$;

revoke all on function public.current_household_id() from public, anon;
revoke all on function public.current_household_role() from public, anon;
revoke all on function public.can_edit_household() from public, anon;
revoke all on function public.is_household_owner() from public, anon;
revoke all on function public.my_household_ids() from public, anon;
grant execute on function public.current_household_id() to authenticated, service_role;
grant execute on function public.current_household_role() to authenticated, service_role;
grant execute on function public.can_edit_household() to authenticated, service_role;
grant execute on function public.is_household_owner() to authenticated, service_role;
grant execute on function public.my_household_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- user_id -> household_id on every shared table
-- ---------------------------------------------------------------------------

-- Views and policies are rebuilt below.
drop view public.group_alerts;
drop view public.item_group_stats;
drop view public.item_alerts;

drop policy categories_owner on public.categories;
drop policy locations_owner on public.locations;
drop policy items_owner on public.items;
drop policy item_photos_owner on public.item_photos;
drop policy tags_owner on public.tags;
drop policy item_tags_owner on public.item_tags;
drop policy shopping_list_owner on public.shopping_list;
drop policy alert_snoozes_owner on public.alert_snoozes;
drop policy item_groups_owner on public.item_groups;
drop policy suggestion_dismissals_owner on public.suggestion_dismissals;
drop policy item_events_select on public.item_events;
drop policy item_events_insert on public.item_events;
drop policy notifications_log_select on public.notifications_log;
drop policy group_notifications_log_select on public.group_notifications_log;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'items', 'item_photos', 'tags', 'item_tags', 'item_events',
    'shopping_list', 'alert_snoozes', 'notifications_log', 'item_groups',
    'group_notifications_log', 'suggestion_dismissals'
  ] loop
    execute format('alter table public.%I rename column user_id to household_id', t);
    execute format('alter table public.%I drop constraint %I', t, t || '_user_id_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (household_id) references public.households (id) on delete cascade',
      t, t || '_household_id_fkey');
    execute format('alter table public.%I alter column household_id set default public.current_household_id()', t);
  end loop;
end;
$$;

-- Notification logs stay per person: who was told about what.
alter table public.notifications_log add column user_id uuid references auth.users (id) on delete cascade;
update public.notifications_log set user_id = household_id;
alter table public.notifications_log alter column user_id set not null;
alter table public.notifications_log alter column household_id drop default;
alter table public.notifications_log drop constraint notifications_log_item_id_kind_threshold_key_channel_key;
alter table public.notifications_log
  add constraint notifications_log_user_item_key unique (user_id, item_id, kind, threshold_key, channel);
drop index public.notifications_log_user_idx;
create index notifications_log_user_idx on public.notifications_log (user_id, household_id);

alter table public.group_notifications_log add column user_id uuid references auth.users (id) on delete cascade;
update public.group_notifications_log set user_id = household_id;
alter table public.group_notifications_log alter column user_id set not null;
alter table public.group_notifications_log alter column household_id drop default;
alter table public.group_notifications_log drop constraint group_notifications_log_group_id_kind_threshold_key_channel_key;
alter table public.group_notifications_log
  add constraint group_notifications_log_user_group_key unique (user_id, group_id, kind, threshold_key, channel);
create index group_notifications_log_user_idx on public.group_notifications_log (user_id, household_id);

-- History records who made each change. Existing events were made by the
-- only member of the household at the time: its original user.
alter table public.item_events
  add column actor_id uuid references auth.users (id) on delete set null default auth.uid();
update public.item_events e set actor_id = e.household_id
where exists (select 1 from auth.users u where u.id = e.household_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Read: rows of the caller's active household (membership is re-checked by
-- current_household_id()). Write: same, and the caller is owner or editor.
-- Composite foreign keys (id, household_id) still stop a row from referencing
-- another household's category/location/item/tag/group.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'items', 'item_photos', 'tags', 'item_tags', 'item_events',
    'shopping_list', 'alert_snoozes', 'item_groups', 'suggestion_dismissals'
  ] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (household_id = (select public.current_household_id()))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated
         with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()))', t);
    -- item_events is append-only.
    if t <> 'item_events' then
      execute format(
        'create policy %1$s_update on public.%1$s for update to authenticated
           using (household_id = (select public.current_household_id()) and (select public.can_edit_household()))
           with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()))', t);
      execute format(
        'create policy %1$s_delete on public.%1$s for delete to authenticated
           using (household_id = (select public.current_household_id()) and (select public.can_edit_household()))', t);
    end if;
  end loop;
end;
$$;

-- Notification logs: written by the scheduled job (service role); each person reads their own.
create policy notifications_log_select on public.notifications_log for select to authenticated
  using (user_id = (select auth.uid()) and household_id = (select public.current_household_id()));
create policy group_notifications_log_select on public.group_notifications_log for select to authenticated
  using (user_id = (select auth.uid()) and household_id = (select public.current_household_id()));

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- Members see every household they belong to; only the owner renames the active one.
create policy households_select on public.households for select to authenticated
  using (id in (select unnest(public.my_household_ids())));
create policy households_update on public.households for update to authenticated
  using (id = (select public.current_household_id()) and (select public.is_household_owner()))
  with check (id = (select public.current_household_id()) and (select public.is_household_owner()));

-- Members see the member list of their households. The owner changes roles and
-- removes members of the active household; anyone can remove themselves (leave).
-- New members only arrive through accept_household_invite().
create policy household_members_select on public.household_members for select to authenticated
  using (household_id in (select unnest(public.my_household_ids())));
create policy household_members_update on public.household_members for update to authenticated
  using (household_id = (select public.current_household_id()) and (select public.is_household_owner()))
  with check (household_id = (select public.current_household_id()) and (select public.is_household_owner()));
create policy household_members_delete on public.household_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (household_id = (select public.current_household_id()) and (select public.is_household_owner()))
  );

create policy household_invites_select on public.household_invites for select to authenticated
  using (household_id = (select public.current_household_id()) and (select public.is_household_owner()));
create policy household_invites_insert on public.household_invites for insert to authenticated
  with check (household_id = (select public.current_household_id()) and (select public.is_household_owner()));
create policy household_invites_delete on public.household_invites for delete to authenticated
  using (household_id = (select public.current_household_id()) and (select public.is_household_owner()));

alter table public.household_invites alter column household_id set default public.current_household_id();

revoke all on public.households, public.household_members, public.household_invites from anon;

-- ---------------------------------------------------------------------------
-- Membership rules
-- ---------------------------------------------------------------------------

-- A household always keeps at least one owner. When the last owner's account
-- itself is deleted, the longest-standing remaining member becomes owner.
create or replace function private.household_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.household_id <> old.household_id or new.user_id <> old.user_id) then
    raise exception 'member_immutable' using errcode = 'P0001';
  end if;

  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.household_members m
       where m.household_id = old.household_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    -- Account deletion (cascade): the auth.users row is already gone.
    if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
      return old;
    end if;
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger household_members_guard before update or delete on public.household_members
  for each row execute function private.household_members_guard();

-- Creates a household with the given owner, seeded with the default categories
-- and locations, and makes it their active household.
create or replace function private.create_household(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.households default values returning id into v_id;
  insert into public.household_members (household_id, user_id, role) values (v_id, p_owner, 'owner');
  perform private.seed_household_defaults(v_id);
  update public.profiles set active_household_id = v_id where id = p_owner;
  return v_id;
end;
$$;

-- After someone leaves or is removed:
--  * an empty household is deleted with all its data;
--  * if the last owner's account was deleted, the longest-standing member becomes owner;
--  * the person's active household moves to another one they belong to, or a
--    fresh household of their own, so they are never left without one.
create or replace function private.household_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  if not exists (select 1 from public.household_members m where m.household_id = old.household_id) then
    delete from public.households where id = old.household_id;
  elsif not exists (select 1 from public.household_members m where m.household_id = old.household_id and m.role = 'owner') then
    update public.household_members set role = 'owner'
    where household_id = old.household_id
      and user_id = (select m.user_id from public.household_members m
                     where m.household_id = old.household_id order by m.joined_at, m.user_id limit 1);
  end if;

  if exists (select 1 from auth.users u where u.id = old.user_id)
     and exists (select 1 from public.profiles p where p.id = old.user_id
                 and (p.active_household_id is null or p.active_household_id = old.household_id)) then
    select m.household_id into v_next from public.household_members m
    where m.user_id = old.user_id order by m.joined_at limit 1;
    if v_next is null then
      perform private.create_household(old.user_id);
    else
      update public.profiles set active_household_id = v_next where id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger household_members_after_delete after delete on public.household_members
  for each row execute function private.household_members_after_delete();

-- The active household must be one the person belongs to.
create or replace function private.profiles_check_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active_household_id is not null
     and new.active_household_id is distinct from old.active_household_id
     and not exists (select 1 from public.household_members m
                     where m.household_id = new.active_household_id and m.user_id = new.id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_check_household before update of active_household_id on public.profiles
  for each row execute function private.profiles_check_household();

-- ---------------------------------------------------------------------------
-- Member list, household list, invites
-- ---------------------------------------------------------------------------

-- Display label: the chosen display name, else the part of the email before "@".
create or replace function private.person_label(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.display_name, split_part(u.email, '@', 1))
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = p_user_id
$$;

-- Members of the caller's active household.
create or replace function public.household_member_list()
returns table (user_id uuid, role public.household_role, email text, display_name text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, u.email::text, private.person_label(m.user_id), m.joined_at
  from public.household_members m
  join auth.users u on u.id = m.user_id
  where m.household_id = public.current_household_id()
  order by (m.role = 'owner') desc, m.joined_at, m.user_id
$$;

-- Every household the caller belongs to, for the switcher.
create or replace function public.my_households()
returns table (id uuid, name text, owner_name text, role public.household_role, members integer, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name,
    (select private.person_label(o.user_id) from public.household_members o
     where o.household_id = h.id and o.role = 'owner' order by o.joined_at limit 1),
    m.role,
    (select count(*)::integer from public.household_members c where c.household_id = h.id),
    h.id = public.current_household_id()
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = auth.uid()
  order by m.joined_at, h.id
$$;

-- What an invite link is about, shown before signing in or accepting.
create or replace function public.household_invite_preview(p_token text)
returns table (household_name text, owner_name text, inviter_name text, email text, role public.household_role, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name,
    (select private.person_label(o.user_id) from public.household_members o
     where o.household_id = h.id and o.role = 'owner' order by o.joined_at limit 1),
    private.person_label(i.invited_by),
    i.email,
    i.role,
    case when i.accepted_at is not null then 'accepted'
         when i.expires_at <= now() then 'expired'
         else 'pending' end
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

-- Joins the household of a valid invite addressed to the caller's email and
-- makes it their active household. Returns the household id.
create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invite public.household_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();

  select * into v_invite from public.household_invites
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite_used' using errcode = 'P0001';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  if v_invite.email <> v_email then
    raise exception 'invite_wrong_email' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, auth.uid(), v_invite.role)
  on conflict (household_id, user_id) do nothing;

  update public.household_invites set accepted_at = now(), accepted_by = auth.uid() where id = v_invite.id;
  update public.profiles set active_household_id = v_invite.household_id where id = auth.uid();
  return v_invite.household_id;
end;
$$;

revoke all on function public.household_member_list() from public, anon;
revoke all on function public.my_households() from public, anon;
revoke all on function public.accept_household_invite(text) from public, anon;
grant execute on function public.household_member_list() to authenticated;
grant execute on function public.my_households() to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
-- The invite page is reachable signed out; the token is the secret.
grant execute on function public.household_invite_preview(text) to anon, authenticated;
revoke all on function private.person_label(uuid) from public;

-- An open invite also allows signing up when the signup allowlist is in use.
create or replace function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.signup_allowlist)
     and not exists (select 1 from private.signup_allowlist where email = lower(new.email))
     and not exists (select 1 from public.household_invites i
                     where i.email = lower(new.email) and i.accepted_at is null and i.expires_at > now()) then
    raise exception 'signup_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Defaults for new households and users
-- ---------------------------------------------------------------------------

drop function private.seed_user_defaults(uuid);

create or replace function private.seed_household_defaults(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bedroom uuid;
  v_kitchen uuid;
  v_living uuid;
begin
  insert into public.categories (household_id, builtin_key, name, name_en, icon, sort_order, default_attributes) values
    (p_household_id, 'clothing', 'Quần áo, giày dép', 'Clothing & shoes', 'shirt', 10, '[
      {"key":"size","type":"text","label_vi":"Kích cỡ","label_en":"Size"},
      {"key":"color","type":"text","label_vi":"Màu sắc","label_en":"Color"},
      {"key":"season","type":"select","label_vi":"Mùa","label_en":"Season","options":[
        {"value":"summer","label_vi":"Mùa hè","label_en":"Summer"},
        {"value":"winter","label_vi":"Mùa đông","label_en":"Winter"},
        {"value":"all","label_vi":"Quanh năm","label_en":"All year"}]}
    ]'),
    (p_household_id, 'bedding', 'Chăn ga gối nệm', 'Bedding', 'bed-double', 20, '[
      {"key":"size","type":"text","label_vi":"Kích thước","label_en":"Size"},
      {"key":"material","type":"text","label_vi":"Chất liệu","label_en":"Material"}
    ]'),
    (p_household_id, 'electronics', 'Điện tử', 'Electronics', 'laptop', 30, '[
      {"key":"brand","type":"text","label_vi":"Hãng","label_en":"Brand"},
      {"key":"model","type":"text","label_vi":"Model","label_en":"Model"},
      {"key":"serial","type":"text","label_vi":"Số serial","label_en":"Serial number"}
    ]'),
    (p_household_id, 'stationery', 'Văn phòng phẩm', 'Stationery', 'pencil', 40, '[
      {"key":"color","type":"text","label_vi":"Màu sắc","label_en":"Color"}
    ]'),
    (p_household_id, 'books', 'Sách', 'Books', 'book-open', 50, '[
      {"key":"author","type":"text","label_vi":"Tác giả","label_en":"Author"},
      {"key":"read_status","type":"select","label_vi":"Tình trạng đọc","label_en":"Read status","options":[
        {"value":"unread","label_vi":"Chưa đọc","label_en":"Unread"},
        {"value":"reading","label_vi":"Đang đọc","label_en":"Reading"},
        {"value":"read","label_vi":"Đã đọc","label_en":"Read"}]},
      {"key":"lent_to","type":"text","label_vi":"Cho mượn","label_en":"Lent to"},
      {"key":"lent_due","type":"date","label_vi":"Hẹn trả","label_en":"Due back"}
    ]'),
    (p_household_id, 'food', 'Thực phẩm dự trữ', 'Stockpiled food', 'apple', 60, '[]'),
    (p_household_id, 'household', 'Gia dụng & khác', 'Household & misc', 'house', 70, '[]')
  on conflict (household_id, builtin_key) do nothing;

  if exists (select 1 from public.locations where household_id = p_household_id) then
    return;
  end if;

  insert into public.locations (household_id, builtin_key, name, name_en, sort_order)
    values (p_household_id, 'living_room', 'Phòng khách', 'Living room', 10) returning id into v_living;
  insert into public.locations (household_id, builtin_key, name, name_en, sort_order)
    values (p_household_id, 'bedroom', 'Phòng ngủ', 'Bedroom', 20) returning id into v_bedroom;
  insert into public.locations (household_id, builtin_key, name, name_en, sort_order)
    values (p_household_id, 'kitchen', 'Nhà bếp', 'Kitchen', 30) returning id into v_kitchen;
  insert into public.locations (household_id, builtin_key, name, name_en, sort_order) values
    (p_household_id, 'bathroom', 'Phòng tắm', 'Bathroom', 40),
    (p_household_id, 'desk', 'Bàn làm việc', 'Desk', 50),
    (p_household_id, 'storage', 'Kho', 'Storage room', 60);
  insert into public.locations (household_id, parent_id, builtin_key, name, name_en, sort_order) values
    (p_household_id, v_bedroom, 'wardrobe', 'Tủ quần áo', 'Wardrobe', 10),
    (p_household_id, v_kitchen, 'fridge', 'Tủ lạnh', 'Fridge', 10),
    (p_household_id, v_kitchen, 'kitchen_shelf', 'Kệ bếp', 'Kitchen shelf', 20),
    (p_household_id, v_living, 'tv_cabinet', 'Tủ TV', 'TV cabinet', 10);
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'vi');
begin
  insert into public.profiles (id, locale)
  values (new.id, case when v_locale in ('vi', 'en') then v_locale else 'vi' end)
  on conflict (id) do nothing;
  perform private.create_household(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- History: who made each change
-- ---------------------------------------------------------------------------

create or replace function public.items_log_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(current_setting('stowly.event_note', true), '');
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.item_events (household_id, actor_id, item_id, type, delta, quantity_after, to_location_id, to_condition, note)
    values (new.household_id, v_actor, new.id, 'created', new.quantity, new.quantity, new.location_id, new.condition, v_note);
    return null;
  end if;

  if new.quantity is distinct from old.quantity then
    insert into public.item_events (household_id, actor_id, item_id, type, delta, quantity_after, note)
    values (new.household_id, v_actor, new.id, 'quantity_change', new.quantity - old.quantity, new.quantity, v_note);
  end if;

  if new.location_id is distinct from old.location_id then
    insert into public.item_events (household_id, actor_id, item_id, type, from_location_id, to_location_id, note)
    values (new.household_id, v_actor, new.id, 'moved', old.location_id, new.location_id, v_note);
  end if;

  if new.condition is distinct from old.condition then
    insert into public.item_events (household_id, actor_id, item_id, type, from_condition, to_condition, note)
    values (new.household_id, v_actor, new.id, 'status_change', old.condition, new.condition, v_note);
  end if;

  return null;
end;
$$;

-- Names of everyone who appears in the active household's history, including
-- people who have since left (shown as-is; their account may still exist).
create or replace function public.household_people()
returns table (user_id uuid, display_name text, is_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with h as (select public.current_household_id() as id)
  select x.uid, private.person_label(x.uid),
    exists (select 1 from public.household_members m, h where m.household_id = h.id and m.user_id = x.uid)
  from (
    select m.user_id as uid from public.household_members m, h where m.household_id = h.id
    union
    select distinct e.actor_id from public.item_events e, h where e.household_id = h.id and e.actor_id is not null
  ) x
  where x.uid is not null
$$;

revoke all on function public.household_people() from public, anon;
grant execute on function public.household_people() to authenticated;

-- ---------------------------------------------------------------------------
-- Alerts, per person: settings (timezone, lead days) come from the person,
-- items from their active household.
-- ---------------------------------------------------------------------------

-- Every alert raised in a person's active household. Called by the item_alerts
-- view (for the signed-in user) and by the digest (service role, per person).
-- Security invoker and inlinable: for a signed-in caller RLS on profiles and
-- items limits it to their own profile and household.
create or replace function public.user_item_alerts(p_user_id uuid)
returns table (
  household_id uuid,
  item_id uuid,
  name text,
  quantity numeric,
  unit text,
  min_quantity numeric,
  replace_after_months integer,
  category_id uuid,
  location_id uuid,
  location_path text,
  location_path_en text,
  kind public.alert_kind,
  severity smallint,
  due_date date,
  days_left integer,
  threshold_key text,
  snoozed boolean,
  snoozed_until date,
  thumb_path text
)
language sql
stable
-- No SET clause (inlining); every name is schema-qualified.
as $$
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
         or i.attributes ? 'lent_to')
$$;

create view public.item_alerts
with (security_invoker = true)
as
select * from public.user_item_alerts(auth.uid());

grant select on public.item_alerts to authenticated;

create view public.item_group_stats
with (security_invoker = true)
as
select
  g.id,
  g.household_id,
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

create or replace function public.user_group_alerts(p_user_id uuid)
returns table (
  household_id uuid,
  group_id uuid,
  name text,
  unit text,
  min_quantity numeric,
  total numeric,
  members integer,
  kind public.alert_kind,
  severity smallint,
  threshold_key text,
  snoozed boolean,
  snoozed_until date
)
language sql
stable
as $$
  select
    s.household_id,
    s.id,
    s.name,
    s.unit,
    s.min_quantity,
    s.total,
    s.members,
    case when s.total = 0 then 'out_of_stock' else 'low_stock' end::public.alert_kind,
    case when s.total = 0 then 3 else 2 end::smallint,
    case when s.total = 0 then 'out' else 'low' end,
    (s.snoozed_until is not null and s.snoozed_until >= public.user_today(p.timezone)),
    s.snoozed_until
  from public.profiles p
  join public.household_members m on m.household_id = p.active_household_id and m.user_id = p.id
  join public.item_group_stats s on s.household_id = p.active_household_id
  where p.id = p_user_id and s.min_quantity is not null and s.total <= s.min_quantity
$$;

create view public.group_alerts
with (security_invoker = true)
as
select * from public.user_group_alerts(auth.uid());

grant select on public.group_alerts to authenticated;

-- The per-person functions are for the signed-in user (through the views) and
-- the scheduled job; anonymous callers get nothing.
revoke all on function public.user_item_alerts(uuid) from public, anon;
revoke all on function public.user_group_alerts(uuid) from public, anon;
grant execute on function public.user_item_alerts(uuid) to authenticated, service_role;
grant execute on function public.user_group_alerts(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: "<household_id>/<item_id>/<file>"; members read, editors write.
-- ---------------------------------------------------------------------------

drop policy item_photos_read on storage.objects;
drop policy item_photos_insert on storage.objects;
drop policy item_photos_update on storage.objects;
drop policy item_photos_delete on storage.objects;

create policy item_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select public.current_household_id())::text);

create policy item_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select public.current_household_id())::text
              and (select public.can_edit_household()));

create policy item_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select public.current_household_id())::text
         and (select public.can_edit_household()));

create policy item_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select public.current_household_id())::text
         and (select public.can_edit_household()));
