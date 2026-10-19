-- Derived data maintained by triggers: location paths, item search documents,
-- item history events, and per-user defaults on signup.

-- ---------------------------------------------------------------------------
-- Location paths
-- ---------------------------------------------------------------------------

create or replace function public.locations_compute_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.locations;
begin
  if new.parent_id is null then
    new.path_ids := array[new.id];
    new.path_text := new.name;
    new.path_text_en := coalesce(new.name_en, new.name);
  else
    select * into parent from public.locations where id = new.parent_id;
    if not found then
      raise exception 'location_parent_not_found' using errcode = 'P0001';
    end if;
    if new.id = any (parent.path_ids) then
      raise exception 'location_cycle' using errcode = 'P0001';
    end if;
    if cardinality(parent.path_ids) >= 6 then
      raise exception 'location_too_deep' using errcode = 'P0001';
    end if;
    new.path_ids := parent.path_ids || new.id;
    new.path_text := parent.path_text || ' › ' || new.name;
    new.path_text_en := parent.path_text_en || ' › ' || coalesce(new.name_en, new.name);
  end if;
  return new;
end;
$$;

create trigger locations_path before insert or update on public.locations
  for each row execute function public.locations_compute_path();

-- When a location's path changes, cascade to children (whose BEFORE trigger
-- recomputes from this row) and refresh the search documents of its items.
create or replace function public.locations_cascade_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.path_text is distinct from old.path_text
     or new.path_text_en is distinct from old.path_text_en
     or new.path_ids is distinct from old.path_ids then
    update public.locations set path_text = path_text where parent_id = new.id;
    perform public.refresh_item_search(array(select id from public.items where location_id = new.id));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Item search document
-- ---------------------------------------------------------------------------

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
begin
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
    || setweight(to_tsvector('simple', public.normalize_search(concat_ws(' ', v_category, v_location))), 'C')
    || setweight(to_tsvector('simple', public.normalize_search(concat_ws(' ', new.notes, v_attrs, new.purchase_place))), 'D');

  new.search_text := public.normalize_search(concat_ws(' ', new.name, v_tags, v_category, v_location));
  return new;
end;
$$;

create trigger items_search before insert or update on public.items
  for each row execute function public.items_compute_search();

-- Recompute search documents without bumping updated_at or logging events.
create or replace function public.refresh_item_search(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  prev text := coalesce(current_setting('stowly.skip_touch', true), '');
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;
  perform set_config('stowly.skip_touch', '1', true);
  update public.items set search_text = search_text where id = any (p_ids);
  perform set_config('stowly.skip_touch', prev, true);
end;
$$;

create trigger locations_cascade after update on public.locations
  for each row execute function public.locations_cascade_path();

create or replace function public.item_tags_refresh()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_item_search(array[coalesce(new.item_id, old.item_id)]);
  return null;
end;
$$;

create trigger item_tags_refresh after insert or delete on public.item_tags
  for each row execute function public.item_tags_refresh();

create or replace function public.tags_refresh()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    perform public.refresh_item_search(array(select item_id from public.item_tags where tag_id = new.id));
  end if;
  return null;
end;
$$;

create trigger tags_refresh after update on public.tags
  for each row execute function public.tags_refresh();

create or replace function public.categories_refresh()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name or new.name_en is distinct from old.name_en then
    perform public.refresh_item_search(array(select id from public.items where category_id = new.id));
  end if;
  return null;
end;
$$;

create trigger categories_refresh after update on public.categories
  for each row execute function public.categories_refresh();

-- ---------------------------------------------------------------------------
-- Item history events
-- ---------------------------------------------------------------------------

create or replace function public.items_log_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(current_setting('stowly.event_note', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.item_events (user_id, item_id, type, delta, quantity_after, to_location_id, to_condition, note)
    values (new.user_id, new.id, 'created', new.quantity, new.quantity, new.location_id, new.condition, v_note);
    return null;
  end if;

  if new.quantity is distinct from old.quantity then
    insert into public.item_events (user_id, item_id, type, delta, quantity_after, note)
    values (new.user_id, new.id, 'quantity_change', new.quantity - old.quantity, new.quantity, v_note);
  end if;

  if new.location_id is distinct from old.location_id then
    insert into public.item_events (user_id, item_id, type, from_location_id, to_location_id, note)
    values (new.user_id, new.id, 'moved', old.location_id, new.location_id, v_note);
  end if;

  if new.condition is distinct from old.condition then
    insert into public.item_events (user_id, item_id, type, from_condition, to_condition, note)
    values (new.user_id, new.id, 'status_change', old.condition, new.condition, v_note);
  end if;

  return null;
end;
$$;

create trigger items_events after insert or update on public.items
  for each row execute function public.items_log_events();

-- Atomic +/- used by the quantity stepper. Runs with the caller's rights, so
-- RLS still applies. Quantity never goes below zero.
create or replace function public.adjust_item_quantity(p_item_id uuid, p_delta numeric, p_note text default null)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_quantity numeric;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'invalid_delta' using errcode = '22023';
  end if;
  perform set_config('stowly.event_note', coalesce(left(p_note, 500), ''), true);
  update public.items
     set quantity = greatest(0, quantity + p_delta)
   where id = p_item_id
  returning quantity into v_quantity;
  -- Checked via the returned value: PERFORM below would reset FOUND.
  if v_quantity is null then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  perform set_config('stowly.event_note', '', true);
  return v_quantity;
end;
$$;

-- ---------------------------------------------------------------------------
-- Defaults for new users
-- ---------------------------------------------------------------------------

create or replace function private.seed_user_defaults(p_user_id uuid)
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
  insert into public.categories (user_id, builtin_key, name, name_en, icon, sort_order, default_attributes) values
    (p_user_id, 'clothing', 'Quần áo, giày dép', 'Clothing & shoes', 'shirt', 10, '[
      {"key":"size","type":"text","label_vi":"Kích cỡ","label_en":"Size"},
      {"key":"color","type":"text","label_vi":"Màu sắc","label_en":"Color"},
      {"key":"season","type":"select","label_vi":"Mùa","label_en":"Season","options":[
        {"value":"summer","label_vi":"Mùa hè","label_en":"Summer"},
        {"value":"winter","label_vi":"Mùa đông","label_en":"Winter"},
        {"value":"all","label_vi":"Quanh năm","label_en":"All year"}]}
    ]'),
    (p_user_id, 'bedding', 'Chăn ga gối nệm', 'Bedding', 'bed-double', 20, '[
      {"key":"size","type":"text","label_vi":"Kích thước","label_en":"Size"},
      {"key":"material","type":"text","label_vi":"Chất liệu","label_en":"Material"}
    ]'),
    (p_user_id, 'electronics', 'Điện tử', 'Electronics', 'laptop', 30, '[
      {"key":"brand","type":"text","label_vi":"Hãng","label_en":"Brand"},
      {"key":"model","type":"text","label_vi":"Model","label_en":"Model"},
      {"key":"serial","type":"text","label_vi":"Số serial","label_en":"Serial number"}
    ]'),
    (p_user_id, 'stationery', 'Văn phòng phẩm', 'Stationery', 'pencil', 40, '[
      {"key":"color","type":"text","label_vi":"Màu sắc","label_en":"Color"}
    ]'),
    (p_user_id, 'books', 'Sách', 'Books', 'book-open', 50, '[
      {"key":"author","type":"text","label_vi":"Tác giả","label_en":"Author"},
      {"key":"read_status","type":"select","label_vi":"Tình trạng đọc","label_en":"Read status","options":[
        {"value":"unread","label_vi":"Chưa đọc","label_en":"Unread"},
        {"value":"reading","label_vi":"Đang đọc","label_en":"Reading"},
        {"value":"read","label_vi":"Đã đọc","label_en":"Read"}]},
      {"key":"lent_to","type":"text","label_vi":"Cho mượn","label_en":"Lent to"},
      {"key":"lent_due","type":"date","label_vi":"Hẹn trả","label_en":"Due back"}
    ]'),
    (p_user_id, 'food', 'Thực phẩm dự trữ', 'Stockpiled food', 'apple', 60, '[]'),
    (p_user_id, 'household', 'Gia dụng & khác', 'Household & misc', 'house', 70, '[]')
  on conflict (user_id, builtin_key) do nothing;

  if exists (select 1 from public.locations where user_id = p_user_id) then
    return;
  end if;

  insert into public.locations (user_id, builtin_key, name, name_en, sort_order)
    values (p_user_id, 'living_room', 'Phòng khách', 'Living room', 10) returning id into v_living;
  insert into public.locations (user_id, builtin_key, name, name_en, sort_order)
    values (p_user_id, 'bedroom', 'Phòng ngủ', 'Bedroom', 20) returning id into v_bedroom;
  insert into public.locations (user_id, builtin_key, name, name_en, sort_order)
    values (p_user_id, 'kitchen', 'Nhà bếp', 'Kitchen', 30) returning id into v_kitchen;
  insert into public.locations (user_id, builtin_key, name, name_en, sort_order) values
    (p_user_id, 'bathroom', 'Phòng tắm', 'Bathroom', 40),
    (p_user_id, 'desk', 'Bàn làm việc', 'Desk', 50),
    (p_user_id, 'storage', 'Kho', 'Storage room', 60);
  insert into public.locations (user_id, parent_id, builtin_key, name, name_en, sort_order) values
    (p_user_id, v_bedroom, 'wardrobe', 'Tủ quần áo', 'Wardrobe', 10),
    (p_user_id, v_kitchen, 'fridge', 'Tủ lạnh', 'Fridge', 10),
    (p_user_id, v_kitchen, 'kitchen_shelf', 'Kệ bếp', 'Kitchen shelf', 20),
    (p_user_id, v_living, 'tv_cabinet', 'Tủ TV', 'TV cabinet', 10);
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
  perform private.seed_user_defaults(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
