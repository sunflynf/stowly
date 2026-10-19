-- Aggregate counts used by the Locations and Categories & tags screens.

create or replace function public.location_counts()
returns table (location_id uuid, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.location_id, count(*)
  from public.items i
  where i.archived_at is null and i.location_id is not null
  group by i.location_id
$$;

create or replace function public.tag_counts()
returns table (tag_id uuid, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select it.tag_id, count(*)
  from public.item_tags it
  join public.items i on i.id = it.item_id and i.archived_at is null
  group by it.tag_id
$$;
