-- Stowly core schema: tables, constraints, indexes.
-- Every user-owned table carries user_id and is protected by RLS (see 0002).

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- unaccent() is only STABLE; wrap it with an explicit dictionary so it can be
-- used in indexes and generated values. Vietnamese "đ/Đ" is covered by the
-- default unaccent rules.
create or replace function public.f_unaccent(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

-- Normalised form used for every search comparison: lowercase, no accents,
-- collapsed whitespace.
create or replace function public.normalize_search(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(public.f_unaccent(coalesce(input, ''))), '\s+', ' ', 'g'))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Internal maintenance updates (search refresh) must not bump updated_at.
  if coalesce(current_setting('stowly.skip_touch', true), '') = '1' then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.item_condition as enum ('new', 'good', 'worn', 'broken', 'given_away');
create type public.item_event_type as enum ('created', 'quantity_change', 'moved', 'status_change');
create type public.alert_kind as enum (
  'expired', 'expiring_soon', 'out_of_stock', 'low_stock',
  'warranty_ending', 'replace_due', 'lent_overdue'
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  expiry_lead_days integer[] not null default '{30,7,1}'
    check (cardinality(expiry_lead_days) between 1 and 6 and 0 < all (expiry_lead_days) and 366 > all (expiry_lead_days)),
  warranty_lead_days integer not null default 30 check (warranty_lead_days between 1 and 365),
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  digest_hour smallint not null default 7 check (digest_hour between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

-- Built-in rows have builtin_key set and are seeded with both a Vietnamese
-- (name) and English (name_en) label. User-created rows store the name as typed.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  builtin_key text,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 1 and 80),
  icon text not null default 'package' check (char_length(icon) <= 40),
  default_attributes jsonb not null default '[]'::jsonb check (jsonb_typeof(default_attributes) = 'array'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, builtin_key)
);

create index categories_user_idx on public.categories (user_id, sort_order);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Locations (tree)
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid,
  builtin_key text,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 1 and 80),
  sort_order integer not null default 0,
  -- Maintained by trigger (0003): ancestor chain including self, and display paths.
  path_ids uuid[] not null default '{}',
  path_text text not null default '',
  path_text_en text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.locations (id, user_id) on delete restrict,
  check (parent_id is null or parent_id <> id)
);

create index locations_user_idx on public.locations (user_id, parent_id, sort_order);
create index locations_path_ids_idx on public.locations using gin (path_ids);
create trigger locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  category_id uuid,
  location_id uuid,
  quantity numeric(12, 3) not null default 1 check (quantity >= 0),
  unit text check (unit is null or char_length(unit) <= 20),
  min_quantity numeric(12, 3) check (min_quantity is null or min_quantity >= 0),
  condition public.item_condition not null default 'good',
  purchase_date date,
  purchase_price numeric(14, 2) check (purchase_price is null or purchase_price >= 0),
  purchase_place text check (purchase_place is null or char_length(purchase_place) <= 200),
  expiry_date date,
  opened_date date,
  warranty_until date,
  replace_after_months integer check (replace_after_months is null or replace_after_months between 1 and 600),
  last_replaced_at date,
  notes text check (notes is null or char_length(notes) <= 5000),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Maintained by trigger (0003).
  search_vector tsvector not null default ''::tsvector,
  search_text text not null default '',
  name_norm text generated always as (public.normalize_search(name)) stored,
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (location_id, user_id) references public.locations (id, user_id) on delete set null (location_id)
);

create index items_user_active_idx on public.items (user_id, updated_at desc) where archived_at is null;
create index items_category_idx on public.items (category_id);
create index items_location_idx on public.items (location_id);
create index items_expiry_idx on public.items (user_id, expiry_date) where expiry_date is not null and archived_at is null;
create index items_search_vector_idx on public.items using gin (search_vector);
create index items_search_text_trgm_idx on public.items using gin (search_text extensions.gin_trgm_ops);
create index items_name_sort_idx on public.items (user_id, lower(name));
create index items_name_norm_trgm_idx on public.items using gin (name_norm extensions.gin_trgm_ops);

create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  storage_path text not null unique,
  thumb_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

create index item_photos_item_idx on public.item_photos (item_id, sort_order);

-- Max 5 photos per item.
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.item_photos where item_id = new.item_id) >= 5 then
    raise exception 'photo_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger item_photos_limit before insert on public.item_photos
  for each row execute function public.enforce_photo_limit();

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index tags_user_name_idx on public.tags (user_id, lower(name));

create table public.item_tags (
  item_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (item_id, tag_id),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create index item_tags_tag_idx on public.item_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Item events (history)
-- ---------------------------------------------------------------------------

create table public.item_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  type public.item_event_type not null,
  delta numeric(12, 3),
  quantity_after numeric(12, 3),
  from_location_id uuid,
  to_location_id uuid,
  from_condition public.item_condition,
  to_condition public.item_condition,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

create index item_events_item_idx on public.item_events (item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Shopping list
-- ---------------------------------------------------------------------------

create table public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit text check (unit is null or char_length(unit) <= 20),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete set null (item_id)
);

create index shopping_list_user_idx on public.shopping_list (user_id, done, created_at desc);
-- At most one open entry per linked item.
create unique index shopping_list_open_item_idx on public.shopping_list (item_id) where item_id is not null and not done;

-- ---------------------------------------------------------------------------
-- Alerts: snoozes, notification log, push subscriptions
-- ---------------------------------------------------------------------------

create table public.alert_snoozes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  kind public.alert_kind not null,
  until date not null,
  created_at timestamptz not null default now(),
  primary key (item_id, kind),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade
);

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null,
  kind public.alert_kind not null,
  -- Identifies the threshold that was crossed, e.g. "2026-11-01:7" for an
  -- expiry 7-day reminder. A new expiry date or threshold produces a new key.
  threshold_key text not null,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete cascade,
  unique (item_id, kind, threshold_key, channel)
);

create index notifications_log_user_idx on public.notifications_log (user_id, sent_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
