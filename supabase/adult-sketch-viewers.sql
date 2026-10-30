create table if not exists public.adult_sketch_viewers (
  email text primary key,
  name text not null,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  views integer not null default 1 check (views > 0)
);

alter table public.adult_sketch_viewers enable row level security;
grant select on public.adult_sketch_viewers to service_role;

create or replace function public.record_adult_sketch_viewer(p_name text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.adult_sketch_viewers;
begin
  insert into public.adult_sketch_viewers (email, name, first_viewed_at, last_viewed_at, views)
  values (lower(trim(p_email)), trim(p_name), now(), now(), 1)
  on conflict (email) do update
    set name = excluded.name,
        last_viewed_at = now(),
        views = public.adult_sketch_viewers.views + 1
  returning * into saved;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.record_adult_sketch_viewer(text, text) from public;
revoke all on function public.record_adult_sketch_viewer(text, text) from anon, authenticated;
grant execute on function public.record_adult_sketch_viewer(text, text) to service_role;
