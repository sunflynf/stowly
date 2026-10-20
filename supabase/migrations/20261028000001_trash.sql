-- Trash: deleting an item moves it to the trash for 30 days, from where it can
-- be restored; after that it is removed for good (the hourly cron job).
--
-- A trashed item is hidden from members by RLS, so every list, count, search
-- and report leaves it out without changes. It is also archived, which the
-- alert logic already skips; that covers the scheduled digest too, which runs
-- with the service role and so bypasses RLS. Restoring brings back the
-- archived state the item had before.

alter table public.items
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add column deleted_was_archived boolean not null default false;

create index items_trash_idx on public.items (household_id, deleted_at) where deleted_at is not null;

drop policy items_select on public.items;
drop policy items_update on public.items;
drop policy items_delete on public.items;

create policy items_select on public.items for select to authenticated
  using (household_id = (select public.current_household_id()) and deleted_at is null);
create policy items_update on public.items for update to authenticated
  using (household_id = (select public.current_household_id()) and (select public.can_edit_household()) and deleted_at is null)
  with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()) and deleted_at is null);
create policy items_delete on public.items for delete to authenticated
  using (household_id = (select public.current_household_id()) and (select public.can_edit_household()) and deleted_at is null);

-- Moves an item to the trash (owner or editor of its household).
create or replace function public.trash_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_household() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('stowly.skip_touch', '1', true);
  update public.items
     set deleted_at = now(),
         deleted_by = auth.uid(),
         deleted_was_archived = archived_at is not null,
         archived_at = coalesce(archived_at, now())
   where id = p_item_id
     and household_id = public.current_household_id()
     and deleted_at is null;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Brings an item back from the trash, with the archived state it had before.
create or replace function public.restore_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_household() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('stowly.skip_touch', '1', true);
  update public.items
     set archived_at = case when deleted_was_archived then archived_at end,
         deleted_at = null,
         deleted_by = null,
         deleted_was_archived = false
   where id = p_item_id
     and household_id = public.current_household_id()
     and deleted_at is not null;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Removes a trashed item for good and returns the storage paths of its photos
-- and documents, which the caller deletes from Storage.
create or replace function public.delete_item_forever(p_item_id uuid)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_household() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.items i
                 where i.id = p_item_id and i.household_id = public.current_household_id() and i.deleted_at is not null) then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  return query
    select 'item-photos'::text, p.storage_path from public.item_photos p where p.item_id = p_item_id
    union all
    select 'item-photos'::text, p.thumb_path from public.item_photos p where p.item_id = p_item_id and p.thumb_path is not null
    union all
    select 'item-documents'::text, d.storage_path from public.item_documents d where d.item_id = p_item_id;
  delete from public.items where id = p_item_id;
end;
$$;

-- The active household's trash, newest first (members can look; editors act).
create or replace function public.trash_items()
returns table (id uuid, name text, deleted_at timestamptz, deleted_by_name text, purge_on date, thumb_path text, location_path text, location_path_en text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.name, i.deleted_at,
    (select coalesce(p.display_name, split_part(u.email, '@', 1))
       from auth.users u left join public.profiles p on p.id = u.id where u.id = i.deleted_by),
    (i.deleted_at + interval '30 days')::date,
    (select ph.thumb_path from public.item_photos ph where ph.item_id = i.id order by ph.sort_order, ph.created_at limit 1),
    l.path_text, l.path_text_en
  from public.items i
  left join public.locations l on l.id = i.location_id
  where i.household_id = public.current_household_id() and i.deleted_at is not null
  order by i.deleted_at desc
$$;

revoke all on function public.trash_item(uuid) from public, anon;
revoke all on function public.restore_item(uuid) from public, anon;
revoke all on function public.delete_item_forever(uuid) from public, anon;
revoke all on function public.trash_items() from public, anon;
grant execute on function public.trash_item(uuid) to authenticated;
grant execute on function public.restore_item(uuid) to authenticated;
grant execute on function public.delete_item_forever(uuid) to authenticated;
grant execute on function public.trash_items() to authenticated;
