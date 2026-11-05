create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  input jsonb not null check (jsonb_typeof(input) = 'object' and pg_column_size(input) < 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_user_id_updated_at_idx on public.designs (user_id, updated_at desc);

revoke all on table public.designs from anon, authenticated;
grant select, insert, update, delete on table public.designs to authenticated;

alter table public.designs enable row level security;

create policy "Owners can read their designs" on public.designs for select
  to authenticated using ((select auth.uid()) = user_id);

create policy "Owners can create designs" on public.designs for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "Owners can update their designs" on public.designs for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Owners can delete their designs" on public.designs for delete
  to authenticated using ((select auth.uid()) = user_id);
