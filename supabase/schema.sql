create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contacted_at timestamptz,
  name text not null,
  email text not null,
  support_type text not null,
  rhythm text not null,
  client_profile text not null,
  preferred_contact text not null,
  details text not null,
  source text not null default 'website',
  status text not null default 'new',
  ip_hash text,
  user_agent text,
  page_url text
);

create table if not exists public.admin_users (
  email citext primary key,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.inquiries enable row level security;
alter table public.admin_users enable row level security;

drop trigger if exists set_inquiries_updated_at on public.inquiries;
create trigger set_inquiries_updated_at
before update on public.inquiries
for each row
execute function public.set_updated_at();

drop policy if exists "no public reads on inquiries" on public.inquiries;
create policy "no public reads on inquiries"
on public.inquiries
for select
to anon
using (false);

drop policy if exists "admins can read inquiries" on public.inquiries;
create policy "admins can read inquiries"
on public.inquiries
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')::citext
  )
);

drop policy if exists "admins can update inquiries" on public.inquiries;
create policy "admins can update inquiries"
on public.inquiries
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')::citext
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')::citext
  )
);

drop policy if exists "admins can view admin_users" on public.admin_users;
create policy "admins can view admin_users"
on public.admin_users
for select
to authenticated
using (
  email = (auth.jwt() ->> 'email')::citext
);

create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);
create index if not exists inquiries_status_idx on public.inquiries (status);
create index if not exists inquiries_ip_hash_created_at_idx on public.inquiries (ip_hash, created_at desc);

-- Add at least one approved dashboard email after running the schema:
-- insert into public.admin_users (email) values ('you@example.com');
