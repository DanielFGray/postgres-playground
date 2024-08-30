create type app_public.privacy as enum(
  'private',
  'secret',
  'public'
);

------------------------------------------------------------------------------------------------------------------------

create table app_public.playgrounds (
  id int primary key generated always as identity (start 1000),
  user_id uuid not null default app_public.current_user_id()
    references app_public.users on delete cascade,
  fork_id int
    references app_public.playgrounds,
  privacy app_public.privacy not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text check (name ~ '^[a-zA-Z0-9_-]+$'),
  description text,
  data jsonb not null,
  unique (user_id, name)
);

create index on app_public.playgrounds (user_id);
create index on app_public.playgrounds (fork_id);
create index on app_public.playgrounds (created_at desc);

------------------------------------------------------------------------------------------------------------------------

alter table app_public.playgrounds enable row level security;

create policy select_own_and_public on app_public.playgrounds
 for select using (privacy = 'public' or user_id = app_public.current_user_id());

create policy insert_own on app_public.playgrounds
  for insert with check (user_id = app_public.current_user_id());

create policy update_own on app_public.playgrounds
  for update using (user_id = app_public.current_user_id());

create policy delete_own on app_public.playgrounds
  for delete using (user_id = app_public.current_user_id());

create policy manage_all_as_admin on app_public.playgrounds
  for all using (exists (
    select 1 from app_public.users
    where user_id = app_public.current_user_id() and role = 'admin'
  ));

grant
  select,
  insert (name, description, data, privacy, fork_id),
  update (name, description, data, privacy),
  delete
  on app_public.playgrounds to :DATABASE_VISITOR;

create trigger _100_timestamps
  before insert or update
  on app_public.playgrounds
  for each row
  execute procedure app_private.tg__timestamps();

------------------------------------------------------------------------------------------------------------------------

create table app_public.playground_stars (
  playground_id int not null references app_public.playgrounds on delete cascade,
  user_id uuid not null default app_public.current_user_id() references app_public.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (playground_id, user_id)
);

create index on app_public.playground_stars (user_id);

alter table app_public.playground_stars enable row level security;

create policy select_all on app_public.playground_stars
  for select using (true);
create policy insert_own on app_public.playground_stars
  for insert with check (user_id = app_public.current_user_id());
create policy delete_own on app_public.playground_stars
  for delete using (user_id = app_public.current_user_id());

grant
  select,
  insert (playground_id),
  delete
  on app_public.playground_stars to :DATABASE_VISITOR;
