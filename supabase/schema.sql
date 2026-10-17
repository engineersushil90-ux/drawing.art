create table if not exists public.likes (
  image_path text primary key,
  likes bigint not null default 0 check (likes >= 0)
);

create table if not exists public.site_visits (
  id smallint primary key check (id = 1),
  visits bigint not null default 0 check (visits >= 0)
);

alter table public.likes enable row level security;
alter table public.site_visits enable row level security;

insert into public.likes as existing (image_path, likes)
values
  ('drawings/ColorArt/2026-09-14/SK2622872.jpeg', 7),
  ('drawings/ColorArt/2026-09-14/SK2813644.jpeg', 4)
on conflict (image_path) do update
set likes = greatest(existing.likes, excluded.likes);

insert into public.site_visits (id, visits)
values (1, 53)
on conflict (id) do nothing;

create or replace function public.increment_like(p_image_path text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count bigint;
begin
  insert into public.likes as existing (image_path, likes)
  values (p_image_path, 1)
  on conflict (image_path) do update
  set likes = existing.likes + 1
  returning likes into updated_count;

  return updated_count;
end;
$$;

create or replace function public.increment_visits()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count bigint;
begin
  insert into public.site_visits as existing (id, visits)
  values (1, 1)
  on conflict (id) do update
  set visits = existing.visits + 1
  returning visits into updated_count;

  return updated_count;
end;
$$;

revoke all on table public.likes from anon, authenticated;
revoke all on table public.site_visits from anon, authenticated;
grant select, insert, update on table public.likes to service_role;
grant select, insert, update on table public.site_visits to service_role;

revoke all on function public.increment_like(text) from public, anon, authenticated;
revoke all on function public.increment_visits() from public, anon, authenticated;
grant execute on function public.increment_like(text) to service_role;
grant execute on function public.increment_visits() to service_role;
