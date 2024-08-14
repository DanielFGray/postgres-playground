create table app_private.sessions (
  id text primary key,
  user_id uuid not null,
  expires_at timestamptz not null default now()
);

create index sessions_user_id_idx on app_private.sessions (user_id);

alter table app_private.sessions enable row level security;

create function app_public.current_session_id() returns text as $$
  select nullif(pg_catalog.current_setting('my.session_id', true), '');
$$ language sql stable;

create function app_public.current_user_id() returns uuid as $$
  select user_id from app_private.sessions
  where id = app_public.current_session_id();
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;
