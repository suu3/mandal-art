-- Madal Art schema for Neon Postgres
-- Neon 콘솔 SQL Editor에서 실행하세요.

create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists "session" (
  id text primary key,
  expires_at timestamp not null,
  token text not null unique,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references "user"(id) on delete cascade
);

create table if not exists "account" (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references "user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamp,
  refresh_token_expires_at timestamp,
  scope text,
  password text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamp not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists "goals" (
  id text not null,
  owner_id text not null references "user"(id) on delete cascade,
  parent_id text,
  slot integer not null default 0,
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date text,
  stickers jsonb not null default '[]'::jsonb,
  image_url text,
  created_at text not null,
  updated_at text not null,
  primary key (owner_id, id)
);

create index if not exists goals_owner_parent_idx on "goals" (owner_id, parent_id);
create index if not exists session_user_idx on "session" (user_id);
create index if not exists account_user_idx on "account" (user_id);
