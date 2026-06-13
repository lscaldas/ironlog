create table if not exists public.ironlog_profiles (
  profile_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_ironlog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ironlog_profiles_updated_at on public.ironlog_profiles;

create trigger ironlog_profiles_updated_at
before update on public.ironlog_profiles
for each row
execute function public.set_ironlog_updated_at();

alter table public.ironlog_profiles enable row level security;

drop policy if exists "ironlog public read encrypted profiles" on public.ironlog_profiles;
drop policy if exists "ironlog public insert encrypted profiles" on public.ironlog_profiles;
drop policy if exists "ironlog public update encrypted profiles" on public.ironlog_profiles;

create policy "ironlog public read encrypted profiles"
on public.ironlog_profiles
for select
to anon
using (profile_id in ('lucas', 'gf'));

create policy "ironlog public insert encrypted profiles"
on public.ironlog_profiles
for insert
to anon
with check (profile_id in ('lucas', 'gf'));

create policy "ironlog public update encrypted profiles"
on public.ironlog_profiles
for update
to anon
using (profile_id in ('lucas', 'gf'))
with check (profile_id in ('lucas', 'gf'));
