create extension if not exists pgcrypto;

create table if not exists public.goals (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id text,
  slot integer not null check (slot >= 0 and slot <= 7),
  title text not null,
  description text default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  stickers jsonb not null default '[]'::jsonb,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists goals_owner_parent_idx on public.goals(owner_id, parent_id, slot);

alter table public.goals enable row level security;

drop policy if exists "Users can read own goals" on public.goals;
create policy "Users can read own goals"
on public.goals
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals"
on public.goals
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
on public.goals
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
on public.goals
for delete
to authenticated
using (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('madal-art-stickers', 'madal-art-stickers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read sticker files" on storage.objects;
create policy "Users can read sticker files"
on storage.objects
for select
to public
using (bucket_id = 'madal-art-stickers');

drop policy if exists "Users can upload own sticker files" on storage.objects;
create policy "Users can upload own sticker files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'madal-art-stickers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own sticker files" on storage.objects;
create policy "Users can update own sticker files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'madal-art-stickers'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'madal-art-stickers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own sticker files" on storage.objects;
create policy "Users can delete own sticker files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'madal-art-stickers'
  and (storage.foldername(name))[1] = auth.uid()::text
);
