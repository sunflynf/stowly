-- Barcodes on items (scan to find or prefill) — searchable like any other text.

alter table public.items
  add column barcode text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,64}$');

create index items_barcode_idx on public.items (user_id, barcode) where barcode is not null;

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
    || setweight(to_tsvector('simple', public.normalize_search(concat_ws(' ', new.notes, v_attrs, new.purchase_place, new.barcode))), 'D');

  new.search_text := public.normalize_search(concat_ws(' ', new.name, v_tags, v_category, v_location, new.barcode));
  return new;
end;
$$;
