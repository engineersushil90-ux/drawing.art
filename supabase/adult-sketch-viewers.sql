create table if not exists public.adult_sketch_viewers (
  email text primary key,
  name text not null,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  views integer not null default 1 check (views > 0),
  access_id uuid unique,
  is_payment boolean not null default false
);

alter table public.adult_sketch_viewers
  add column if not exists access_id uuid unique,
  add column if not exists is_payment boolean not null default false,
  add column if not exists payment_requested_at timestamptz;

alter table public.adult_sketch_viewers enable row level security;
grant select, update on public.adult_sketch_viewers to service_role;

create or replace function public.record_adult_sketch_viewer(p_name text, p_email text, p_access_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.adult_sketch_viewers;
begin
  insert into public.adult_sketch_viewers (email, name, first_viewed_at, last_viewed_at, views, access_id)
  values (lower(trim(p_email)), trim(p_name), now(), now(), 1, p_access_id)
  on conflict (email) do update
    set name = excluded.name,
        last_viewed_at = now(),
        views = public.adult_sketch_viewers.views + 1,
        access_id = excluded.access_id
  returning * into saved;

  return to_jsonb(saved);
end;
$$;

do $revoke_legacy_function$
begin
  if to_regprocedure('public.record_adult_sketch_viewer(text,text)') is not null then
    execute 'revoke all on function public.record_adult_sketch_viewer(text, text) from public, anon, authenticated';
  end if;
end
$revoke_legacy_function$;

revoke all on function public.record_adult_sketch_viewer(text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_adult_sketch_viewer(text, text, uuid) to service_role;
