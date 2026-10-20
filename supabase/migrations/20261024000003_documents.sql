-- Item documents (warranty card, invoice, manual) and the insurance report.

-- Private bucket: PDF or images, at most 10 MB each, under
-- "<household_id>/<item_id>/<file>" like photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-documents', 'item-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy item_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'item-documents' and (storage.foldername(name))[1] = (select public.current_household_id())::text);

create policy item_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-documents' and (storage.foldername(name))[1] = (select public.current_household_id())::text
              and (select public.can_edit_household()));

create policy item_documents_update on storage.objects for update to authenticated
  using (bucket_id = 'item-documents' and (storage.foldername(name))[1] = (select public.current_household_id())::text
         and (select public.can_edit_household()));

create policy item_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-documents' and (storage.foldername(name))[1] = (select public.current_household_id())::text
         and (select public.can_edit_household()));

create type public.document_kind as enum ('warranty', 'invoice', 'manual', 'other');

create table public.item_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households (id) on delete cascade,
  item_id uuid not null,
  kind public.document_kind not null default 'other',
  -- Original file name, shown and used for downloads.
  title text not null check (char_length(btrim(title)) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade,
  -- The file must live in the household's folder for this item.
  check (storage_path like household_id::text || '/' || item_id::text || '/%')
);

create index item_documents_item_idx on public.item_documents (item_id, created_at);

-- At most 20 documents per item.
create or replace function public.enforce_document_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.item_documents where item_id = new.item_id) >= 20 then
    raise exception 'document_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger item_documents_limit before insert on public.item_documents
  for each row execute function public.enforce_document_limit();

alter table public.item_documents enable row level security;
create policy item_documents_select on public.item_documents for select to authenticated
  using (household_id = (select public.current_household_id()));
create policy item_documents_insert on public.item_documents for insert to authenticated
  with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()));
create policy item_documents_update on public.item_documents for update to authenticated
  using (household_id = (select public.current_household_id()) and (select public.can_edit_household()))
  with check (household_id = (select public.current_household_id()) and (select public.can_edit_household()));
create policy item_documents_delete on public.item_documents for delete to authenticated
  using (household_id = (select public.current_household_id()) and (select public.can_edit_household()));
revoke all on public.item_documents from anon;

-- ---------------------------------------------------------------------------
-- Insurance report
-- ---------------------------------------------------------------------------

-- Active items with a purchase price, most valuable first, filtered by minimum
-- value, categories and a location (a room includes everything inside it).
-- Items in the filter without a price are counted, not listed.
create or replace function public.insurance_report(
  p_min_value numeric default null,
  p_category_ids uuid[] default null,
  p_location_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with scope as (
    select i.*, l.path_text, l.path_text_en
    from public.items i
    left join public.locations l on l.id = i.location_id
    where i.archived_at is null
      and i.condition <> 'given_away'
      and (p_category_ids is null or i.category_id = any (p_category_ids))
      and (p_location_id is null or p_location_id = any (l.path_ids))
  ),
  listed as (
    select s.* from scope s
    where s.purchase_price is not null and (p_min_value is null or s.purchase_price >= p_min_value)
  )
  select jsonb_build_object(
    'total', (select coalesce(sum(purchase_price), 0) from listed),
    'count', (select count(*) from listed),
    'unpriced', (select count(*) from scope where purchase_price is null),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'category_id', r.category_id,
        'location_path', r.path_text,
        'location_path_en', r.path_text_en,
        'quantity', r.quantity,
        'unit', r.unit,
        'condition', r.condition,
        'purchase_price', r.purchase_price,
        'purchase_date', r.purchase_date,
        'purchase_place', r.purchase_place,
        'warranty_until', r.warranty_until,
        'brand', nullif(btrim(r.attributes ->> 'brand'), ''),
        'model', nullif(btrim(r.attributes ->> 'model'), ''),
        'serial', nullif(btrim(r.attributes ->> 'serial'), ''),
        'thumb_path', (select ph.thumb_path from public.item_photos ph where ph.item_id = r.id
                       order by ph.sort_order, ph.created_at limit 1),
        'documents', (select count(*) from public.item_documents d where d.item_id = r.id)
      ) order by r.purchase_price desc, r.name), '[]'::jsonb)
      from (select * from listed order by purchase_price desc, name limit 2000) r
    )
  )
$$;
